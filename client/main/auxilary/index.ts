import createAnalysisAuxView from './analysis';
import createAssistantAuxView from './assistant';
import createDataQualityAuxView from './data-quality';
import createDatasetAuxView from './dataset';
import createGuidanceAuxView from './guidance';
import createHelpAuxView from './help';
import createHistoryAuxView from './history';
import createIssuesAuxView from './issues';
import createModulesAuxView from './modules';
import createNotesAuxView from './notes';
import createOutputNavAuxView from './output-nav';
import createResultsTocAuxView from './results-toc';
import createReviewAuxView from './review';
import createSearchAuxView from './search';
import createTransformsAuxView from './transforms';
import createVariableInfoAuxView from './variable-info';
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

export function createAuxViews(t: AuxTranslate): AuxView[] {
    return [
        createAssistantAuxView(t),
        createResultsTocAuxView(t),
        createDatasetAuxView(t),
        createAnalysisAuxView(t),
        createHelpAuxView(t),
        createVariableInfoAuxView(t),
        createIssuesAuxView(t),
        createHistoryAuxView(t),
        createSearchAuxView(t),
        createNotesAuxView(t),
        createOutputNavAuxView(t),
        createDataQualityAuxView(t),
        createTransformsAuxView(t),
        createModulesAuxView(t),
        createGuidanceAuxView(t),
        createReviewAuxView(t),
    ];
}
