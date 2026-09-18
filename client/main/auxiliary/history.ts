import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class HistoryAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('history', t);
    }
    getTitle() { return this.t('Activity History'); }
    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12a8 8 0 1 0 2.3-5.7" />
                <path d="M4 5v4h4" />
                <path d="M12 8v5l3 2" />
            </svg>
        `; }
    getBody() { return this.createBodyElement(`
            <h2>${ this.t('History and Activity') }</h2>
            <p>${ this.t('Recent actions across analyses, options, and data work.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ this.t('Opened Descriptives') }</div>
                <div class="aux-panel-list-item">${ this.t('Enabled skewness and kurtosis') }</div>
                <div class="aux-panel-list-item">${ this.t('Applied filter: complete_cases') }</div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('Could help users retrace steps or review what changed recently.') }</div>
        `); }
}
