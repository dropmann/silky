import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class OutputNavAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('output-nav', t);
    }

    getTitle() { return this.t('Output Navigator'); }

    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 7h10" />
                <path d="M5 12h14" />
                <path d="M5 17h8" />
                <path d="m15 15 4-3-4-3" />
            </svg>
        `; }

    getBody() { return this.createBodyElement(`
            <h2>${ this.t('Output Navigator') }</h2>
            <p>${ this.t('Bookmarks, recently viewed sections, and important results.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ this.t('Starred: Descriptive Statistics') }</div>
                <div class="aux-panel-list-item">${ this.t('Recent: Histogram') }</div>
                <div class="aux-panel-list-item">${ this.t('Recent: QQ Plot') }</div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('Related to TOC, but more about personal navigation and curation.') }</div>
        `); }
}
