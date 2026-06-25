import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createAssistantAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'assistant',
        t('AI Assistant'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 9a5 5 0 0 1 10 0v3a5 5 0 0 1-5 5h-3l-3 3v-4a5 5 0 0 1-4-4V9a5 5 0 0 1 5-5" />
                <path d="M10 9.5h4" />
                <path d="M12 7.5v4" />
            </svg>
        `,
        `
            <h2>${ t('Assistant') }</h2>
            <p>${ t('Context-aware guidance for the active module, analysis, and currently focused option.') }</p>
            <div class="aux-panel-placeholder">
                <div class="aux-panel-kicker">${ t('Current context') }</div>
                <strong>${ t('Descriptives > Statistics') }</strong>
                <p>${ t('Explain what each option does, suggest next settings, and answer questions about the active analysis.') }</p>
            </div>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Summarise the selected analysis and current option choices.') }</div>
                <div class="aux-panel-list-item">${ t('Flag likely follow-up analyses or assumption checks.') }</div>
                <div class="aux-panel-list-item">${ t('Offer plain-language explanations for outputs and settings.') }</div>
            </div>
        `,
    );
}
