import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createVariableInfoAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'variable-info',
        t('Variable Info'),
        'Var',
        `
            <h2>${ t('Selection and Variable Info') }</h2>
            <p>${ t('Details for the current variable, selection, or focused cell range.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Variable: mood_score') }</div>
                <div class="aux-panel-list-item">${ t('Measure type: Continuous') }</div>
                <div class="aux-panel-list-item">${ t('Missing values: 12') }</div>
                <div class="aux-panel-list-item">${ t('Active role: Dependent / selected') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('Useful for teaching, quick inspection, and understanding what is currently selected.') }</div>
        `,
    );
}
