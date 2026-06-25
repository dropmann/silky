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

export class AuxView {
    id: AuxViewId;
    title: string;
    iconSvg: string;
    body: string;

    constructor(id: AuxViewId, title: string, iconSvg: string, body: string) {
        this.id = id;
        this.title = title;
        this.iconSvg = iconSvg;
        this.body = body;
    }

    createToolbarButton() {
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

    createPanelElement() {
        const panelView = document.createElement('section');
        panelView.className = 'aux-panel-view';
        panelView.setAttribute('data-aux-view', this.id);
        panelView.innerHTML = this.body;
        return panelView;
    }
}
