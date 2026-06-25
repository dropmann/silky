import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createHistoryAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'history',
        t('Activity History'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12a8 8 0 1 0 2.3-5.7" />
                <path d="M4 5v4h4" />
                <path d="M12 8v5l3 2" />
            </svg>
        `,
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
