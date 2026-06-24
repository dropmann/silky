import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createReviewAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'review',
        t('Review'),
        'Rev',
        `
            <h2>${ t('Collaboration and Review') }</h2>
            <p>${ t('Shared comments, teaching prompts, or review flags for results.') }</p>
            <div class="aux-panel-placeholder">${ t('This is more speculative, but it gives a place for collaboration-oriented tooling later.') }</div>
        `,
    );
}
