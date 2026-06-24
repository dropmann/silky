import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createAssistantAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'assistant',
        t('Assistant'),
        'AI',
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
