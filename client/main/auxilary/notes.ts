import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createNotesAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'notes',
        t('Notes'),
        'Note',
        `
            <h2>${ t('Comments and Notes') }</h2>
            <p>${ t('A lightweight scratchpad tied to the current analysis or output section.') }</p>
            <div class="aux-panel-placeholder">${ t('Add interpretation notes, reminders, or teaching commentary alongside the workflow.') }</div>
        `,
    );
}
