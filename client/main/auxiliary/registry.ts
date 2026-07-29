import AnalysisAuxView from './analysis';
import AssistantAuxView from './assistant';
import DataQualityAuxView from './data-quality';
import DatasetAuxView from './dataset';
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
import type { AuxEntry, AuxTranslate, AuxView } from './types';

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
    createEntry('assistant', 10, ({ t }) => new AssistantAuxView(t)),
    createEntry('results-toc', 20, ({ t, instance }) => new ResultsTocAuxView(t, instance)),
    createEntry('dataset', 30, ({ t, instance }) => new DatasetAuxView(t, instance)),
    createEntry('analysis', 40, ({ t, instance }) => new AnalysisAuxView(t, instance)),
    createEntry('help', 50, ({ t }) => new HelpAuxView(t)),
    createEntry('variable-info', 60, ({ t }) => new VariableInfoAuxView(t)),
    createEntry('issues', 70, ({ t }) => new IssuesAuxView(t)),
    createEntry('history', 80, ({ t }) => new HistoryAuxView(t)),
    createEntry('search', 90, ({ t }) => new SearchAuxView(t)),
    createEntry('notes', 100, ({ t }) => new NotesAuxView(t)),
    createEntry('output-nav', 110, ({ t }) => new OutputNavAuxView(t)),
    createEntry('data-quality', 120, ({ t }) => new DataQualityAuxView(t)),
    createEntry('transforms', 130, ({ t }) => new TransformsAuxView(t)),
    modulesEntry,
    createEntry('guidance', 150, ({ t }) => new GuidanceAuxView(t)),
    createEntry('review', 160, ({ t }) => new ReviewAuxView(t)),
];

export function createAuxViews(t: AuxTranslate, instance: Instance): AuxView[] {
    const context = { t, instance };
    return auxEntries
        .slice()
        .sort((left, right) => left.order - right.order)
        .map(entry => entry.create(context));
}
