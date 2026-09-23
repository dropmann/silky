import I18ns from '../../../common/i18n';
import { Analysis } from '../../analyses';
import { ColumnType, type Column } from '../../dataset';
import host from '../../host';
import Notify from '../../notification';
import type { ISelection } from '../../selection';
import type { AuxEntryContext } from '../types';
import { JamoviAuxBridgeError } from './errors';

export class AuxExtensionApi {
    private context: AuxEntryContext;
    private extensionName: string;

    constructor(context: AuxEntryContext, extensionName: string) {
        this.context = context;
        this.extensionName = extensionName;
    }

    async getContext(): Promise<object> {
        const version = await host.version;
        return {
            appVersion: version,
            platform: host.os,
            language: I18ns.get('app').language,
            documentTitle: this.context.instance.get('title') || '',
            hasDataset: this.context.instance.dataSetModel().get('hasDataSet') === true,
        };
    }

    getDatasetSummary(): object {
        const dataSetModel = this.context.instance.dataSetModel();
        const columns = dataSetModel.attributes.columns || [];
        const computedColumns = columns.filter(column =>
            column.columnType === ColumnType.COMPUTED || column.columnType === ColumnType.RECODED).length;

        return {
            hasDataset: dataSetModel.get('hasDataSet') === true,
            rowCount: dataSetModel.get('rowCount') || 0,
            visibleRowCount: dataSetModel.visibleRowCount() || 0,
            columnCount: dataSetModel.get('columnCount') || 0,
            activeFilterCount: dataSetModel.filterCount(true),
            filtersVisible: dataSetModel.get('filtersVisible') === true,
            computedColumnCount: computedColumns,
            editedCellCount: dataSetModel.get('editedCellCount') || 0,
            edited: dataSetModel.get('edited') === true,
        };
    }

    listVariables(): object[] {
        const dataSetModel = this.context.instance.dataSetModel();
        const columns = dataSetModel.attributes.columns || [];
        return columns
            .filter(column => column.columnType !== ColumnType.FILTER)
            .filter(column => column.hidden === false)
            .map(column => ({
                id: column.id,
                name: column.name,
                title: column.name,
                description: column.description || '',
                index: column.index,
                dataType: column.dataType,
                measureType: column.measureType,
                columnType: column.columnType,
                isBlank: column.columnType === ColumnType.NONE,
                levelCount: column.levels?.length || 0,
                missingValueCount: column.missingValues?.length || 0,
            }));
    }

    getVariable(params: any): object | null {
        const column = this.findVariable(params);
        if (column === null || column.columnType === ColumnType.FILTER)
            return null;

        return this.mapColumn(column);
    }

    getSelectedVariable(): object {
        const dataSetModel = this.context.instance.dataSetModel();
        const selection = this.context.selection;
        const column = dataSetModel.getColumn(selection.colNo, true);
        const columns = this.getSelectedColumns()
            .map(column => this.mapColumn(column))
            .filter(column => column !== null);
        const ranges = [selection, ...selection.subSelections].map(range => this.mapSelectionRange(range));

        return {
            row: selection.rowNo,
            column: this.mapColumn(column),
            columns,
            range: ranges[0],
            ranges,
            hasSubselections: selection.subSelections.length > 0,
        };
    }

    getSelectedAnalysis(): object | null {
        const analysis = this.context.instance.get('selectedAnalysis');
        if (! (analysis instanceof Analysis))
            return null;

        return this.mapAnalysis(analysis);
    }

    listAnalyses(): object[] {
        const selectedAnalysis = this.context.instance.get('selectedAnalysis');
        return Array.from(this.context.instance.analyses())
            .filter(analysis => analysis.name !== 'empty')
            .map(analysis => this.mapAnalysis(analysis, selectedAnalysis instanceof Analysis && selectedAnalysis.id === analysis.id));
    }

    notify(params: any): object {
        const title = typeof params?.title === 'string' ? params.title : this.extensionName;
        const message = typeof params?.message === 'string' ? params.message : '';
        const type = params?.type === 'success' || params?.type === 'error' ? params.type : 'info';
        const duration = typeof params?.duration === 'number' ? params.duration : 3000;
        this.context.instance.trigger('notification', new Notify({ title, message, type, duration }));
        return { ok: true };
    }

    private mapAnalysis(analysis: Analysis, selected: boolean = false): object {
        const heading = analysis.options !== null ? analysis.getHeading() : '';
        return {
            id: analysis.id,
            name: analysis.name,
            ns: analysis.ns,
            title: heading || analysis.results?.title || analysis.name,
            status: analysis.results?.status ?? null,
            enabled: analysis.enabled === true,
            revision: analysis.revision,
            index: analysis.index,
            selected,
            missingModule: analysis.missingModule === true,
            arbitraryCode: analysis.arbitraryCode === true,
        };
    }

    private mapColumn(column: any): object | null {
        if (! column)
            return null;

        return {
            id: column.id,
            name: column.name,
            title: column.name,
            description: column.description || '',
            index: column.index,
            dataIndex: column.dIndex,
            dataType: column.dataType,
            measureType: column.measureType,
            columnType: column.columnType,
            isBlank: column.columnType === ColumnType.NONE,
            isFilter: column.columnType === ColumnType.FILTER,
            hidden: column.hidden === true,
            levelCount: column.levels?.length || 0,
            missingValueCount: column.missingValues?.length || 0,
        };
    }

    private findVariable(params: any): Column | null {
        const dataSetModel = this.context.instance.dataSetModel();
        const columns = dataSetModel.attributes.columns || [];

        if (typeof params === 'number')
            return dataSetModel.getColumnById(params) || null;

        if (typeof params === 'string')
            return columns.find(column => column.name === params) || null;

        if (typeof params?.id === 'number')
            return dataSetModel.getColumnById(params.id) || null;

        if (typeof params?.name === 'string')
            return columns.find(column => column.name === params.name) || null;

        throw new JamoviAuxBridgeError('invalid-request', 'variables.get requires a variable id or name.');
    }

    private mapSelectionRange(selection: ISelection): object {
        return {
            rowStart: selection.top,
            rowEnd: selection.bottom,
            columnStart: selection.left,
            columnEnd: selection.right,
            focusRow: selection.rowFocus ?? selection.rowNo,
            focusColumn: selection.colFocus ?? selection.colNo,
        };
    }

    private getSelectedColumns(): Column[] {
        const dataSetModel = this.context.instance.dataSetModel();
        const selection = this.context.selection;
        const columnsById = new Map<number, Column>();

        for (const range of [selection, ...selection.subSelections]) {
            for (let index = range.left; index <= range.right; index++) {
                const column = dataSetModel.getColumn(index, true);
                if (column === null || column.columnType === ColumnType.FILTER)
                    continue;

                columnsById.set(column.id, column);
            }
        }

        return Array.from(columnsById.values()).sort((left, right) => left.index - right.index);
    }
}
