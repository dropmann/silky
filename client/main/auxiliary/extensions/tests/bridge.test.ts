// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../host', () => ({
    default: {
        version: Promise.resolve('test-version'),
        os: 'test-os',
    },
}));

import { Analysis } from '../../../analyses';
import { ColumnType, DataType, MeasureType } from '../../../dataset';
import type { AuxEntryContext } from '../../types';
import { AuxExtensionBridge, JamoviAuxBridgeError } from '../bridge';
import type { AuxExtensionManifest, AuxExtensionPermission } from '../manifest';

type TestColumn = {
    id: number;
    name: string;
    index: number;
    dIndex: number;
    columnType: ColumnType;
    dataType?: DataType;
    measureType?: MeasureType;
    hidden?: boolean;
    description?: string;
    levels?: unknown[];
    missingValues?: unknown[];
};

function createColumn(overrides: Partial<TestColumn>): TestColumn {
    return {
        id: 1,
        name: 'var1',
        index: 0,
        dIndex: 0,
        columnType: ColumnType.DATA,
        dataType: DataType.DECIMAL,
        measureType: MeasureType.CONTINUOUS,
        hidden: false,
        levels: [],
        missingValues: [],
        ...overrides,
    };
}

function createAnalysis(overrides: Partial<Analysis> = {}): Analysis {
    const analysis = Object.create(Analysis.prototype) as Analysis;
    Object.assign(analysis, {
        id: 12,
        name: 'descriptives',
        ns: 'jmv',
        index: 0,
        enabled: true,
        arbitraryCode: false,
        missingModule: false,
        revision: 4,
        options: { getHeading: (): string => '' },
        results: { title: 'Descriptives', status: 2 },
        ...overrides,
    });
    return analysis;
}

function createContext({
    columns = [],
    selection,
    analyses = [],
    selectedAnalysis = null,
}: {
    columns?: TestColumn[];
    selection?: any;
    analyses?: Analysis[];
    selectedAnalysis?: Analysis | 'refsTable' | null;
} = {}): AuxEntryContext {
    const dataSetModel = {
        attributes: { columns },
        get: vi.fn((name: string) => {
            const values = {
                hasDataSet: true,
                rowCount: 10,
                columnCount: columns.length,
                rowCountExFiltered: 10,
                filtersVisible: false,
                editedCellCount: 0,
                edited: false,
            } as Record<string, boolean | number>;
            return values[name];
        }),
        visibleRowCount: vi.fn(() => 10),
        filterCount: vi.fn(() => 0),
        getColumn: vi.fn((index: number, isDisplayIndex?: boolean) => {
            if (isDisplayIndex)
                return columns.find(column => column.dIndex === index) || null;

            return columns[index] || null;
        }),
        getColumnById: vi.fn((id: number) => columns.find(column => column.id === id) || null),
    };

    return {
        t: text => text,
        instance: {
            get: vi.fn((name: string) => name === 'selectedAnalysis' ? selectedAnalysis : ''),
            dataSetModel: vi.fn(() => dataSetModel),
            analyses: vi.fn(() => analyses),
            trigger: vi.fn(),
        } as any,
        selection: selection || {
            rowNo: 0,
            colNo: 0,
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            colFocus: 0,
            rowFocus: 0,
            subSelections: [],
        },
    };
}

function createBridge(context: AuxEntryContext, permissions: AuxExtensionPermission[]): AuxExtensionBridge {
    const manifest: AuxExtensionManifest = {
        type: 'jamovi-aux-extension',
        id: 'dataset-summary-extension',
        name: 'Test extension',
        version: '1.0.0',
        apiVersion: 'jamovi.aux.v1',
        order: 1,
        entrypoint: 'test',
        permissions,
    };
    return new AuxExtensionBridge(manifest, context, vi.fn());
}

async function connect(bridge: AuxExtensionBridge): Promise<void> {
    await bridge.handleMessage({ jamoviAux: true, type: 'connect', id: 1, apiVersion: 'jamovi.aux.v1' });
}

async function request(bridge: AuxExtensionBridge, method: string, params?: any): Promise<any> {
    return await bridge.handleMessage({ jamoviAux: true, type: 'request', id: 2, method, params });
}

describe('AuxExtensionBridge', () => {
    it('requires permissions for bridge API calls', async () => {
        const bridge = createBridge(createContext(), []);
        await connect(bridge);

        await expect(request(bridge, 'variables.list')).rejects.toMatchObject({
            code: 'permission-denied',
            message: 'Missing permission: read:variables',
        });
    });

    it('resolves variables by name, id, and selector objects', async () => {
        const score = createColumn({ id: 3, name: 'score', index: 2, dIndex: 2 });
        const bridge = createBridge(createContext({ columns: [score] }), ['read:variables']);
        await connect(bridge);

        await expect(request(bridge, 'variables.get', 'score')).resolves.toMatchObject({ id: 3, name: 'score' });
        await expect(request(bridge, 'variables.get', 3)).resolves.toMatchObject({ id: 3, name: 'score' });
        await expect(request(bridge, 'variables.get', { id: 3 })).resolves.toMatchObject({ id: 3, name: 'score' });
        await expect(request(bridge, 'variables.get', { name: 'score' })).resolves.toMatchObject({ id: 3, name: 'score' });
    });

    it('returns null for missing variables and filter columns', async () => {
        const filter = createColumn({ id: 7, name: 'filter 1', columnType: ColumnType.FILTER });
        const bridge = createBridge(createContext({ columns: [filter] }), ['read:variables']);
        await connect(bridge);

        await expect(request(bridge, 'variables.get', 'missing')).resolves.toBeNull();
        await expect(request(bridge, 'variables.get', { id: 7 })).resolves.toBeNull();
    });

    it('reports selected variables across primary selection and subselections', async () => {
        const columns = [
            createColumn({ id: 1, name: 'a', index: 0, dIndex: 0 }),
            createColumn({ id: 2, name: 'b', index: 1, dIndex: 1, columnType: ColumnType.NONE }),
            createColumn({ id: 3, name: 'c', index: 2, dIndex: 2 }),
            createColumn({ id: 4, name: 'filter', index: 3, dIndex: 3, columnType: ColumnType.FILTER }),
        ];
        const selection = {
            rowNo: 2,
            colNo: 0,
            top: 2,
            bottom: 2,
            left: 0,
            right: 2,
            colFocus: 0,
            rowFocus: 2,
            subSelections: [
                { rowNo: 4, colNo: 2, top: 4, bottom: 4, left: 2, right: 3, colFocus: 2, rowFocus: 4 },
            ],
        };
        const bridge = createBridge(createContext({ columns, selection }), ['read:selectedVariable']);
        await connect(bridge);

        await expect(request(bridge, 'variables.getSelected')).resolves.toMatchObject({
            row: 2,
            column: { id: 1, name: 'a' },
            columns: [
                { id: 1, name: 'a' },
                { id: 2, name: 'b', isBlank: true },
                { id: 3, name: 'c' },
            ],
            ranges: [
                { rowStart: 2, rowEnd: 2, columnStart: 0, columnEnd: 2 },
                { rowStart: 4, rowEnd: 4, columnStart: 2, columnEnd: 3 },
            ],
            hasSubselections: true,
        });
    });

    it('returns null for no selected analysis and safe metadata for selected analyses', async () => {
        const analysis = createAnalysis();
        const noSelectionBridge = createBridge(createContext(), ['read:selectedAnalysis']);
        const selectedBridge = createBridge(createContext({ selectedAnalysis: analysis }), ['read:selectedAnalysis']);
        await connect(noSelectionBridge);
        await connect(selectedBridge);

        await expect(request(noSelectionBridge, 'analyses.getSelected')).resolves.toBeNull();
        await expect(request(selectedBridge, 'analyses.getSelected')).resolves.toEqual({
            id: 12,
            name: 'descriptives',
            ns: 'jmv',
            title: 'Descriptives',
            status: 2,
            enabled: true,
            revision: 4,
            index: 0,
            selected: false,
            missingModule: false,
            arbitraryCode: false,
        });
    });

    it('lists analyses, excludes empty annotations, and marks selected analysis', async () => {
        const selectedAnalysis = createAnalysis({ id: 12, name: 'descriptives', index: 0 });
        const otherAnalysis = createAnalysis({ id: 14, name: 'ttestIS', index: 1, results: { title: 'T-Test', status: 2 } });
        const emptyAnalysis = createAnalysis({ id: 16, name: 'empty', index: 2 });
        const bridge = createBridge(
            createContext({ analyses: [selectedAnalysis, otherAnalysis, emptyAnalysis], selectedAnalysis }),
            ['read:analyses'],
        );
        await connect(bridge);

        await expect(request(bridge, 'analyses.list')).resolves.toMatchObject([
            { id: 12, name: 'descriptives', selected: true },
            { id: 14, name: 'ttestIS', selected: false },
        ]);
    });

    it('rejects requests before connect', async () => {
        const bridge = createBridge(createContext(), ['read:variables']);

        await expect(request(bridge, 'variables.list')).rejects.toBeInstanceOf(JamoviAuxBridgeError);
        await expect(request(bridge, 'variables.list')).rejects.toMatchObject({
            code: 'invalid-request',
        });
    });
});
