import type { SplitPanel } from '../splitpanel';
import AuxPanel from './panel';
import AuxToolbar from './toolbar';
import type { AuxPresentation, AuxSide, AuxView, AuxViewId, AuxViewSelection } from './types';

export default class AuxShell {
    splitPanel: SplitPanel;
    toolbar: AuxToolbar;
    panel: AuxPanel;
    views: AuxView[];
    viewMap: Map<AuxViewId, AuxView>;
    activeView: AuxViewSelection = null;
    presentation: AuxPresentation = 'hidden';
    side: AuxSide = 'right';
    pinned = false;
    width = 320;
    minWidth = 240;
    maxWidth = 640;
    resizing = false;
    resizeStartX = 0;
    resizeStartWidth = this.width;
    defaultTitle = 'Assistant';

    constructor(splitPanel: SplitPanel, views: AuxView[]) {
        this.splitPanel = splitPanel;
        this.views = views;
        this.viewMap = new Map(views.map(view => [view.id, view]));
        if (views.length > 0)
            this.defaultTitle = views[0].title;
        this.toolbar = new AuxToolbar(views);
        this.panel = new AuxPanel(views);

        this.toolbar.onToggleView = view => this.toggleView(view);
        this.panel.onTogglePinned = () => {
            if (this.activeView !== null)
                this.setState(this.activeView, this.pinned ? 'overlay' : 'docked');
        };
        this.panel.onToggleSide = () => {
            this.side = this.side === 'right' ? 'left' : 'right';
            this.setState(this.activeView, this.presentation);
        };
        this.panel.onClose = () => {
            if (this.activeView !== null)
                this.setState(this.activeView, 'hidden');
        };
        this.panel.onResizeStart = event => this.handleResizeStart(event);
        this.panel.onResizeMove = event => this.handleResizeMove(event);
        this.panel.onResizeEnd = event => this.handleResizeEnd(event);

        document.addEventListener('pointerdown', event => {
            const target = event.target as Node;
            if (this.presentation === 'overlay' && ! this.panel.contains(target) && ! this.toolbar.contains(target))
                this.closeOverlay();
        }, true);

        this.panel.element.addEventListener('focusout', () => {
            setTimeout(() => {
                if (this.presentation !== 'overlay')
                    return;

                const activeElement = document.activeElement;
                if (activeElement && (this.panel.contains(activeElement) || this.toolbar.contains(activeElement)))
                    return;

                this.closeOverlay();
            }, 0);
        });
    }

    mount() {
        this.splitPanel.append(this.toolbar.element, this.panel.element);
    }

    initialise(defaultView: AuxViewId) {
        this.applyWidth();
        this.setState(defaultView, 'hidden');
    }

    applyWidth() {
        this.splitPanel.style.setProperty('--aux-panel-width', `${ this.width }px`);
    }

    clampWidth(width: number) {
        const availableWidth = Math.max(this.minWidth, Math.min(this.maxWidth, Math.floor(window.innerWidth * 0.6)));
        return Math.max(this.minWidth, Math.min(availableWidth, width));
    }

    notifyLayoutChange(containerSpaceChanged: boolean) {
        void this.splitPanel.offsetWidth;
        if (containerSpaceChanged)
            this.splitPanel.onContainerSpaceChanged();
        else
            this.splitPanel.onTransitioning();
    }

    setState(view: AuxViewSelection, presentation: AuxPresentation) {
        const previousView = this.activeView;
        const previousPresentation = this.presentation;
        const previousSide = this.side;
        const previouslyShownView =
            previousPresentation === 'hidden' || previousView === null
                ? null
                : this.viewMap.get(previousView) || null;
        const nextShownView =
            presentation === 'hidden' || view === null
                ? null
                : this.viewMap.get(view) || null;

        this.activeView = view;
        this.presentation = presentation;
        if (presentation !== 'hidden')
            this.pinned = presentation === 'docked';

        const renderedView = presentation === 'hidden' ? 'none' : (view || 'none');
        this.splitPanel.dataset.auxPresentation = presentation;
        this.splitPanel.dataset.auxView = renderedView;
        this.splitPanel.dataset.auxSide = this.side;
        this.panel.setAriaHidden(presentation === 'hidden');

        nextShownView?.render();

        const title = view ? (this.viewMap.get(view)?.title || this.defaultTitle) : this.defaultTitle;
        this.panel.setTitle(title);
        this.panel.setPinned(this.pinned);
        this.panel.setSide(this.side);
        this.toolbar.setActiveView(view, presentation !== 'hidden');
        this.panel.setActiveView(view);

        if (previouslyShownView !== null && previouslyShownView !== nextShownView)
            previouslyShownView.onHide();

        if (nextShownView !== null && nextShownView !== previouslyShownView)
            nextShownView.onShow();

        const containerSpaceChanged =
            previousPresentation === 'docked' ||
            presentation === 'docked' ||
            (previousSide !== this.side && (previousPresentation === 'docked' || presentation === 'docked'));

        this.notifyLayoutChange(containerSpaceChanged);

        if (presentation !== 'hidden')
            setTimeout(() => this.panel.focus(), 0);
    }

    toggleView(view: AuxViewId) {
        if (this.activeView === view && this.presentation !== 'hidden') {
            this.setState(view, 'hidden');
            return;
        }

        this.setState(view, this.pinned ? 'docked' : 'overlay');
    }

    closeOverlay() {
        if (this.presentation === 'overlay')
            this.setState(this.activeView, 'hidden');
    }

    updateWidthFromPointer(clientX: number) {
        const delta = clientX - this.resizeStartX;
        let nextWidth = this.resizeStartWidth;

        if (this.side === 'right')
            nextWidth = this.resizeStartWidth - delta;
        else
            nextWidth = this.resizeStartWidth + delta;

        this.width = this.clampWidth(nextWidth);
        this.applyWidth();
        this.notifyLayoutChange(this.presentation === 'docked');
    }

    handleResizeStart(event: PointerEvent) {
        this.resizing = true;
        this.resizeStartX = event.clientX;
        this.resizeStartWidth = this.width;
        this.panel.resizeHandle.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    handleResizeMove(event: PointerEvent) {
        if (! this.resizing)
            return;

        this.updateWidthFromPointer(event.clientX);
    }

    handleResizeEnd(event: PointerEvent) {
        if (! this.resizing)
            return;

        this.resizing = false;
        this.panel.resizeHandle.releasePointerCapture(event.pointerId);
    }
}
