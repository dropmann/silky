import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class DataQualityAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('data-quality', t);
    }
    getTitle() { return this.t('Data Quality Checks'); }
    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3 19 6v5c0 4.5-2.7 7.5-7 10-4.3-2.5-7-5.5-7-10V6z" />
                <path d="m9.5 12 1.8 1.8 3.7-4.1" />
            </svg>
        `; }
    getBody() { return this.createBodyElement(`
            <h2>${ this.t('Data Quality') }</h2>
            <p>${ this.t('Quick checks for missingness, outliers, constants, and suspicious structure.') }</p>
            <div class="aux-panel-grid">
                <div class="aux-panel-stat"><span>${ this.t('Outliers') }</span><strong>3</strong></div>
                <div class="aux-panel-stat"><span>${ this.t('Constants') }</span><strong>1</strong></div>
                <div class="aux-panel-stat"><span>${ this.t('Duplicates') }</span><strong>0</strong></div>
                <div class="aux-panel-stat"><span>${ this.t('High NA') }</span><strong>2</strong></div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('This would help users spot problems before analysis.') }</div>
        `); }
}
