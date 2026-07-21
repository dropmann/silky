import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class HelpAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('help', t);
    }

    getTitle() {
        return this.t('Jamovi Help');
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
        return this.createBodyElement(`
            <h2>${ this.t('Help') }</h2>
            <p>${ this.t('General jamovi guidance, shortcuts, and searchable help topics.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ this.t('Getting started with analyses') }</div>
                <div class="aux-panel-list-item">${ this.t('Keyboard shortcuts') }</div>
                <div class="aux-panel-list-item">${ this.t('Importing and cleaning data') }</div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('This is the broad support view for workflow tips and documentation entry points.') }</div>
        `);
    }
}
