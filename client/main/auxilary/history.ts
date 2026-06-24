import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createHistoryAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'history',
        t('History'),
        'Hist',
        `
            <h2>${ t('History and Activity') }</h2>
            <p>${ t('Recent actions across analyses, options, and data work.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Opened Descriptives') }</div>
                <div class="aux-panel-list-item">${ t('Enabled skewness and kurtosis') }</div>
                <div class="aux-panel-list-item">${ t('Applied filter: complete_cases') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('Could help users retrace steps or review what changed recently.') }</div>
        `,
    );
}
