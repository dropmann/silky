import type { AuxEntryContext } from '../types';
import { AuxExtensionApi } from './api';
import { JamoviAuxBridgeError } from './errors';
import type { AuxExtensionApiVersion, AuxExtensionManifest, AuxExtensionPermission } from './manifest';

export type { JamoviAuxErrorCode } from './errors';
export { JamoviAuxBridgeError } from './errors';

export type AuxExtensionRequestMessage = {
    jamoviAux: true;
    type: 'connect' | 'request' | 'resize';
    id: number;
    apiVersion?: AuxExtensionApiVersion;
    method?: string;
    params?: any;
    height?: number;
};

export class AuxExtensionBridge {
    private manifest: AuxExtensionManifest;
    private api: AuxExtensionApi;
    private postEvent: (name: string, data: any) => void;
    private connected = false;

    constructor(manifest: AuxExtensionManifest, context: AuxEntryContext, postEvent: (name: string, data: any) => void) {
        this.manifest = manifest;
        this.api = new AuxExtensionApi(context, manifest.name);
        this.postEvent = postEvent;
    }

    async handleMessage(message: AuxExtensionRequestMessage): Promise<any> {
        if (message.type === 'connect')
            return this.connect(message.apiVersion);

        if (message.type === 'request')
            return await this.handleRequest(message.method, message.params);

        throw new JamoviAuxBridgeError('invalid-request', 'Unsupported message type.');
    }

    private hasPermission(permission: AuxExtensionPermission): boolean {
        return this.manifest.permissions.includes(permission);
    }

    private requirePermission(permission: AuxExtensionPermission): void {
        if (! this.hasPermission(permission))
            throw new JamoviAuxBridgeError('permission-denied', `Missing permission: ${ permission }`);
    }

    private connect(apiVersion?: AuxExtensionApiVersion): object {
        if (apiVersion !== this.manifest.apiVersion)
            throw new JamoviAuxBridgeError('unsupported-api-version', `Unsupported API version: ${ apiVersion || '(none)' }`);

        this.connected = true;
        setTimeout(() => this.postEvent('ready', {}), 0);
        return {
            apiVersion: this.manifest.apiVersion,
            id: this.manifest.id,
            name: this.manifest.name,
            permissions: this.manifest.permissions,
        };
    }

    private async handleRequest(method?: string, params?: any): Promise<any> {
        if (! this.connected)
            throw new JamoviAuxBridgeError('invalid-request', 'Extension is not connected.');

        switch (method) {
            case 'context.get':
                return await this.getContext();
            case 'dataset.summary':
                return this.getDatasetSummary();
            case 'variables.list':
                return this.listVariables();
            case 'variables.get':
                return this.getVariable(params);
            case 'variables.getSelected':
                return this.getSelectedVariable();
            case 'analyses.list':
                return this.listAnalyses();
            case 'analyses.getSelected':
                return this.getSelectedAnalysis();
            case 'ui.notify':
                return this.notify(params);
            default:
                throw new JamoviAuxBridgeError('not-found', `Unknown method: ${ method || '(none)' }`);
        }
    }

    private async getContext(): Promise<object> {
        this.requirePermission('read:appContext');
        return await this.api.getContext();
    }

    private getDatasetSummary(): object {
        this.requirePermission('read:datasetSummary');
        return this.api.getDatasetSummary();
    }

    private listVariables(): object[] {
        this.requirePermission('read:variables');
        return this.api.listVariables();
    }

    private getVariable(params: any): object | null {
        this.requirePermission('read:variables');
        return this.api.getVariable(params);
    }

    getSelectedVariable(): object {
        this.requirePermission('read:selectedVariable');
        return this.api.getSelectedVariable();
    }

    tryGetSelectedVariable(): object | null {
        if (! this.hasPermission('read:selectedVariable'))
            return null;

        return this.api.getSelectedVariable();
    }

    getSelectedAnalysis(): object | null {
        this.requirePermission('read:selectedAnalysis');
        return this.api.getSelectedAnalysis();
    }

    tryGetSelectedAnalysis(): object | null {
        if (! this.hasPermission('read:selectedAnalysis'))
            return null;

        return this.api.getSelectedAnalysis();
    }

    listAnalyses(): object[] {
        this.requirePermission('read:analyses');
        return this.api.listAnalyses();
    }

    tryListAnalyses(): object[] | null {
        if (! this.hasPermission('read:analyses'))
            return null;

        return this.api.listAnalyses();
    }

    private notify(params: any): object {
        this.requirePermission('ui:notifications');
        return this.api.notify(params);
    }
}
