import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createNotesAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'notes',
        t('Comments and Notes'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 4h8l4 4v12H7z" />
                <path d="M15 4v4h4" />
                <path d="M10 13h6" />
                <path d="M10 17h4" />
            </svg>
        `,
        `
            <h2>${ t('Comments and Notes') }</h2>
            <p>${ t('A lightweight scratchpad tied to the current analysis or output section.') }</p>
            <div class="aux-panel-placeholder">${ t('Add interpretation notes, reminders, or teaching commentary alongside the workflow.') }</div>
        `,
    );
}
