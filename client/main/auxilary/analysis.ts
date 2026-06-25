import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class AnalysisAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('analysis', t);
    }

    getTitle() {
        return this.t('Analysis Details');
    }

    getIconSvg() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 19V9" />
                <path d="M12 19V5" />
                <path d="M19 19v-7" />
                <path d="M3.5 19.5h17" />
            </svg>
        `;
    }

    getBody() {
        return this.createBodyElement(`
            <h2>${ this.t('Analysis Inspector') }</h2>
            <p>${ this.t('Metadata and state for the currently selected analysis.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ this.t('Module: jmv') }</div>
                <div class="aux-panel-list-item">${ this.t('Analysis: Descriptives') }</div>
                <div class="aux-panel-list-item">${ this.t('Assigned variables: 4') }</div>
                <div class="aux-panel-list-item">${ this.t('Non-default options: 6') }</div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('This could also show warnings, dependencies, and what changed from defaults.') }</div>
        `);
    }
}
