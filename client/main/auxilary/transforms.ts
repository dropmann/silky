import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class TransformsAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('transforms', t);
    }

    getTitle() {
        return this.t('Transforms and Filters');
    }

    getIconSvg() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 7h10l-3-3" />
                <path d="m17 7-3 3" />
                <path d="M17 17H7l3 3" />
                <path d="m7 17 3-3" />
            </svg>
        `;
    }

    getBody() {
        return this.createBodyElement(`
            <h2>${ this.t('Transforms and Filters') }</h2>
            <p>${ this.t('Overview of active filters, computed variables, recodes, and weights.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ this.t('Filter: complete_cases') }</div>
                <div class="aux-panel-list-item">${ this.t('Computed: bmi_group') }</div>
                <div class="aux-panel-list-item">${ this.t('Weight: survey_weight') }</div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('A good operational view when users need to understand how the data is being shaped.') }</div>
        `);
    }
}
