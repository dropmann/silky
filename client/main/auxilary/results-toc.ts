import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createResultsTocAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'results-toc',
        t('Results TOC'),
        'TOC',
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
