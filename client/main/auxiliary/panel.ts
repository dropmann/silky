import interactionManager, { keyTips, type FocusLoop } from '../../common/interactionmanager';
import type { AuxSide, AuxView, AuxViewId } from './types';

export default class AuxPanel {
    element: HTMLElement;
    loop: FocusLoop;
    resizeHandle: HTMLDivElement;
    titleElement: HTMLDivElement;
    pinButton: HTMLButtonElement;
    sideButton: HTMLButtonElement;
    closeButton: HTMLButtonElement;
    viewElements = new Map<AuxViewId, HTMLElement>();
    activeView: AuxViewId | null = null;
    onTogglePinned: (() => void) | null = null;
    onToggleSide: (() => void) | null = null;
    onClose: (() => void) | null = null;
    onResizeStart: ((event: PointerEvent) => void) | null = null;
    onResizeMove: ((event: PointerEvent) => void) | null = null;
    onResizeEnd: ((event: PointerEvent) => void) | null = null;

    createActionIcon(svg: string) {
        const icon = document.createElement('div');
        icon.className = 'aux-panel-action-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = svg;
        return icon;
    }

    createDockSideIcon(side: AuxSide) {
        return this.createActionIcon(side === 'left' ? `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4.5" y="5.5" width="15" height="13" rx="2" />
                <path d="M9 5.5v13" />
                <path d="M6.5 8.5h.01" />
                <path d="M6.5 11.5h.01" />
                <path d="M6.5 14.5h.01" />
            </svg>
        ` : `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4.5" y="5.5" width="15" height="13" rx="2" />
                <path d="M15 5.5v13" />
                <path d="M17.5 8.5h.01" />
                <path d="M17.5 11.5h.01" />
                <path d="M17.5 14.5h.01" />
            </svg>
        `);
    }

    constructor(views: AuxView[]) {
        this.element = document.createElement('aside');
        this.element.id = 'aux-panel';
        this.element.setAttribute('role', 'complementary');
        this.element.setAttribute('aria-label', 'Assistance panel');
        this.element.tabIndex = -1;
        this.loop = interactionManager.registerLoop(this.element);
        keyTips.register(this.element, {
            key: 'X',
            maintainAccessibility: true,
            action: () => this.focus(),
            position: { x: '50%', y: '12px' }
        });

        this.resizeHandle = document.createElement('div');
        this.resizeHandle.id = 'aux-panel-resize';
        this.resizeHandle.setAttribute('role', 'separator');
        this.resizeHandle.setAttribute('aria-label', 'Resize assistance panel');
        this.resizeHandle.title = 'Resize assistance panel';

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
        this.pinButton.append(this.createActionIcon(`
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 4h8" />
                <path d="M9 4v5l-3 4h12l-3-4V4" />
                <path d="M12 13v7" />
            </svg>
        `));

        this.sideButton = document.createElement('button');
        this.sideButton.className = 'aux-panel-action';
        this.sideButton.type = 'button';
        this.sideButton.append(this.createDockSideIcon('left'));

        this.closeButton = document.createElement('button');
        this.closeButton.className = 'aux-panel-action';
        this.closeButton.type = 'button';
        this.closeButton.setAttribute('aria-label', 'Close panel');
        this.closeButton.title = 'Close panel';
        this.closeButton.append(this.createActionIcon(`
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7 7 10 10" />
                <path d="m17 7-10 10" />
            </svg>
        `));

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
        if (this.activeView !== null) {
            const view = this.viewElements.get(this.activeView);
            if (view) {
                view.focus();
                return;
            }
        }

        this.element.focus();
    }

    setAriaHidden(hidden: boolean) {
        this.element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    }

    setTitle(title: string) {
        this.titleElement.textContent = title;
    }

    setPinned(pinned: boolean) {
        const label = pinned ? 'Use overlay panel' : 'Pin panel';
        this.pinButton.setAttribute('aria-label', label);
        this.pinButton.title = label;
        this.pinButton.classList.toggle('active', pinned);
        this.pinButton.replaceChildren(this.createActionIcon(pinned ? `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="6" width="14" height="12" rx="2" />
                <path d="M9 10h6" />
                <path d="M9 14h6" />
            </svg>
        ` : `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 4h8" />
                <path d="M9 4v5l-3 4h12l-3-4V4" />
                <path d="M12 13v7" />
            </svg>
        `));
    }

    setSide(side: AuxSide) {
        const targetSide = side === 'right' ? 'left' : 'right';
        const label = targetSide === 'left' ? 'Move panel to left side' : 'Move panel to right side';
        this.sideButton.setAttribute('aria-label', label);
        this.sideButton.title = label;
        this.sideButton.replaceChildren(this.createDockSideIcon(targetSide));
    }

    setActiveView(view: AuxViewId | null) {
        this.activeView = view;
        this.viewElements.forEach((element, elementView) => {
            const active = elementView === view;
            element.classList.toggle('active', active);
            element.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
    }
}
