import { createTrustedAuxExtensionEntry, type AuxExtensionManifest } from '../../extensions';
import ModulesAuxView from './view';
import './style.css';

const manifest: AuxExtensionManifest = {
    type: 'jamovi-aux-extension',
    id: 'modules',
    name: 'Module Library',
    version: '1.0.0',
    apiVersion: 'jamovi.aux.v1',
    order: 140,
    entrypoint: 'builtin:modules',
    description: 'Install, update, remove, and manage jamovi modules.',
    builtIn: true,
    trusted: true,
    permissions: [
        'read:appContext',
        'read:modules',
        'action:installModule',
        'ui:notifications',
        'ui:dialogs',
    ],
};

const entry = createTrustedAuxExtensionEntry(manifest, ({ t, instance }) => new ModulesAuxView(t, instance));

export default entry;
