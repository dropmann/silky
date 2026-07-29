import type Instance from '../instance';
import { Analysis } from '../analyses';
import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class AnalysisAuxView extends AuxView {
    model: Instance;
    descriptionElement: HTMLParagraphElement | null = null;
    listElement: HTMLDivElement | null = null;
    stateElement: HTMLDivElement | null = null;

    constructor(t: AuxTranslate, model: Instance) {
        super('analysis', t);
        this.model = model;
    }

    getTitle() {
        return this.t('Analysis Details');
    }

    getIconSvg() {
        return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 19V9" />
                <path d="M12 19V5" />
                <path d="M19 19v-7" />
                <path d="M3.5 19.5h17" />
            </svg>
        `;
    }

    getBody() {
        const body = document.createElement('div');

        const description = document.createElement('p');
        description.textContent = this.t('Metadata and state for the currently selected analysis.');

        const list = document.createElement('div');
        list.className = 'aux-panel-list';

        const state = document.createElement('div');
        state.className = 'aux-panel-placeholder';

        body.append(description, list, state);

        this.descriptionElement = description;
        this.listElement = list;
        this.stateElement = state;

        return body;
    }

    onMount(): void {
        const analyses = this.model.analyses();
        analyses.on('analysisCreated', this.update, this);
        analyses.on('analysisDeleted', this.update, this);
        analyses.on('analysisResultsChanged', this.update, this);
        analyses.on('analysisHeadingChanged', this.update, this);
        analyses.on('analysisOptionsChanged', this.update, this);
        this.model.on('change:selectedAnalysis', this.update, this);
        this.update();
    }

    onShow(): void {
        this.update();
    }

    createListItem(text: string) {
        const item = document.createElement('div');
        item.className = 'aux-panel-list-item';
        item.textContent = text;
        return item;
    }

    update(): void {
        if (this.listElement === null || this.stateElement === null || this.descriptionElement === null)
            return;

        const selectedAnalysis = this.model.get('selectedAnalysis');
        if (! (selectedAnalysis instanceof Analysis)) {
            this.descriptionElement.textContent = this.t('Metadata and state for the currently selected analysis.');
            this.listElement.replaceChildren();
            this.stateElement.textContent = this.t('Select an analysis in the results or the TOC to inspect its details.');
            return;
        }

        const hasOptions = selectedAnalysis.options !== null;
        const heading = hasOptions ? selectedAnalysis.getHeading() : '';
        const analysisLabel = heading || selectedAnalysis.results?.title || selectedAnalysis.name;
        const assignedVariables = hasOptions ? selectedAnalysis.getUsingColumns().length : 0;
        const optionValues = hasOptions ? selectedAnalysis.options.getValues() : {};
        const optionNames = Object.keys(optionValues).filter(name => ! name.startsWith('results/'));
        const dependentCount = selectedAnalysis.dependents.length;

        this.descriptionElement.textContent = this.t('Metadata and state for the currently selected analysis.');
        this.listElement.replaceChildren(
            this.createListItem(this.t('Module: {module}', { module: selectedAnalysis.ns })),
            this.createListItem(this.t('Analysis: {analysis}', { analysis: analysisLabel })),
            this.createListItem(this.t('Assigned variables: {count}', { count: assignedVariables.toLocaleString() })),
            this.createListItem(this.t('Option values set: {count}', { count: optionNames.length.toLocaleString() })),
            this.createListItem(this.t('Dependent analyses: {count}', { count: dependentCount.toLocaleString() })),
        );

        this.stateElement.textContent = this.t(
            'Revision {revision}. Analysis is {enabledState}.',
            {
                revision: selectedAnalysis.revision.toLocaleString(),
                enabledState: selectedAnalysis.enabled ? this.t('enabled') : this.t('disabled'),
            }
        );
    }
}
