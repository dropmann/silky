import { h } from '../../../common/htmlelementcreator';
import interactionManager from '../../../common/interactionmanager';
import type { AuxEntry, AuxEntryContext } from '../types';
import { AuxView } from '../types';
import { AuxExtensionBridge, type AuxExtensionRequestMessage, JamoviAuxBridgeError } from './bridge';
import type { AuxExtensionManifest } from './manifest';
import { getNetworkSources, validateAuxExtensionManifest } from './manifest';
import { withContentSecurityPolicy } from './csp';

export type SandboxAuxExtensionDocumentFactory = (context: AuxEntryContext, manifest: AuxExtensionManifest) => string;

export type SandboxAuxExtensionOptions = {
    // a translated title for built in extensions, whose manifests are
    // created before translations are available
    title?: () => string;
};

type StateEvent = 'datasetChanged' | 'selectedVariableChanged' | 'selectedAnalysisChanged' | 'analysesChanged';

// state changes (such as results updating while an analysis runs) can come in
// bursts, so they're coalesced and sent at most this often
const STATE_EVENT_INTERVAL_MS = 200;

export class SandboxAuxExtensionView extends AuxView {
    manifest: AuxExtensionManifest;
    private context: AuxEntryContext;
    private createDocument: SandboxAuxExtensionDocumentFactory;
    private bridge: AuxExtensionBridge;
    private iframe: HTMLIFrameElement | null = null;
    private hostElement: HTMLElement | null = null;
    private releaseIsolatedFrame: (() => void) | null = null;
    // the private channel to the extension's own document, see handleFrameLoad()
    private port: MessagePort | null = null;
    private frameLoads = 0;
    private stopped = false;
    private options: SandboxAuxExtensionOptions;
    private visible = false;
    private pendingStateEvents = new Set<StateEvent>();
    private stateEventTimer: ReturnType<typeof setTimeout> | null = null;
    // the icon comes from the manifest
    override iconTrusted = false;

    constructor(manifest: AuxExtensionManifest, context: AuxEntryContext, createDocument: SandboxAuxExtensionDocumentFactory, options: SandboxAuxExtensionOptions = {}) {
        super(manifest.id);
        this.manifest = manifest;
        this.context = context;
        this.createDocument = createDocument;
        this.options = options;
        this.bridge = new AuxExtensionBridge(manifest, context, (name, data) => this.postEvent(name, data));
        this.title = this.getTitle();
        this.iconSvg = this.getIconSvg();
        this.handleFrameLoad = this.handleFrameLoad.bind(this);
    }

    override getTitle(): string {
        return this.options?.title?.() || this.manifest?.name || this.id;
    }

    override getIconSvg(): string {
        return this.manifest?.iconSvg || `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="5" width="16" height="14" rx="2" />
                <path d="M4 10h16" />
                <path d="M10 5v14" />
            </svg>
        `;
    }

    override getBody(): HTMLElement {
        const iframe = h('iframe', {
            class: 'aux-extension-sandbox-frame',
            title: this.manifest.name,
            sandbox: 'allow-scripts',
            referrerpolicy: 'no-referrer',
        });
        const body = h('div', { class: 'aux-extension-sandbox-host' }, iframe);
        this.iframe = iframe;
        this.hostElement = body;
        // the extension is untrusted, so it mustn't be able to send focus
        // loop messages (which can run shortcuts) to the main window
        this.releaseIsolatedFrame = interactionManager.isolateFrame(iframe);
        iframe.addEventListener('load', this.handleFrameLoad);
        iframe.srcdoc = withContentSecurityPolicy(this.createDocument(this.context, this.manifest), getNetworkSources(this.manifest));

        return body;
    }

    override onMount(): void {
        const dataSetModel = this.context.instance.dataSetModel();
        for (const eventName of [
            'dataSetLoaded', 'columnsChanged', 'change:rowCount', 'change:columnCount',
            'change:rowCountExFiltered', 'change:filtersVisible', 'change:editedCellCount', 'change:edited',
        ])
            this.listen(dataSetModel, eventName, this.postDatasetChanged);

        this.listen(this.context.instance, 'change:selectedAnalysis', this.postSelectedAnalysisChanged);

        const analyses = this.context.instance.analyses();
        for (const eventName of [ 'analysisCreated', 'analysisDeleted', 'analysisResultsChanged', 'analysisHeadingChanged', 'analysisOptionsChanged' ])
            this.listen(analyses, eventName, this.postAnalysesChanged);

        this.addCleanup(this.context.selection.registerChangeEventHandler(() => this.postSelectedVariableChanged()));
    }

    override onShow(): void {
        this.visible = true;
        this.postEvent('shown', {});
        this.postEvent('visibilityChanged', { visible: true });

        // bring the extension up to date with anything that changed while it
        // was hidden, along with the current selection
        this.queueStateEvent('selectedVariableChanged');
        this.queueStateEvent('selectedAnalysisChanged');
        this.queueStateEvent('analysesChanged');
        this.flushStateEvents();
    }

    override onHide(): void {
        this.visible = false;
        this.postEvent('hidden', {});
        this.postEvent('visibilityChanged', { visible: false });
    }

    override onDispose(): void {
        this.postEvent('dispose', {});
        if (this.stateEventTimer !== null)
            clearTimeout(this.stateEventTimer);
        this.stateEventTimer = null;
        this.pendingStateEvents.clear();
        this.closePort();

        this.iframe?.removeEventListener('load', this.handleFrameLoad);
        this.iframe?.removeAttribute('srcdoc');
        this.iframe = null;
        this.releaseIsolatedFrame?.();
        this.releaseIsolatedFrame = null;
    }

    // The extension's document is given a private MessagePort when it first
    // loads, and the bridge only talks over that port. The frame can still
    // navigate itself (a sandbox can't prevent it, nor can the CSP), so any
    // later load means the extension's document has been replaced, perhaps by
    // an outside page. That page never gets the port, and the extension is
    // stopped, so it can't take over the extension's access.
    private handleFrameLoad(): void {
        if (this.stopped)
            return;

        this.frameLoads += 1;
        if (this.frameLoads === 1)
            this.openPort();
        else
            this.stop();
    }

    private openPort(): void {
        const contentWindow = this.iframe?.contentWindow;
        if (! contentWindow)
            return;

        const channel = new MessageChannel();
        this.port = channel.port1;
        this.port.onmessage = event => this.handleMessage(event.data as AuxExtensionRequestMessage);
        contentWindow.postMessage({ jamoviAux: true, type: 'port' }, '*', [ channel.port2 ]);
    }

    private closePort(): void {
        if (this.port === null)
            return;
        this.port.onmessage = null;
        this.port.close();
        this.port = null;
    }

    private stop(): void {
        this.stopped = true;
        this.closePort();
        this.bridge.disconnect();
        if (this.stateEventTimer !== null)
            clearTimeout(this.stateEventTimer);
        this.stateEventTimer = null;
        this.pendingStateEvents.clear();

        this.iframe?.removeEventListener('load', this.handleFrameLoad);
        this.iframe?.remove();
        this.iframe = null;
        this.releaseIsolatedFrame?.();
        this.releaseIsolatedFrame = null;

        this.hostElement?.replaceChildren(h('div', { class: 'aux-panel-placeholder' },
            _('This extension has been stopped, because it tried to leave its own content.')));
    }

    private handleMessage(message: AuxExtensionRequestMessage): void {
        if (message?.jamoviAux !== true)
            return;

        if (message.type === 'resize') {
            this.resizeIframe(message.height);
            return;
        }

        // Escape pressed inside the extension, which the host can't see
        if (message.type === 'exit') {
            this.onRequestExit?.();
            return;
        }

        void this.handleBridgeMessage(message);
    }

    private resizeIframe(height?: number): void {
        if (this.iframe === null || typeof height !== 'number' || Number.isFinite(height) === false)
            return;

        const nextHeight = Math.max(260, Math.min(4000, Math.ceil(height)));
        this.iframe.style.height = `${ nextHeight }px`;
    }

    private async handleBridgeMessage(message: AuxExtensionRequestMessage): Promise<void> {
        try {
            const result = await this.bridge.handleMessage(message);
            if (this.stopped)
                return;
            this.reply(message.id, result);

            // anything that changed before the extension connected
            if (message.type === 'connect')
                this.scheduleStateEvents();
        }
        catch (error) {
            this.replyError(message.id, error);
        }
    }

    private reply(id: number, result: any): void {
        this.port?.postMessage({
            jamoviAux: true,
            type: 'response',
            id,
            result,
        });
    }

    private replyError(id: number, error: any): void {
        const auxError = error instanceof JamoviAuxBridgeError
            ? error
            : new JamoviAuxBridgeError('internal-error', error?.message || 'Internal error');

        this.port?.postMessage({
            jamoviAux: true,
            type: 'response',
            id,
            error: {
                code: auxError.code,
                message: auxError.message,
            },
        });
    }

    private postEvent(name: string, data: any): void {
        // events sent before the extension connects would be lost
        if (! this.bridge.isConnected)
            return;

        this.port?.postMessage({
            jamoviAux: true,
            type: 'event',
            name,
            data,
        });
    }

    private postDatasetChanged(): void {
        this.queueStateEvent('datasetChanged');
    }

    private postSelectedVariableChanged(): void {
        this.queueStateEvent('selectedVariableChanged');
    }

    private postSelectedAnalysisChanged(): void {
        this.queueStateEvent('selectedAnalysisChanged');
    }

    private postAnalysesChanged(): void {
        this.queueStateEvent('analysesChanged');
    }

    private canReceiveStateEvent(name: StateEvent): boolean {
        switch (name) {
            case 'selectedVariableChanged':
                return this.manifest.permissions.includes('read:selectedVariable');
            case 'selectedAnalysisChanged':
                return this.manifest.permissions.includes('read:selectedAnalysis');
            case 'analysesChanged':
                return this.manifest.permissions.includes('read:analyses');
            default:
                return true;
        }
    }

    // state events are held while the extension is hidden or not yet
    // connected, and coalesced while it's showing
    private queueStateEvent(name: StateEvent): void {
        if (! this.canReceiveStateEvent(name))
            return;

        this.pendingStateEvents.add(name);
        this.scheduleStateEvents();
    }

    private scheduleStateEvents(): void {
        if (this.pendingStateEvents.size === 0 || ! this.visible || ! this.bridge.isConnected || this.stateEventTimer !== null)
            return;

        this.stateEventTimer = setTimeout(() => this.flushStateEvents(), STATE_EVENT_INTERVAL_MS);
    }

    private flushStateEvents(): void {
        if (this.stateEventTimer !== null)
            clearTimeout(this.stateEventTimer);
        this.stateEventTimer = null;

        if (! this.visible || ! this.bridge.isConnected)
            return;

        const events = Array.from(this.pendingStateEvents);
        this.pendingStateEvents.clear();

        for (const name of events) {
            switch (name) {
                case 'datasetChanged':
                    this.postEvent(name, {});
                    break;
                case 'selectedVariableChanged':
                    this.postEvent(name, this.bridge.tryGetSelectedVariable());
                    break;
                case 'selectedAnalysisChanged':
                    this.postEvent(name, this.bridge.tryGetSelectedAnalysis());
                    break;
                case 'analysesChanged':
                    this.postEvent(name, this.bridge.tryListAnalyses());
                    break;
            }
        }
    }
}

export function createSandboxAuxExtensionEntry(manifest: AuxExtensionManifest, createDocument: SandboxAuxExtensionDocumentFactory, options: SandboxAuxExtensionOptions = {}): AuxEntry {
    validateAuxExtensionManifest(manifest);

    return {
        id: manifest.id,
        order: manifest.order,
        create: context => new SandboxAuxExtensionView(manifest, context, createDocument, options),
    };
}
