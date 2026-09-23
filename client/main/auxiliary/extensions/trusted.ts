import type { AuxEntry, AuxEntryContext } from '../types';
import { AuxView } from '../types';
import type { AuxExtensionManifest } from './manifest';
import { validateAuxExtensionManifest } from './manifest';

export type TrustedAuxExtensionFactory = (context: AuxEntryContext) => AuxView;

export class TrustedAuxExtensionView extends AuxView {
    manifest: AuxExtensionManifest;
    private innerView: AuxView;

    constructor(manifest: AuxExtensionManifest, context: AuxEntryContext, create: TrustedAuxExtensionFactory) {
        super(manifest.id, context.t);
        this.manifest = manifest;
        this.innerView = create(context);
        this.title = this.getTitle();
        this.iconSvg = this.getIconSvg();
    }

    override getTitle(): string {
        return this.manifest?.name || this.innerView?.getTitle() || this.id;
    }

    override getIconSvg(): string {
        return this.manifest?.iconSvg || this.innerView?.getIconSvg() || '';
    }

    override render(): void {
        this.title = this.getTitle();
        this.iconSvg = this.getIconSvg();

        if (this.element !== null)
            this.element.setAttribute('aria-label', this.title);

        this.syncInnerViewHost();
        if (this.bodyElement === null)
            this.bodyElement = this.innerView.getBody();
        else
            this.innerView.update();

        this.syncInnerViewHost();
    }

    override onMount(): void {
        this.syncInnerViewHost();
        this.innerView.onMount();
    }

    override update(): void {
        this.syncInnerViewHost();
        this.innerView.update();
    }

    override onShow(): void {
        this.syncInnerViewHost();
        this.innerView.onShow();
    }

    override onHide(): void {
        this.syncInnerViewHost();
        this.innerView.onHide();
    }

    override onDispose(): void {
        this.syncInnerViewHost();
        this.innerView.onDispose();
    }

    private syncInnerViewHost(): void {
        this.innerView.element = this.element;
        this.innerView.bodyElement = this.bodyElement;
        this.innerView.loop = this.loop;
    }
}

export function createTrustedAuxExtensionEntry(manifest: AuxExtensionManifest, create: TrustedAuxExtensionFactory): AuxEntry {
    validateAuxExtensionManifest(manifest, { trustedRequired: true });

    return {
        id: manifest.id,
        order: manifest.order,
        create: context => new TrustedAuxExtensionView(manifest, context, create),
    };
}
