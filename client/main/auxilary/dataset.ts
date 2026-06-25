import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class DatasetAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('dataset', t);
    }
    getTitle() { return this.t('Dataset Overview'); }
    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="5" width="16" height="14" rx="2" />
                <path d="M4 10h16" />
                <path d="M10 5v14" />
            </svg>
        `; }
    getBody() { return this.createBodyElement(`
            <h2>${ this.t('Dataset Overview') }</h2>
            <p>${ this.t('A compact status summary for the active data set.') }</p>
            <div class="aux-panel-grid">
                <div class="aux-panel-stat"><span>${ this.t('Rows') }</span><strong>1,248</strong></div>
                <div class="aux-panel-stat"><span>${ this.t('Columns') }</span><strong>32</strong></div>
                <div class="aux-panel-stat"><span>${ this.t('Missing') }</span><strong>4.6%</strong></div>
                <div class="aux-panel-stat"><span>${ this.t('Filters') }</span><strong>${ this.t('1 active') }</strong></div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('Good place for variable types, weights, transforms, and quick integrity summaries.') }</div>
        `); }
}
