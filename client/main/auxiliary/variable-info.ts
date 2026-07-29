import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class VariableInfoAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('variable-info', t);
    }

    getTitle() {
        return this.t('Variable Details');
    }

    getIconSvg() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="6" width="16" height="12" rx="3" />
                <path d="M8 10h8" />
                <path d="M8 14h5" />
            </svg>
        `;
    }

    getBody() {
        return this.createBodyElement(`
            <h2>${ this.t('Selection and Variable Info') }</h2>
            <p>${ this.t('Details for the current variable, selection, or focused cell range.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ this.t('Variable: mood_score') }</div>
                <div class="aux-panel-list-item">${ this.t('Measure type: Continuous') }</div>
                <div class="aux-panel-list-item">${ this.t('Missing values: 12') }</div>
                <div class="aux-panel-list-item">${ this.t('Active role: Dependent / selected') }</div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('Useful for teaching, quick inspection, and understanding what is currently selected.') }</div>
        `);
    }
}
