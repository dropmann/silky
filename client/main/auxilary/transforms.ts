import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createTransformsAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'transforms',
        t('Transforms'),
        'Fx',
        `
            <h2>${ t('Transforms and Filters') }</h2>
            <p>${ t('Overview of active filters, computed variables, recodes, and weights.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Filter: complete_cases') }</div>
                <div class="aux-panel-list-item">${ t('Computed: bmi_group') }</div>
                <div class="aux-panel-list-item">${ t('Weight: survey_weight') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('A good operational view when users need to understand how the data is being shaped.') }</div>
        `,
    );
}
