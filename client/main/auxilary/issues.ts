import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createIssuesAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'issues',
        t('Issues and Diagnostics'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4 21 20H3Z" />
                <path d="M12 9v5" />
                <circle cx="12" cy="17" r="1" data-fill="currentColor" />
            </svg>
        `,
        `
            <h2>${ t('Issues and Diagnostics') }</h2>
            <p>${ t('Central place for warnings, invalid states, and failed output checks.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('2 variables contain high missingness') }</div>
                <div class="aux-panel-list-item">${ t('One analysis has hidden output warnings') }</div>
                <div class="aux-panel-list-item">${ t('A filter is reducing the visible sample') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('This could become the main place to surface actionable problems.') }</div>
        `,
    );
}
