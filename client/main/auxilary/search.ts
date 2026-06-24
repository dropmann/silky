import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createSearchAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'search',
        t('Search'),
        'Go',
        `
            <h2>${ t('Search') }</h2>
            <p>${ t('One place to search analyses, options, variables, results, and help content.') }</p>
            <div class="aux-panel-placeholder">
                <div class="aux-panel-kicker">${ t('Example searches') }</div>
                <p>${ t('Find "normality", jump to "Descriptives", locate variable "age", or search results headings.') }</p>
            </div>
        `,
    );
}
