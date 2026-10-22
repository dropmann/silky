import { h } from '../../common/htmlelementcreator';
import { AuxView } from './types';

export default class HelpAuxView extends AuxView {
    constructor() {
        super('help');
    }

    getTitle() {
        return _('Jamovi Help');
    }

    getIconSvg() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.3-1.7 2.7" />
                <circle cx="12" cy="17.5" r="1" data-fill="currentColor" />
                <circle cx="12" cy="12" r="9" />
            </svg>
        `;
    }

    getBody() {
        return this.createBodyElement(
            h('h2', {}, _('Help')),
            h('p', {}, _('General jamovi guidance, shortcuts, and searchable help topics.')),
            h('div', { class: 'aux-panel-list' },
                h('div', { class: 'aux-panel-list-item' }, _('Getting started with analyses')),
                h('div', { class: 'aux-panel-list-item' }, _('Keyboard shortcuts')),
                h('div', { class: 'aux-panel-list-item' }, _('Importing and cleaning data')),
            ),
            h('div', { class: 'aux-panel-placeholder' }, _('This is the broad support view for workflow tips and documentation entry points.')),
        );
    }
}
