import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createAnalysisAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'analysis',
        t('Analysis'),
        'Ana',
        `
            <h2>${ t('Analysis Inspector') }</h2>
            <p>${ t('Metadata and state for the currently selected analysis.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Module: jmv') }</div>
                <div class="aux-panel-list-item">${ t('Analysis: Descriptives') }</div>
                <div class="aux-panel-list-item">${ t('Assigned variables: 4') }</div>
                <div class="aux-panel-list-item">${ t('Non-default options: 6') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('This could also show warnings, dependencies, and what changed from defaults.') }</div>
        `,
    );
}
