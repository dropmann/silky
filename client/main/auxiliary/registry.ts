import AnalysisAuxView from './analysis';
import AssistantAuxView from './assistant';
import DataQualityAuxView from './data-quality';
import DatasetAuxView from './dataset';
import datasetSummaryExtensionEntry from './entries/dataset-summary-extension';
import GuidanceAuxView from './guidance';
import HelpAuxView from './help';
import HistoryAuxView from './history';
import IssuesAuxView from './issues';
import modulesEntry from './entries/modules';
import NotesAuxView from './notes';
import OutputNavAuxView from './output-nav';
import ResultsTocAuxView from './results-toc';
import ReviewAuxView from './review';
import SearchAuxView from './search';
import TransformsAuxView from './transforms';
import VariableInfoAuxView from './variable-info';
import type Instance from '../instance';
import type Selection from '../selection';
import type { AuxEntry, AuxView } from './types';

const createEntry = (
    id: AuxEntry['id'],
    order: number,
    create: AuxEntry['create'],
): AuxEntry => ({
    id,
    order,
    create,
});

export const auxEntries: AuxEntry[] = [
    createEntry('assistant', 10, () => new AssistantAuxView()),
    createEntry('results-toc', 20, ({ instance }) => new ResultsTocAuxView(instance)),
    createEntry('dataset', 30, ({ instance }) => new DatasetAuxView(instance)),
    datasetSummaryExtensionEntry,
    createEntry('analysis', 40, ({ instance }) => new AnalysisAuxView(instance)),
    createEntry('help', 50, () => new HelpAuxView()),
    createEntry('variable-info', 60, () => new VariableInfoAuxView()),
    createEntry('issues', 70, () => new IssuesAuxView()),
    createEntry('history', 80, () => new HistoryAuxView()),
    createEntry('search', 90, () => new SearchAuxView()),
    createEntry('notes', 100, () => new NotesAuxView()),
    createEntry('output-nav', 110, () => new OutputNavAuxView()),
    createEntry('data-quality', 120, () => new DataQualityAuxView()),
    createEntry('transforms', 130, () => new TransformsAuxView()),
    modulesEntry,
    createEntry('guidance', 150, () => new GuidanceAuxView()),
    createEntry('review', 160, () => new ReviewAuxView()),
];

export function createAuxViews(instance: Instance, selection: Selection): AuxView[] {
    const context = { instance, selection };
    const ids = new Set<string>();
    return auxEntries
        .slice()
        .sort((left, right) => left.order - right.order)
        .filter(entry => {
            // ids key the toolbar, panel and their state, so they must be unique
            if (ids.has(entry.id)) {
                console.error(`Aux entry '${ entry.id }' is registered more than once; only the first is used.`);
                return false;
            }
            ids.add(entry.id);
            return true;
        })
        .map(entry => entry.create(context));
}
