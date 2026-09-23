import './style.css';

export type {
    AuxEntry,
    AuxEntryContext,
    AuxPresentation,
    AuxSide,
    AuxTranslate,
    AuxViewSelection,
    AuxViewId,
} from './types';

export { AuxView } from './types';
export type {
    AuxExtensionApiVersion,
    AuxExtensionManifest,
    AuxExtensionPermission,
    SandboxAuxExtensionDocumentFactory,
    TrustedAuxExtensionFactory,
} from './extensions';
export {
    SandboxAuxExtensionView,
    TrustedAuxExtensionView,
    createSandboxAuxExtensionEntry,
    createTrustedAuxExtensionEntry,
} from './extensions';
export { createAuxExtensionClientScript } from './extension-client';
export { default as AuxPanel } from './panel';
export { default as AuxShell } from './shell';
export { default as AuxToolbar } from './toolbar';
export { auxEntries, createAuxViews } from './registry';
