import AnalysisAuxView from './analysis';
import AssistantAuxView from './assistant';
import DataQualityAuxView from './data-quality';
import DatasetAuxView from './dataset';
import GuidanceAuxView from './guidance';
import HelpAuxView from './help';
import HistoryAuxView from './history';
import IssuesAuxView from './issues';
import ModulesAuxView from './modules';
import NotesAuxView from './notes';
import OutputNavAuxView from './output-nav';
import ResultsTocAuxView from './results-toc';
import ReviewAuxView from './review';
import SearchAuxView from './search';
import TransformsAuxView from './transforms';
import VariableInfoAuxView from './variable-info';
import type Instance from '../instance';
import type { AuxTranslate } from './types';
import { AuxView } from './types';

export type {
    AuxPresentation,
    AuxSide,
    AuxTranslate,
    AuxViewSelection,
    AuxViewId,
} from './types';

export { AuxView } from './types';
export { default as AuxPanel } from './panel';
export { default as AuxShell } from './shell';
export { default as AuxToolbar } from './toolbar';

export function createAuxViews(t: AuxTranslate, instance: Instance): AuxView[] {
    return [
        new AssistantAuxView(t),
        new ResultsTocAuxView(t, instance),
        new DatasetAuxView(t, instance),
        new AnalysisAuxView(t, instance),
        new HelpAuxView(t),
        new VariableInfoAuxView(t),
        new IssuesAuxView(t),
        new HistoryAuxView(t),
        new SearchAuxView(t),
        new NotesAuxView(t),
        new OutputNavAuxView(t),
        new DataQualityAuxView(t),
        new TransformsAuxView(t),
        new ModulesAuxView(t, instance),
        new GuidanceAuxView(t),
        new ReviewAuxView(t),
    ];
}
