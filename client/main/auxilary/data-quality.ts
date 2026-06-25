import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createDataQualityAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'data-quality',
        t('Data Quality Checks'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3 19 6v5c0 4.5-2.7 7.5-7 10-4.3-2.5-7-5.5-7-10V6z" />
                <path d="m9.5 12 1.8 1.8 3.7-4.1" />
            </svg>
        `,
        `
            <h2>${ t('Data Quality') }</h2>
            <p>${ t('Quick checks for missingness, outliers, constants, and suspicious structure.') }</p>
            <div class="aux-panel-grid">
                <div class="aux-panel-stat"><span>${ t('Outliers') }</span><strong>3</strong></div>
                <div class="aux-panel-stat"><span>${ t('Constants') }</span><strong>1</strong></div>
                <div class="aux-panel-stat"><span>${ t('Duplicates') }</span><strong>0</strong></div>
                <div class="aux-panel-stat"><span>${ t('High NA') }</span><strong>2</strong></div>
            </div>
            <div class="aux-panel-placeholder">${ t('This would help users spot problems before analysis.') }</div>
        `,
    );
}
