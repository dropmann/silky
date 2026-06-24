import type { AuxView, AuxViewId } from './types';

export default class AuxToolbar {
    element: HTMLDivElement;
    buttons = new Map<AuxViewId, HTMLButtonElement>();
    onToggleView: ((view: AuxViewId) => void) | null = null;

    constructor(views: AuxView[]) {
        this.element = document.createElement('div');
        this.element.id = 'aux-toolbar';
        this.element.setAttribute('role', 'toolbar');
        this.element.setAttribute('aria-label', 'Assistance panel toolbar');

        for (const view of views) {
            const button = view.createToolbarButton();
            button.addEventListener('click', () => this.onToggleView?.(view.id));
            this.element.append(button);
            this.buttons.set(view.id, button);
        }
    }

    contains(target: Node) {
        return this.element.contains(target);
    }

    setActiveView(view: AuxViewId | null, visible: boolean) {
        this.buttons.forEach((button, buttonView) => {
            const selected = visible && buttonView === view;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
    }
}
