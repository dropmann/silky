import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createDataQualityAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'data-quality',
        t('Data Quality'),
        'DQ',
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
