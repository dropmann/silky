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
    // lowercase letters, digits and hyphens, optionally in dot separated
    // segments (i.e. 'org.example.dataset-audit'), starting with a letter
    id: string;
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
        // hosts the extension may connect to, i.e. 'api.example.org',
        // '*.example.org' or 'https://api.example.org:8443'. https only
        hosts: string[];
    };
};

const idPattern = /^(?=.{1,128}$)[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/;
const hostPattern = /^(?:https:\/\/)?((?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}|localhost)(?::(\d{1,5}))?\/?$/i;

/**
 * Converts a manifest network host into a Content-Security-Policy source, or
 * returns null if the host isn't in an accepted form.
 */
export function networkHostToSource(host: string): string | null {
    const match = hostPattern.exec(host.trim());
    if (match === null)
        return null;

    const port = match[2];
    if (port !== undefined && (Number(port) < 1 || Number(port) > 65535))
        return null;

    return `https://${ match[1].toLowerCase() }${ port !== undefined ? `:${ port }` : '' }`;
}

/**
 * Returns the Content-Security-Policy sources for a manifest's network hosts.
 */
export function getNetworkSources(manifest: AuxExtensionManifest): string[] {
    return (manifest.network?.hosts || [])
        .map(host => networkHostToSource(host))
        .filter((source): source is string => source !== null);
}

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

// the permissions the sandbox bridge actually implements. the others are
// reserved, and sandboxed extensions can't declare them yet; otherwise an
// extension declaring one would silently gain it once it's implemented
export const implementedAuxExtensionPermissions: readonly AuxExtensionPermission[] = [
    'read:appContext',
    'read:datasetSummary',
    'read:variables',
    'read:selectedVariable',
    'read:analyses',
    'read:selectedAnalysis',
    'ui:notifications',
];

const allowedPermissions = new Set<string>(auxExtensionPermissions);
const implementedPermissions = new Set<string>(implementedAuxExtensionPermissions);

export function validateAuxExtensionManifest(manifest: AuxExtensionManifest, options: ManifestValidationOptions = {}): void {
    const label = getManifestLabel(manifest);

    if (manifest === null || typeof manifest !== 'object')
        throw new Error('Aux extension manifest must be an object.');

    if (manifest.type !== 'jamovi-aux-extension')
        throw new Error(`Aux extension '${ label }' has an invalid manifest type.`);

    requireNonEmptyString(manifest.id, 'id', label);
    if (! idPattern.test(manifest.id))
        throw new Error(`Aux extension '${ label }' must have an id made of lowercase letters, digits, hyphens and dots, starting with a letter.`);
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

        // trusted (built in) extensions run in the main document, where
        // permissions describe rather than limit what they do
        if (options.trustedRequired !== true && implementedPermissions.has(permission) === false)
            throw new Error(`Aux extension '${ label }' declares a permission that isn't available yet: ${ permission }`);

        if (seenPermissions.has(permission))
            throw new Error(`Aux extension '${ label }' declares duplicate permission: ${ permission }`);

        seenPermissions.add(permission);
    }

    if (manifest.network !== undefined) {
        if (manifest.network === null || typeof manifest.network !== 'object' || Array.isArray(manifest.network.hosts) === false)
            throw new Error(`Aux extension '${ label }' network configuration must declare a hosts array.`);

        for (const host of manifest.network.hosts) {
            if (typeof host !== 'string' || networkHostToSource(host) === null)
                throw new Error(`Aux extension '${ label }' declares an invalid network host: ${ String(host) }`);
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
