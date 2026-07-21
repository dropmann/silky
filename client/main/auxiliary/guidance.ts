import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class GuidanceAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('guidance', t);
    }

    getTitle() { return this.t('Tasks and Guidance'); }

    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 19c0-6 4-6 4-10a2 2 0 1 1 4 0c0 4 4 4 4 10" />
                <path d="M6 19h12" />
                <path d="M12 5V3" />
            </svg>
        `; }

    getBody() { return this.createBodyElement(`
            <h2>${ this.t('Tasks and Guidance') }</h2>
            <p>${ this.t('Step-based workflows for common goals.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ this.t('Prepare a data set') }</div>
                <div class="aux-panel-list-item">${ this.t('Run a t-test') }</div>
                <div class="aux-panel-list-item">${ this.t('Check assumptions') }</div>
                <div class="aux-panel-list-item">${ this.t('Interpret effect sizes') }</div>
            </div>
            <div class="aux-panel-placeholder">${ this.t('This is more workflow coaching than static help.') }</div>
        `); }
}
