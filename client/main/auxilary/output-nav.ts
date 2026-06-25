import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createOutputNavAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'output-nav',
        t('Output Navigator'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 7h10" />
                <path d="M5 12h14" />
                <path d="M5 17h8" />
                <path d="m15 15 4-3-4-3" />
            </svg>
        `,
        `
            <h2>${ t('Output Navigator') }</h2>
            <p>${ t('Bookmarks, recently viewed sections, and important results.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Starred: Descriptive Statistics') }</div>
                <div class="aux-panel-list-item">${ t('Recent: Histogram') }</div>
                <div class="aux-panel-list-item">${ t('Recent: QQ Plot') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('Related to TOC, but more about personal navigation and curation.') }</div>
        `,
    );
}
