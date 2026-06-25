import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class ModulesAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('modules', t);
    }

    getTitle() { return this.t('Module Library'); }

    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="4" width="6" height="6" rx="1" />
                <rect x="14" y="4" width="6" height="6" rx="1" />
                <rect x="4" y="14" width="6" height="6" rx="1" />
                <path d="M17 13v8" />
                <path d="M13 17h8" />
            </svg>
        `; }

    getBody() { return this.createBodyElement(`
            <h2>${ this.t('Module Library') }</h2>
            <p>${ this.t('Installed modules, suggested analyses, and discovery of related tools.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ this.t('Installed: jmv, Rj, scatr') }</div>
                <div class="aux-panel-list-item">${ this.t('Suggested next: Reliability') }</div>
                <div class="aux-panel-list-item">${ this.t('Suggested next: Linear Regression') }</div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('Could bridge between current context and module discovery.') }</div>
        `); }
}
