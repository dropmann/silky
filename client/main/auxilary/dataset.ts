import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createDatasetAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'dataset',
        t('Dataset Overview'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="5" width="16" height="14" rx="2" />
                <path d="M4 10h16" />
                <path d="M10 5v14" />
            </svg>
        `,
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
