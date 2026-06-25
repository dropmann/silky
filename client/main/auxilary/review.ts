import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createReviewAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'review',
        t('Collaboration and Review'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="4" width="12" height="16" rx="2" />
                <path d="M9 8h6" />
                <path d="M9 12h6" />
                <path d="m9.5 16 1.5 1.5 3.5-3.5" />
            </svg>
        `,
        `
            <h2>${ t('Collaboration and Review') }</h2>
            <p>${ t('Shared comments, teaching prompts, or review flags for results.') }</p>
            <div class="aux-panel-placeholder">${ t('This is more speculative, but it gives a place for collaboration-oriented tooling later.') }</div>
        `,
    );
}
