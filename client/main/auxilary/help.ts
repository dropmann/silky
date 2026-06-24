import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createHelpAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'help',
        t('Help'),
        '?',
        `
            <h2>${ t('Help') }</h2>
            <p>${ t('General jamovi guidance, shortcuts, and searchable help topics.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Getting started with analyses') }</div>
                <div class="aux-panel-list-item">${ t('Keyboard shortcuts') }</div>
                <div class="aux-panel-list-item">${ t('Importing and cleaning data') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('This is the broad support view for workflow tips and documentation entry points.') }</div>
        `,
    );
}
