import interactionManager, { keyTips, type FocusLoop } from '../../common/interactionmanager';
import type { AuxView, AuxViewId } from './types';

export default class AuxToolbar {
    element: HTMLDivElement;
    loop: FocusLoop;
    buttons = new Map<AuxViewId, HTMLButtonElement>();
    onToggleView: ((view: AuxViewId) => void) | null = null;
    pressedView: AuxViewId | null = null;
    pressedPointerId: number | null = null;
    dragStartX = 0;
    dragStartY = 0;
    reorderActive = false;
    suppressClickView: AuxViewId | null = null;
    dropTargetView: AuxViewId | null = null;
    dropBeforeTarget = true;
    dragGhost: HTMLDivElement | null = null;
    dragGhostOffsetX = 0;
    dragGhostOffsetY = 0;
    dropAllowed = true;

    constructor(views: AuxView[]) {
        this.element = document.createElement('div');
        this.element.id = 'aux-toolbar';
        this.element.setAttribute('role', 'toolbar');
        this.element.setAttribute('aria-label', 'Assistance panel toolbar');
        this.element.tabIndex = -1;
        this.loop = interactionManager.registerLoop(this.element, { level: 1 });
        keyTips.register(this.element, {
            key: 'T',
            maintainAccessibility: true,
            action: () => this.focus(),
            position: { x: '50%', y: '12px' }
        });

        for (const view of views) {
            const button = view.createToolbarButton();
            button.dataset.auxView = view.id;
            button.addEventListener('click', event => this.handleClick(event, view.id));
            button.addEventListener('pointerdown', event => this.handlePointerDown(event, view.id));
            button.addEventListener('pointermove', event => this.handlePointerMove(event));
            button.addEventListener('pointerup', event => this.handlePointerUp(event));
            button.addEventListener('pointercancel', event => this.handlePointerUp(event));
            this.element.append(button);
            this.buttons.set(view.id, button);
        }
    }

    handleClick(event: MouseEvent, view: AuxViewId) {
        if (this.suppressClickView === view) {
            event.preventDefault();
            this.suppressClickView = null;
            return;
        }

        this.onToggleView?.(view);
    }

    handlePointerDown(event: PointerEvent, view: AuxViewId) {
        if (event.button !== 0)
            return;

        this.pressedView = view;
        this.pressedPointerId = event.pointerId;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;
        this.reorderActive = false;

        const button = this.buttons.get(view);
        if (button) {
            const rect = button.getBoundingClientRect();
            this.dragGhostOffsetX = event.clientX - rect.left;
            this.dragGhostOffsetY = event.clientY - rect.top;
        }
        button?.setPointerCapture(event.pointerId);
    }

    ensureDragGhost(button: HTMLButtonElement) {
        if (this.dragGhost)
            return;

        const ghost = button.cloneNode(true) as HTMLDivElement;
        ghost.classList.add('aux-toolbar-button-ghost');
        ghost.classList.remove('dragging', 'drop-before', 'drop-after', 'active');
        ghost.setAttribute('aria-hidden', 'true');
        document.body.append(ghost);
        this.dragGhost = ghost;
    }

    updateDragGhostPosition(clientX: number, clientY: number) {
        if ( ! this.dragGhost)
            return;

        this.dragGhost.style.left = `${ clientX - this.dragGhostOffsetX }px`;
        this.dragGhost.style.top = `${ clientY - this.dragGhostOffsetY }px`;
    }

    clearDragGhost() {
        this.dragGhost?.remove();
        this.dragGhost = null;
    }

    updateDragCursor(dropAllowed: boolean) {
        this.dropAllowed = dropAllowed;
        document.body.classList.add('aux-toolbar-reordering');
        document.body.classList.toggle('aux-toolbar-no-drop', dropAllowed === false);
    }

    clearDragCursor() {
        document.body.classList.remove('aux-toolbar-reordering', 'aux-toolbar-no-drop');
        this.dropAllowed = true;
    }

    handlePointerMove(event: PointerEvent) {
        if (this.pressedView === null || this.pressedPointerId !== event.pointerId)
            return;

        const draggingButton = this.buttons.get(this.pressedView);
        if ( ! draggingButton)
            return;

        const movedX = Math.abs(event.clientX - this.dragStartX);
        const movedY = Math.abs(event.clientY - this.dragStartY);
        if (this.reorderActive === false && movedX < 4 && movedY < 4)
            return;

        this.reorderActive = true;
        draggingButton.classList.add('dragging');
        this.element.classList.add('reordering');
        this.ensureDragGhost(draggingButton);
        this.updateDragGhostPosition(event.clientX, event.clientY);
        this.updateDragCursor(true);
        event.preventDefault();

        const toolbarRect = this.element.getBoundingClientRect();
        if (
            event.clientX < toolbarRect.left ||
            event.clientX > toolbarRect.right ||
            event.clientY < toolbarRect.top ||
            event.clientY > toolbarRect.bottom
        ) {
            this.updateDragCursor(false);
            this.clearDropIndicator();
            return;
        }

        this.updateDragCursor(true);

        const buttons = Array.from(this.element.querySelectorAll<HTMLButtonElement>('.aux-toolbar-button:not(.dragging)'));
        if (buttons.length === 0) {
            this.clearDropIndicator();
            return;
        }

        for (const button of buttons) {
            const rect = button.getBoundingClientRect();
            const threshold = rect.top + rect.height * 0.75;

            if (event.clientY < threshold) {
                this.showDropIndicator(button, true);
                return;
            }
        }

        const lastButton = buttons[buttons.length - 1];
        this.showDropIndicator(lastButton, false);
    }

    handlePointerUp(event: PointerEvent) {
        if (this.pressedView === null || this.pressedPointerId !== event.pointerId)
            return;

        const pressedView = this.pressedView;
        const button = this.buttons.get(pressedView);
        if (button?.hasPointerCapture(event.pointerId))
            button.releasePointerCapture(event.pointerId);

        if (this.reorderActive) {
            button?.classList.remove('dragging');
            this.element.classList.remove('reordering');
            this.applyDropReorder();
            this.clearDropIndicator();
            this.clearDragGhost();
            this.clearDragCursor();
            this.suppressClickView = pressedView;
        }
        else {
            this.element.classList.remove('reordering');
            this.clearDragGhost();
            this.clearDragCursor();
        }

        this.pressedView = null;
        this.pressedPointerId = null;
        this.reorderActive = false;
    }

    contains(target: Node) {
        return this.element.contains(target);
    }

    focus(view: AuxViewId | null = null) {
        const button = (view && this.buttons.get(view)) || this.element.querySelector<HTMLButtonElement>('.aux-toolbar-button');
        if (button)
            button.focus();
        else
            this.element.focus();
    }

    clearDropIndicator() {
        this.dropTargetView = null;
        this.dropBeforeTarget = true;
        this.buttons.forEach(button => {
            button.classList.remove('drop-before', 'drop-after');
        });
    }

    showDropIndicator(targetButton: HTMLButtonElement, beforeTarget: boolean) {
        this.clearDropIndicator();

        const targetView = targetButton.dataset.auxView as AuxViewId | undefined;
        if ( ! targetView)
            return;

        this.dropTargetView = targetView;
        this.dropBeforeTarget = beforeTarget;
        targetButton.classList.add(beforeTarget ? 'drop-before' : 'drop-after');
    }

    applyDropReorder() {
        if (this.pressedView === null || this.dropTargetView === null)
            return;

        const draggingButton = this.buttons.get(this.pressedView);
        const targetButton = this.buttons.get(this.dropTargetView);
        if ( ! draggingButton || ! targetButton || draggingButton === targetButton)
            return;

        if (this.dropBeforeTarget)
            this.element.insertBefore(draggingButton, targetButton);
        else
            this.element.insertBefore(draggingButton, targetButton.nextSibling);
    }

    setActiveView(view: AuxViewId | null, visible: boolean) {
        this.buttons.forEach((button, buttonView) => {
            const selected = visible && buttonView === view;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
    }
}
