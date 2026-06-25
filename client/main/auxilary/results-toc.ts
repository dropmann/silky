import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createResultsTocAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'results-toc',
        t('Results Table of Contents'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 7h11" />
                <path d="M8 12h11" />
                <path d="M8 17h11" />
                <circle cx="4.5" cy="7" r="1" data-fill="currentColor" />
                <circle cx="4.5" cy="12" r="1" data-fill="currentColor" />
                <circle cx="4.5" cy="17" r="1" data-fill="currentColor" />
            </svg>
        `,
        `
            <h2>${ t('Results Table of Contents') }</h2>
            <p>${ t('A navigation outline for the current results document.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Descriptives') }</div>
                <div class="aux-panel-list-item">${ t('Assumption Checks') }</div>
                <div class="aux-panel-list-item">${ t('Plots') }</div>
                <div class="aux-panel-list-item">${ t('Notes and Annotations') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('This view could support jump-to-section, highlight current result, and bookmarks.') }</div>
        `,
    );
}
