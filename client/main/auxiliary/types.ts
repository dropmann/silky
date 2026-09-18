import interactionManager, { type FocusLoop } from '../../common/interactionmanager';
import type Instance from '../instance';

export type AuxViewId =
    | 'assistant'
    | 'results-toc'
    | 'dataset'
    | 'analysis'
    | 'help'
    | 'variable-info'
    | 'issues'
    | 'history'
    | 'search'
    | 'notes'
    | 'output-nav'
    | 'data-quality'
    | 'transforms'
    | 'modules'
    | 'guidance'
    | 'review';

export type AuxViewSelection = AuxViewId | null;
export type AuxPresentation = 'hidden' | 'overlay' | 'docked';
export type AuxSide = 'left' | 'right';

export type AuxTranslate = (text: string, data?: { [key: string]: any }) => string;

export type AuxEntryContext = {
    t: AuxTranslate;
    instance: Instance;
};

export type AuxEntry = {
    id: AuxViewId;
    order: number;
    create: (context: AuxEntryContext) => AuxView;
};

export class AuxView {
    id: AuxViewId;
    t: AuxTranslate;
    title: string;
    iconSvg: string;
    element: HTMLElement | null = null;
    bodyElement: HTMLElement | null = null;
    loop: FocusLoop | null = null;

    constructor(id: AuxViewId, t: AuxTranslate) {
        this.id = id;
        this.t = t;
        this.title = this.getTitle();
        this.iconSvg = this.getIconSvg();
    }

    getTitle(): string {
        return this.id;
    }

    getIconSvg(): string {
        return '';
    }

    createBodyElement(innerHtml: string): HTMLElement {
        const body = document.createElement('div');
        body.innerHTML = innerHtml;
        return body;
    }

    getBody(): HTMLElement {
        return this.createBodyElement('');
    }

    render(): void {
        this.title = this.getTitle();
        this.iconSvg = this.getIconSvg();

        if (this.element !== null)
            this.element.setAttribute('aria-label', this.title);

        if (this.bodyElement === null)
            this.bodyElement = this.getBody();
        else
            this.update();
    }

    onMount(): void {
    }

    update(): void {
    }

    onShow(): void {
    }

    onHide(): void {
    }

    focus(): void {
        if (this.loop !== null)
            this.loop.activate();
        else
            this.element?.focus();
    }

    createToolbarButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'aux-toolbar-button';
        button.type = 'button';
        button.setAttribute('data-aux-view', this.id);
        button.setAttribute('aria-label', this.title);
        button.title = this.title;

        const icon = document.createElement('div');
        icon.className = 'aux-toolbar-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = this.iconSvg;
        button.append(icon);

        return button;
    }

    createPanelElement(): HTMLElement {
        if (this.element !== null)
            return this.element;

        const panelView = document.createElement('section');
        panelView.className = 'aux-panel-view';
        panelView.setAttribute('data-aux-view', this.id);
        panelView.setAttribute('role', 'group');
        panelView.setAttribute('aria-label', this.title);
        panelView.tabIndex = -1;
        this.element = panelView;
        this.loop = interactionManager.registerLoop(panelView, { level: 1 });
        this.render();
        if (this.bodyElement !== null)
            panelView.replaceChildren(this.bodyElement);
        this.onMount();
        return panelView;
    }
}
