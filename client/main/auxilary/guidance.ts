import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default function createGuidanceAuxView(t: AuxTranslate): AuxView {
    return new AuxView(
        'guidance',
        t('Tasks and Guidance'),
        `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 19c0-6 4-6 4-10a2 2 0 1 1 4 0c0 4 4 4 4 10" />
                <path d="M6 19h12" />
                <path d="M12 5V3" />
            </svg>
        `,
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
