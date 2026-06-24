import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createOutputNavAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'output-nav',
        t('Output'),
        'Nav',
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
