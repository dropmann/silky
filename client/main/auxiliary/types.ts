import type { GroupBatchingEventEmittier } from '../../common/eventmap';
import { h, htmlTrusted, svg } from '../../common/htmlelementcreator';
import type Instance from '../instance';
import type Selection from '../selection';

const focusableSelector = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    'details',
    'iframe',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Returns the first visible, enabled, focusable element inside an element.
 */
export function findInitialFocus(element: HTMLElement): HTMLElement | null {
    for (const candidate of element.querySelectorAll<HTMLElement>(focusableSelector)) {
        if (candidate.hasAttribute('disabled') || candidate.closest('[hidden], [inert]') !== null)
            continue;
        if (candidate.offsetWidth === 0 && candidate.offsetHeight === 0)
            continue;
        return candidate;
    }
    return null;
}

export type BuiltInAuxViewId =
    | 'assistant'
    | 'results-toc'
    | 'dataset'
    | 'dataset-summary-extension'
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

// extensions declare their own ids, so beyond the built in views any id is
// allowed (manifests validate the format)
export type AuxViewId = BuiltInAuxViewId | (string & {});

export type AuxViewSelection = AuxViewId | null;
export type AuxPresentation = 'hidden' | 'overlay' | 'docked';
// logical sides, so the panel mirrors with the rest of the layout in rtl
export type AuxSide = 'start' | 'end';

export type AuxEntryContext = {
    instance: Instance;
    selection: Selection;
};

export type AuxEntry = {
    id: AuxViewId;
    order: number;
    create: (context: AuxEntryContext) => AuxView;
};

export class AuxView {
    id: AuxViewId;
    title: string;
    iconSvg: string;
    element: HTMLElement | null = null;
    bodyElement: HTMLElement | null = null;
    disposed = false;
    // set by the shell while the view is showing
    shown = false;
    private cleanups: Array<() => void> = [];
    // whether iconSvg is fixed internal markup; views showing icons from an
    // untrusted source (such as an extension manifest) set this to false
    iconTrusted = true;
    // set by the shell, views call this to close the panel (or leave it, when
    // docked) and return focus to where it came from
    onRequestExit: (() => void) | null = null;

    constructor(id: AuxViewId) {
        this.id = id;
        this.title = this.getTitle();
        this.iconSvg = this.getIconSvg();
    }

    getTitle(): string {
        return this.id;
    }

    getIconSvg(): string {
        return '';
    }

    createBodyElement(...children: Array<string | Node>): HTMLElement {
        return h('div', {}, ...children);
    }

    getBody(): HTMLElement {
        return this.createBodyElement();
    }

    createIcon(className: string): HTMLElement {
        const icon = h('div', { class: className, 'aria-hidden': 'true' });
        if (this.iconSvg.trim() === '')
            return icon;

        const markup = this.iconTrusted ? htmlTrusted(this.iconSvg) : svg(this.iconSvg);
        if (markup !== null)
            icon.append(markup);
        return icon;
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

    onDispose(): void {
    }

    // registers a model listener that's removed when the view is disposed
    listen(target: GroupBatchingEventEmittier, eventName: string, handler: (...args: any[]) => void): void {
        target.on(eventName, handler, this);
        this.addCleanup(() => target.off(eventName, handler, this));
    }

    // registers work to do when the view is disposed
    addCleanup(cleanup: () => void): void {
        this.cleanups.push(cleanup);
    }

    // for model listeners: updates now if the view is showing; views update
    // in onShow, so a hidden view catches up when it's next shown
    requestUpdate(): void {
        if (this.shown)
            this.update();
    }

    dispose(): void {
        if (this.disposed)
            return;

        this.disposed = true;
        this.onDispose();
        for (const cleanup of this.cleanups.splice(0))
            cleanup();
        this.element?.remove();
        this.element = null;
        this.bodyElement = null;
    }

    focus(): void {
        if (this.element === null)
            return;

        // views without focusable content take focus on the view itself, so
        // its label is still announced
        const target = findInitialFocus(this.element) || this.element;
        target.focus();
    }

    createToolbarButton(): HTMLButtonElement {
        return h('button', {
            class: 'aux-toolbar-button',
            type: 'button',
            'data-aux-view': this.id,
            'aria-label': this.title,
            title: this.title,
        }, this.createIcon('aux-toolbar-icon'));
    }

    createPanelElement(): HTMLElement {
        this.disposed = false;

        if (this.element !== null)
            return this.element;

        const panelView = h('section', {
            class: 'aux-panel-view',
            'data-aux-view': this.id,
            role: 'group',
            'aria-label': this.title,
            tabindex: '-1',
        });
        this.element = panelView;
        this.render();
        if (this.bodyElement !== null)
            panelView.replaceChildren(this.bodyElement);
        this.onMount();
        return panelView;
    }
}
