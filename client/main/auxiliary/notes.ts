import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class NotesAuxView extends AuxView {
    constructor(t: AuxTranslate) {
        super('notes', t);
    }

    getTitle() { return this.t('Comments and Notes'); }

    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 4h8l4 4v12H7z" />
                <path d="M15 4v4h4" />
                <path d="M10 13h6" />
                <path d="M10 17h4" />
            </svg>
        `; }

    getBody() { return this.createBodyElement(`
            <h2>${ this.t('Comments and Notes') }</h2>
            <p>${ this.t('A lightweight scratchpad tied to the current analysis or output section.') }</p>
            <div class="aux-panel-placeholder">${ this.t('Add interpretation notes, reminders, or teaching commentary alongside the workflow.') }</div>
        `); }
}
