import type { AuxEntry, AuxEntryContext } from '../types';
import { AuxView } from '../types';
import { AuxExtensionBridge, type AuxExtensionRequestMessage, JamoviAuxBridgeError } from './bridge';
import type { AuxExtensionManifest } from './manifest';
import { validateAuxExtensionManifest } from './manifest';

export type SandboxAuxExtensionDocumentFactory = (context: AuxEntryContext, manifest: AuxExtensionManifest) => string;

export class SandboxAuxExtensionView extends AuxView {
    manifest: AuxExtensionManifest;
    private context: AuxEntryContext;
    private createDocument: SandboxAuxExtensionDocumentFactory;
    private bridge: AuxExtensionBridge;
    private iframe: HTMLIFrameElement | null = null;
    private unregisterSelectionHandler: (() => void) | null = null;

    constructor(manifest: AuxExtensionManifest, context: AuxEntryContext, createDocument: SandboxAuxExtensionDocumentFactory) {
        super(manifest.id, context.t);
        this.manifest = manifest;
        this.context = context;
        this.createDocument = createDocument;
        this.bridge = new AuxExtensionBridge(manifest, context, (name, data) => this.postEvent(name, data));
        this.title = this.getTitle();
        this.iconSvg = this.getIconSvg();
        this.handleMessage = this.handleMessage.bind(this);
    }

    override getTitle(): string {
        return this.manifest?.name || this.id;
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
        const body = document.createElement('div');
        body.className = 'aux-extension-sandbox-host';

        const iframe = document.createElement('iframe');
        iframe.className = 'aux-extension-sandbox-frame';
        iframe.title = this.manifest.name;
        iframe.sandbox.add('allow-scripts');
        iframe.referrerPolicy = 'no-referrer';

        body.append(iframe);
        this.iframe = iframe;
        window.addEventListener('message', this.handleMessage);
        iframe.srcdoc = this.createDocument(this.context, this.manifest);

        return body;
    }

    override onMount(): void {
        const dataSetModel = this.context.instance.dataSetModel();
        dataSetModel.on('dataSetLoaded', this.postDatasetChanged, this);
        dataSetModel.on('columnsChanged', this.postDatasetChanged, this);
        dataSetModel.on('change:rowCount', this.postDatasetChanged, this);
        dataSetModel.on('change:columnCount', this.postDatasetChanged, this);
        dataSetModel.on('change:rowCountExFiltered', this.postDatasetChanged, this);
        dataSetModel.on('change:filtersVisible', this.postDatasetChanged, this);
        dataSetModel.on('change:editedCellCount', this.postDatasetChanged, this);
        dataSetModel.on('change:edited', this.postDatasetChanged, this);
        this.context.instance.on('change:selectedAnalysis', this.postSelectedAnalysisChanged, this);
        const analyses = this.context.instance.analyses();
        analyses.on('analysisCreated', this.postAnalysesChanged, this);
        analyses.on('analysisDeleted', this.postAnalysesChanged, this);
        analyses.on('analysisResultsChanged', this.postAnalysesChanged, this);
        analyses.on('analysisHeadingChanged', this.postAnalysesChanged, this);
        analyses.on('analysisOptionsChanged', this.postAnalysesChanged, this);
        this.unregisterSelectionHandler = this.context.selection.registerChangeEventHandler(() => this.postSelectedVariableChanged());
    }

    override onShow(): void {
        this.postEvent('shown', {});
        this.postEvent('visibilityChanged', { visible: true });
        this.postSelectedVariableChanged();
        this.postSelectedAnalysisChanged();
        this.postAnalysesChanged();
    }

    override onHide(): void {
        this.postEvent('hidden', {});
        this.postEvent('visibilityChanged', { visible: false });
    }

    override onDispose(): void {
        this.postEvent('dispose', {});
        window.removeEventListener('message', this.handleMessage);
        this.unregisterSelectionHandler?.();
        this.unregisterSelectionHandler = null;

        const dataSetModel = this.context.instance.dataSetModel();
        dataSetModel.off('dataSetLoaded', this.postDatasetChanged, this);
        dataSetModel.off('columnsChanged', this.postDatasetChanged, this);
        dataSetModel.off('change:rowCount', this.postDatasetChanged, this);
        dataSetModel.off('change:columnCount', this.postDatasetChanged, this);
        dataSetModel.off('change:rowCountExFiltered', this.postDatasetChanged, this);
        dataSetModel.off('change:filtersVisible', this.postDatasetChanged, this);
        dataSetModel.off('change:editedCellCount', this.postDatasetChanged, this);
        dataSetModel.off('change:edited', this.postDatasetChanged, this);
        this.context.instance.off('change:selectedAnalysis', this.postSelectedAnalysisChanged, this);
        const analyses = this.context.instance.analyses();
        analyses.off('analysisCreated', this.postAnalysesChanged, this);
        analyses.off('analysisDeleted', this.postAnalysesChanged, this);
        analyses.off('analysisResultsChanged', this.postAnalysesChanged, this);
        analyses.off('analysisHeadingChanged', this.postAnalysesChanged, this);
        analyses.off('analysisOptionsChanged', this.postAnalysesChanged, this);

        this.iframe?.removeAttribute('srcdoc');
        this.iframe = null;
    }

    private handleMessage(event: MessageEvent): void {
        if (this.iframe?.contentWindow !== event.source)
            return;

        const message = event.data as AuxExtensionRequestMessage;
        if (message?.jamoviAux !== true)
            return;

        if (message.type === 'resize') {
            this.resizeIframe(message.height);
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
            this.reply(message.id, result);
        }
        catch (error) {
            this.replyError(message.id, error);
        }
    }

    private reply(id: number, result: any): void {
        this.iframe?.contentWindow?.postMessage({
            jamoviAux: true,
            type: 'response',
            id,
            result,
        }, '*');
    }

    private replyError(id: number, error: any): void {
        const auxError = error instanceof JamoviAuxBridgeError
            ? error
            : new JamoviAuxBridgeError('internal-error', error?.message || 'Internal error');

        this.iframe?.contentWindow?.postMessage({
            jamoviAux: true,
            type: 'response',
            id,
            error: {
                code: auxError.code,
                message: auxError.message,
            },
        }, '*');
    }

    private postEvent(name: string, data: any): void {
        this.iframe?.contentWindow?.postMessage({
            jamoviAux: true,
            type: 'event',
            name,
            data,
        }, '*');
    }

    private postDatasetChanged(): void {
        this.postEvent('datasetChanged', {});
    }

    private postSelectedVariableChanged(): void {
        if (! this.manifest.permissions.includes('read:selectedVariable'))
            return;

        setTimeout(() => this.postEvent('selectedVariableChanged', this.bridge.tryGetSelectedVariable()), 0);
    }

    private postSelectedAnalysisChanged(): void {
        if (! this.manifest.permissions.includes('read:selectedAnalysis'))
            return;

        setTimeout(() => this.postEvent('selectedAnalysisChanged', this.bridge.tryGetSelectedAnalysis()), 0);
    }

    private postAnalysesChanged(): void {
        if (! this.manifest.permissions.includes('read:analyses'))
            return;

        setTimeout(() => this.postEvent('analysesChanged', this.bridge.tryListAnalyses()), 0);
    }
}

export function createSandboxAuxExtensionEntry(manifest: AuxExtensionManifest, createDocument: SandboxAuxExtensionDocumentFactory): AuxEntry {
    validateAuxExtensionManifest(manifest);

    return {
        id: manifest.id,
        order: manifest.order,
        create: context => new SandboxAuxExtensionView(manifest, context, createDocument),
    };
}
