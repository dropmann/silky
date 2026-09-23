export type JamoviAuxErrorCode =
    | 'permission-denied'
    | 'unsupported-api-version'
    | 'invalid-request'
    | 'not-found'
    | 'cancelled'
    | 'internal-error';

export class JamoviAuxBridgeError extends Error {
    code: JamoviAuxErrorCode;

    constructor(code: JamoviAuxErrorCode, message: string) {
        super(message);
        this.code = code;
    }
}
