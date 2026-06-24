import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createModulesAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'modules',
        t('Modules'),
        'Mod',
        `
            <h2>${ t('Module Library') }</h2>
            <p>${ t('Installed modules, suggested analyses, and discovery of related tools.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Installed: jmv, Rj, scatr') }</div>
                <div class="aux-panel-list-item">${ t('Suggested next: Reliability') }</div>
                <div class="aux-panel-list-item">${ t('Suggested next: Linear Regression') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('Could bridge between current context and module discovery.') }</div>
        `,
    );
}
