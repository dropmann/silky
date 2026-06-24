import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createGuidanceAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'guidance',
        t('Guidance'),
        'How',
        `
            <h2>${ t('Tasks and Guidance') }</h2>
            <p>${ t('Step-based workflows for common goals.') }</p>
            <div class="aux-panel-list">
                <div class="aux-panel-list-item">${ t('Prepare a data set') }</div>
                <div class="aux-panel-list-item">${ t('Run a t-test') }</div>
                <div class="aux-panel-list-item">${ t('Check assumptions') }</div>
                <div class="aux-panel-list-item">${ t('Interpret effect sizes') }</div>
            </div>
            <div class="aux-panel-placeholder">${ t('This is more workflow coaching than static help.') }</div>
        `,
    );
}
