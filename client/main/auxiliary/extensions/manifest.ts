import type { AuxViewId } from '../types';

export type AuxExtensionApiVersion = 'jamovi.aux.v1';

export type AuxExtensionPermission =
    | 'read:appContext'
    | 'read:datasetSummary'
    | 'read:variables'
    | 'read:selectedVariable'
    | 'read:analyses'
    | 'read:selectedAnalysis'
    | 'read:analysisResults'
    | 'read:modules'
    | 'read:dataPreview'
    | 'read:dataColumns'
    | 'read:computedSummaries'
    | 'action:createAnalysis'
    | 'action:updateAnalysisOptions'
    | 'action:selectAnalysis'
    | 'action:selectVariable'
    | 'action:createTransform'
    | 'action:editDataset'
    | 'action:installModule'
    | 'ui:notifications'
    | 'ui:dialogs'
    | 'ui:openExternalUrl'
    | 'ui:clipboard'
    | 'ui:persistentStorage';

export type AuxExtensionManifest = {
    type: 'jamovi-aux-extension';
    id: AuxViewId;
    name: string;
    version: string;
    apiVersion: AuxExtensionApiVersion;
    order: number;
    entrypoint: string;
    description?: string;
    builtIn?: boolean;
    trusted?: boolean;
    iconSvg?: string;
    permissions: AuxExtensionPermission[];
    network?: {
        hosts: string[];
    };
};

export const auxExtensionPermissions: readonly AuxExtensionPermission[] = [
    'read:appContext',
    'read:datasetSummary',
    'read:variables',
    'read:selectedVariable',
    'read:analyses',
    'read:selectedAnalysis',
    'read:analysisResults',
    'read:modules',
    'read:dataPreview',
    'read:dataColumns',
    'read:computedSummaries',
    'action:createAnalysis',
    'action:updateAnalysisOptions',
    'action:selectAnalysis',
    'action:selectVariable',
    'action:createTransform',
    'action:editDataset',
    'action:installModule',
    'ui:notifications',
    'ui:dialogs',
    'ui:openExternalUrl',
    'ui:clipboard',
    'ui:persistentStorage',
];

type ManifestValidationOptions = {
    trustedRequired?: boolean;
};

const allowedPermissions = new Set<string>(auxExtensionPermissions);

export function validateAuxExtensionManifest(manifest: AuxExtensionManifest, options: ManifestValidationOptions = {}): void {
    const label = getManifestLabel(manifest);

    if (manifest === null || typeof manifest !== 'object')
        throw new Error('Aux extension manifest must be an object.');

    if (manifest.type !== 'jamovi-aux-extension')
        throw new Error(`Aux extension '${ label }' has an invalid manifest type.`);

    requireNonEmptyString(manifest.id, 'id', label);
    requireNonEmptyString(manifest.name, 'name', label);
    requireNonEmptyString(manifest.version, 'version', label);
    requireNonEmptyString(manifest.entrypoint, 'entrypoint', label);

    if (manifest.apiVersion !== 'jamovi.aux.v1')
        throw new Error(`Aux extension '${ label }' has an unsupported API version.`);

    if (typeof manifest.order !== 'number' || Number.isFinite(manifest.order) === false)
        throw new Error(`Aux extension '${ label }' must declare a finite numeric order.`);

    if (Array.isArray(manifest.permissions) === false)
        throw new Error(`Aux extension '${ label }' must declare a permissions array.`);

    const seenPermissions = new Set<string>();
    for (const permission of manifest.permissions) {
        if (typeof permission !== 'string' || allowedPermissions.has(permission) === false)
            throw new Error(`Aux extension '${ label }' declares an unknown permission: ${ String(permission) }`);

        if (seenPermissions.has(permission))
            throw new Error(`Aux extension '${ label }' declares duplicate permission: ${ permission }`);

        seenPermissions.add(permission);
    }

    if (manifest.network !== undefined) {
        if (manifest.network === null || typeof manifest.network !== 'object' || Array.isArray(manifest.network.hosts) === false)
            throw new Error(`Aux extension '${ label }' network configuration must declare a hosts array.`);

        for (const host of manifest.network.hosts) {
            if (typeof host !== 'string' || host.trim() === '')
                throw new Error(`Aux extension '${ label }' network hosts must be non-empty strings.`);
        }
    }

    if (options.trustedRequired === true && (manifest.builtIn !== true || manifest.trusted !== true))
        throw new Error(`Aux extension '${ label }' must be marked as built-in and trusted to use the trusted adapter.`);
}

function requireNonEmptyString(value: unknown, field: string, label: string): void {
    if (typeof value !== 'string' || value.trim() === '')
        throw new Error(`Aux extension '${ label }' must declare a non-empty ${ field }.`);
}

function getManifestLabel(manifest: unknown): string {
    if (manifest !== null && typeof manifest === 'object' && 'id' in manifest && typeof manifest.id === 'string' && manifest.id.trim() !== '')
        return manifest.id;

    return '(unknown)';
}
