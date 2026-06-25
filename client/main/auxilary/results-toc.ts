import type Instance from '../instance';
import type { Analysis } from '../analyses';
import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class ResultsTocAuxView extends AuxView {
    model: Instance;
    listElement: HTMLDivElement | null = null;
    emptyElement: HTMLDivElement | null = null;

    constructor(t: AuxTranslate, model: Instance) {
        super('results-toc', t);
        this.model = model;
    }

    getTitle() {
        return this.t('Results Table of Contents');
    }

    getIconSvg() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 7h11" />
                <path d="M8 12h11" />
                <path d="M8 17h11" />
                <circle cx="4.5" cy="7" r="1" data-fill="currentColor" />
                <circle cx="4.5" cy="12" r="1" data-fill="currentColor" />
                <circle cx="4.5" cy="17" r="1" data-fill="currentColor" />
            </svg>
        `;
    }

    getBody() {
        const body = document.createElement('div');

        const description = document.createElement('p');
        description.textContent = this.t('A navigation outline for the current results document.');

        const list = document.createElement('div');
        list.className = 'aux-panel-nav';

        const empty = document.createElement('div');
        empty.className = 'aux-panel-placeholder';
        empty.textContent = this.t('No analyses in the results yet.');

        body.append(description, list, empty);

        this.listElement = list;
        this.emptyElement = empty;

        return body;
    }

    onMount(): void {
        const analyses = this.model.analyses();
        analyses.on('analysisCreated', this.update, this);
        analyses.on('analysisDeleted', this.update, this);
        analyses.on('analysisResultsChanged', this.update, this);
        analyses.on('analysisHeadingChanged', this.update, this);
        this.model.on('change:selectedAnalysis', this.update, this);
        this.update();
    }

    onShow(): void {
        this.update();
    }

    update(): void {
        if (this.listElement === null || this.emptyElement === null)
            return;

        const analyses = [...this.model.analyses()].filter(analysis => analysis.name !== 'empty');
        const selectedAnalysis = this.model.get('selectedAnalysis');

        this.listElement.replaceChildren();

        for (const analysis of analyses) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'aux-panel-nav-item';
            button.textContent = this.getAnalysisLabel(analysis);
            button.title = button.textContent;
            button.classList.toggle('active', selectedAnalysis === analysis);
            button.addEventListener('click', () => {
                this.model.set('selectedAnalysis', analysis);
            });
            this.listElement.append(button);
        }

        this.emptyElement.style.display = analyses.length === 0 ? '' : 'none';
    }

    getAnalysisLabel(analysis: Analysis): string {
        if (analysis.options) {
            const heading = analysis.getHeading();
            if (heading)
                return heading;
        }

        if (analysis.results?.title)
            return analysis.results.title;

        return analysis.name;
    }
}
