import type { AuxSide, AuxView, AuxViewId } from './types';

export default class AuxPanel {
    element: HTMLElement;
    resizeHandle: HTMLDivElement;
    titleElement: HTMLDivElement;
    pinButton: HTMLButtonElement;
    sideButton: HTMLButtonElement;
    closeButton: HTMLButtonElement;
    viewElements = new Map<AuxViewId, HTMLElement>();
    onTogglePinned: (() => void) | null = null;
    onToggleSide: (() => void) | null = null;
    onClose: (() => void) | null = null;
    onResizeStart: ((event: PointerEvent) => void) | null = null;
    onResizeMove: ((event: PointerEvent) => void) | null = null;
    onResizeEnd: ((event: PointerEvent) => void) | null = null;

    constructor(views: AuxView[]) {
        this.element = document.createElement('aside');
        this.element.id = 'aux-panel';
        this.element.setAttribute('role', 'complementary');
        this.element.setAttribute('aria-label', 'Assistance panel');
        this.element.tabIndex = -1;

        this.resizeHandle = document.createElement('div');
        this.resizeHandle.id = 'aux-panel-resize';
        this.resizeHandle.setAttribute('role', 'separator');
        this.resizeHandle.setAttribute('aria-label', 'Resize assistance panel');

        const header = document.createElement('div');
        header.id = 'aux-panel-header';

        this.titleElement = document.createElement('div');
        this.titleElement.id = 'aux-panel-title';
        this.titleElement.textContent = 'Assistant';

        const actions = document.createElement('div');
        actions.id = 'aux-panel-actions';

        this.pinButton = document.createElement('button');
        this.pinButton.className = 'aux-panel-action';
        this.pinButton.type = 'button';

        this.sideButton = document.createElement('button');
        this.sideButton.className = 'aux-panel-action';
        this.sideButton.type = 'button';

        this.closeButton = document.createElement('button');
        this.closeButton.className = 'aux-panel-action';
        this.closeButton.type = 'button';
        this.closeButton.setAttribute('aria-label', 'Close panel');
        this.closeButton.textContent = 'X';

        actions.append(this.pinButton, this.sideButton, this.closeButton);
        header.append(this.titleElement, actions);

        const body = document.createElement('div');
        body.id = 'aux-panel-body';

        for (const view of views) {
            const element = view.createPanelElement();
            body.append(element);
            this.viewElements.set(view.id, element);
        }

        this.element.append(this.resizeHandle, header, body);

        this.pinButton.addEventListener('click', () => this.onTogglePinned?.());
        this.sideButton.addEventListener('click', () => this.onToggleSide?.());
        this.closeButton.addEventListener('click', () => this.onClose?.());

        this.resizeHandle.addEventListener('pointerdown', event => this.onResizeStart?.(event));
        this.resizeHandle.addEventListener('pointermove', event => this.onResizeMove?.(event));
        ['pointerup', 'pointercancel'].forEach(eventName => {
            this.resizeHandle.addEventListener(eventName, event => this.onResizeEnd?.(event as PointerEvent));
        });
    }

    contains(target: Node) {
        return this.element.contains(target);
    }

    focus() {
        this.element.focus();
    }

    setAriaHidden(hidden: boolean) {
        this.element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    }

    setTitle(title: string) {
        this.titleElement.textContent = title;
    }

    setPinned(pinned: boolean) {
        this.pinButton.textContent = pinned ? 'Float' : 'Pin';
        this.pinButton.setAttribute('aria-label', pinned ? 'Use overlay panel' : 'Pin panel');
    }

    setSide(side: AuxSide) {
        this.sideButton.textContent = side === 'right' ? 'Left' : 'Right';
        this.sideButton.setAttribute('aria-label', side === 'right' ? 'Move panel to left side' : 'Move panel to right side');
    }

    setActiveView(view: AuxViewId | null) {
        this.viewElements.forEach((element, elementView) => {
            element.classList.toggle('active', elementView === view);
        });
    }
}
