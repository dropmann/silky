import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createDatasetAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'dataset',
        t('Dataset'),
        'DS',
        `
            <h2>${ t('Dataset Overview') }</h2>
            <p>${ t('A compact status summary for the active data set.') }</p>
            <div class="aux-panel-grid">
                <div class="aux-panel-stat"><span>${ t('Rows') }</span><strong>1,248</strong></div>
                <div class="aux-panel-stat"><span>${ t('Columns') }</span><strong>32</strong></div>
                <div class="aux-panel-stat"><span>${ t('Missing') }</span><strong>4.6%</strong></div>
                <div class="aux-panel-stat"><span>${ t('Filters') }</span><strong>${ t('1 active') }</strong></div>
            </div>
            <div class="aux-panel-placeholder">${ t('Good place for variable types, weights, transforms, and quick integrity summaries.') }</div>
        `,
    );
}
