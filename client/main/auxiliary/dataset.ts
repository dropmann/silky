import type Instance from '../instance';
import { ColumnType } from '../dataset';
import { AuxView } from './types';
import type { AuxTranslate } from './types';

export default class DatasetAuxView extends AuxView {
    model: Instance;
    rowsValue: HTMLElement | null = null;
    visibleRowsValue: HTMLElement | null = null;
    columnsValue: HTMLElement | null = null;
    filtersValue: HTMLElement | null = null;
    editedCellsValue: HTMLElement | null = null;
    stateText: HTMLElement | null = null;

    constructor(t: AuxTranslate, model: Instance) {
        super('dataset', t);
        this.model = model;
    }

    getTitle() { return this.t('Dataset Overview'); }

    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="5" width="16" height="14" rx="2" />
                <path d="M4 10h16" />
                <path d="M10 5v14" />
            </svg>
        `; }

    createStat(label: string) {
        const stat = document.createElement('div');
        stat.className = 'aux-panel-stat';

        const span = document.createElement('span');
        span.textContent = label;

        const strong = document.createElement('strong');
        strong.textContent = '0';

        stat.append(span, strong);

        return { stat, value: strong };
    }

    getBody() {
        const body = document.createElement('div');

        const description = document.createElement('p');
        description.textContent = this.t('A compact status summary for the active data set.');

        const grid = document.createElement('div');
        grid.className = 'aux-panel-grid';

        const rows = this.createStat(this.t('Rows'));
        const visibleRows = this.createStat(this.t('Visible rows'));
        const columns = this.createStat(this.t('Columns'));
        const filters = this.createStat(this.t('Active filters'));
        const editedCells = this.createStat(this.t('Edited cells'));

        grid.append(rows.stat, visibleRows.stat, columns.stat, filters.stat, editedCells.stat);

        const state = document.createElement('div');
        state.className = 'aux-panel-placeholder';

        body.append(description, grid, state);

        this.rowsValue = rows.value;
        this.visibleRowsValue = visibleRows.value;
        this.columnsValue = columns.value;
        this.filtersValue = filters.value;
        this.editedCellsValue = editedCells.value;
        this.stateText = state;

        return body;
    }

    onMount(): void {
        const dataSetModel = this.model.dataSetModel();
        dataSetModel.on('dataSetLoaded', this.update, this);
        dataSetModel.on('columnsChanged', this.update, this);
        dataSetModel.on('change:rowCount', this.update, this);
        dataSetModel.on('change:columnCount', this.update, this);
        dataSetModel.on('change:rowCountExFiltered', this.update, this);
        dataSetModel.on('change:filtersVisible', this.update, this);
        dataSetModel.on('change:editedCellCount', this.update, this);
        dataSetModel.on('change:edited', this.update, this);
        this.update();
    }

    onShow(): void {
        this.update();
    }

    update(): void {
        if (this.rowsValue === null || this.visibleRowsValue === null || this.columnsValue === null || this.filtersValue === null || this.editedCellsValue === null || this.stateText === null)
            return;

        const dataSetModel = this.model.dataSetModel();
        const rows = dataSetModel.get('rowCount') || 0;
        const visibleRows = dataSetModel.visibleRowCount() || 0;
        const columns = dataSetModel.get('columnCount') || 0;
        const editedCells = dataSetModel.get('editedCellCount') || 0;
        const activeFilters = dataSetModel.filterCount(true);
        const filtersVisible = dataSetModel.get('filtersVisible');
        const computedColumns = dataSetModel.attributes.columns.filter(column => column.columnType === ColumnType.COMPUTED || column.columnType === ColumnType.RECODED).length;
        const edited = dataSetModel.get('edited');

        this.rowsValue.textContent = rows.toLocaleString();
        this.visibleRowsValue.textContent = visibleRows.toLocaleString();
        this.columnsValue.textContent = columns.toLocaleString();
        this.filtersValue.textContent = activeFilters.toLocaleString();
        this.editedCellsValue.textContent = editedCells.toLocaleString();

        this.stateText.textContent = this.t(
            'Filters are {filtersVisible}. {computedColumns} transformed or computed columns. Data set is {editedState}.',
            {
                filtersVisible: filtersVisible ? this.t('visible') : this.t('hidden'),
                computedColumns: computedColumns.toLocaleString(),
                editedState: edited ? this.t('edited') : this.t('saved'),
            }
        );
    }
}
