import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class SearchAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('search', t);
    }
    getTitle() { return this.t('Search'); }
    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="6" />
                <path d="m20 20-4.2-4.2" />
            </svg>
        `; }
    getBody() { return this.createBodyElement(`
            <h2>${ this.t('Search') }</h2>
            <p>${ this.t('One place to search analyses, options, variables, results, and help content.') }</p>
            <div class="aux-panel-placeholder">
                <div class="aux-panel-kicker">${ this.t('Example searches') }</div>
                <p>${ this.t('Find "normality", jump to "Descriptives", locate variable "age", or search results headings.') }</p>
            </div>
        `); }
}
