//
// Copyright (C) 2016 Jonathon Love
//

'use strict';

const _ = require('underscore');
const $ = require('jquery');
const Backbone = require('backbone');
Backbone.$ = $;

const ByteBuffer = require('bytebuffer');

const DataSetModel = Backbone.Model.extend({
    initialize() {
        this.initializeDataSetModel();
    },
    initializeDataSetModel() {
        this._changeBundles = [];
        this._nextChangeId = 0;
    },
    filtersHidden() {
        let firstColumn = this.getColumn(0, true);
        if (firstColumn)
            return firstColumn.columnType === 'filter' && firstColumn.hidden;

        return false;
    },
    visibleRealColumnCount() {
        let vCount = this.get('vColumnCount');
        let tCount = this.get('tColumnCount');
        let rCount = this.get('columnCount');

        return vCount - (tCount - rCount);
    },
    defaults : {
        hasDataSet : false,
        columns    : [ ],
        rowCount : 0,
        vRowCount : 0,
        columnCount : 0,
        vColumnCount : 0,
        tColumnCount : 0,
        coms : null,
        instanceId : null,
        editingVar : null,
        varEdited : false,
        filtersVisible: false,
        edited : false,
        formula : '',
        formulaMessage : ''
    },
    setup(infoPB) {

        if (infoPB.hasDataSet) {

            this.set('edited', infoPB.edited);

            let schemaPB = infoPB.schema;
            let columns = Array(schemaPB.columns.length);

            let dIndex = 0;
            for (let i = 0; i < schemaPB.columns.length; i++) {
                let columnPB = schemaPB.columns[i];
                let column = { };
                this._readColumnPB(column, columnPB);
                if (column.hidden)
                    column.dIndex = -1;
                else {
                    column.dIndex = dIndex;
                    dIndex += 1;
                }

                columns[i] = column;
            }

            this.attributes.columns  = columns;
            this.attributes.rowCount = infoPB.schema.rowCount;
            this.attributes.vRowCount = infoPB.schema.vRowCount;
            this.attributes.columnCount = infoPB.schema.columnCount;
            this.attributes.vColumnCount = infoPB.schema.vColumnCount;
            this.attributes.tColumnCount = infoPB.schema.tColumnCount;

            if (columns.length > 0) {
                let firstColumn = columns[0];
                this.attributes.filtersVisible = firstColumn.columnType === 'filter' && firstColumn.hidden === false;
            }


            this.set('hasDataSet', true);
            this.trigger('dataSetLoaded');
        }
    },
    getColumnById(id) {
        for (let column of this.attributes.columns) {
            if (column.id === id)
                return column;
        }
    },
    getColumn(indexOrName, isDisplayIndex) {
        if (typeof(indexOrName) === 'number') {
            if (isDisplayIndex) {
                for (let column of this.attributes.columns) {
                    if (column.dIndex === indexOrName)
                        return column;
                }
                return null;
            }
            else
                return this.attributes.columns[indexOrName];
        }
        else {
            for (let column of this.attributes.columns) {
                if (column.name === indexOrName)
                    return column;
            }
        }
        return undefined;
    },
    insertRows(rowStart, rowEnd) {

        let coms = this.attributes.coms;

        let datasetPB = new coms.Messages.DataSetRR();
        datasetPB.op = coms.Messages.GetSet.INS_ROWS;
        datasetPB.rowStart = rowStart;
        datasetPB.rowEnd = rowEnd;

        let request = new coms.Messages.ComsMessage();
        request.payload = datasetPB.toArrayBuffer();
        request.payloadType = 'DataSetRR';
        request.instanceId = this.attributes.instanceId;

        return coms.send(request).then(response => {

            let datasetPB = coms.Messages.DataSetRR.decode(response.payload);
            if (datasetPB.incSchema) {

                this.set('rowCount', datasetPB.schema.rowCount);
                this.set('vRowCount', datasetPB.schema.vRowCount);
                this.set('columnCount', datasetPB.schema.columnCount);
                this.set('vColumnCount', datasetPB.schema.vColumnCount);
                this.set('tColumnCount', datasetPB.schema.tColumnCount);

                let changed = Array(datasetPB.schema.columns.length);
                let changes = Array(datasetPB.schema.columns.length);

                for (let i = 0; i < datasetPB.schema.columns.length; i++) {
                    let columnPB = datasetPB.schema.columns[i];
                    let id = columnPB.id;
                    let column = this.getColumnById(id);

                    // dps might have changed
                    this._readColumnPB(column, columnPB);

                    changed[i] = columnPB.name;
                    changes[i] = { id: id, columnType: columnPB.columnType, dataChanged: true };
                }

                this.trigger('columnsChanged', { changed, changes });
            }

        });
    },
    deleteRows(rowStart, rowEnd) {

        let coms = this.attributes.coms;

        let datasetPB = new coms.Messages.DataSetRR();
        datasetPB.op = coms.Messages.GetSet.DEL_ROWS;
        datasetPB.rowStart = rowStart;
        datasetPB.rowEnd = rowEnd;

        let request = new coms.Messages.ComsMessage();
        request.payload = datasetPB.toArrayBuffer();
        request.payloadType = 'DataSetRR';
        request.instanceId = this.attributes.instanceId;

        return coms.send(request).then(response => {

            let datasetPB = coms.Messages.DataSetRR.decode(response.payload);
            if (datasetPB.incSchema) {

                this.set('rowCount', datasetPB.schema.rowCount);
                this.set('vRowCount', datasetPB.schema.vRowCount);
                this.set('columnCount', datasetPB.schema.columnCount);
                this.set('vColumnCount', datasetPB.schema.vColumnCount);
                this.set('tColumnCount', datasetPB.schema.tColumnCount);

                let changed = Array(datasetPB.schema.columns.length);
                let changes = Array(datasetPB.schema.columns.length);

                for (let i = 0; i < datasetPB.schema.columns.length; i++) {
                    let columnPB = datasetPB.schema.columns[i];
                    let id = columnPB.id;
                    let column = this.getColumnById(id);
                    this._readColumnPB(column, columnPB);

                    changed[i] = columnPB.name;
                    changes[i] = {
                        id: id,
                        columnType: columnPB.columnType,
                        columnTypeChanged: false,
                        measureTypeChanged: true,
                        levelsChanged: true,
                        levelNameChanges: [],
                        nameChanged: false,
                        dataChanged: true,
                        created: false,
                    };
                }

                this.trigger('columnsChanged', { changed, changes });
            }
        });
    },
    indexToDisplayIndex(index) {
        let columns = this.attributes.columns;
        return columns[index].dIndex;
    },
    indexFromDisplayIndex(dIndex) {
        let columns = this.attributes.columns;
        for (let column of columns) {
            if (column.dIndex === dIndex)
                return column.index;
        }
        throw 'Column display index out of range.';
    },
    insertColumn(start, end, properties, isDisplayIndex) {

        let dStart = start;
        let dEnd = end;
        if (isDisplayIndex) {
            start = this.indexFromDisplayIndex(start);
            end = this.indexFromDisplayIndex(end);
        }
        else {
            dStart = -1;
            dEnd = -1;
            for (let i = start; i <= end; i++) {
                let column = this.getColumn(i);
                if (column.hidden === false) {
                    let dIndex = this.indexToDisplayIndex(i);
                    if (dStart === -1)
                        dStart = dIndex;
                    dEnd = dIndex;
                }
            }
        }

        let coms = this.attributes.coms;
        let datasetPB = new coms.Messages.DataSetRR();
        datasetPB.op = coms.Messages.GetSet.INS_COLS;
        datasetPB.columnStart = start;
        datasetPB.columnEnd = end;
        datasetPB.schema = new coms.Messages.DataSetSchema();
        datasetPB.incSchema = true;

        for (let i = 0; i < end - start + 1; i++) {

            let params = null;

            if (Array.isArray(properties)) {
                if (i < properties.length)
                    params = properties[i];
                else
                    params = Object.assign({}, properties[properties.length - 1]);
            }
            else if (properties !== undefined)
                params = Object.assign({}, properties);

            if (params === null)
                params = { };

            if (params.childOf === undefined)
                params.childOf = -1;

            if (params.active === undefined)
                params.active = true;

            let columnType = params.columnType;
            if (columnType === undefined)
                throw 'Column type not specified';

            columnType = columnType || 'none';
            delete params.columnType;

            let measureType = params.measureType;
            if (params.measureType === undefined) {
                measureType = (columnType === 'computed' ? 'continuous' : 'nominal');
                delete params.measureType;
            }

            let autoMeasure = params.autoMeasure;
            if (params.autoMeasure === undefined) {
                autoMeasure = (columnType !== 'computed');
                delete params.measureType;
            }

            let columnPB = new coms.Messages.DataSetSchema.ColumnSchema();
            columnPB.columnType  = DataSetModel.parseColumnType(columnType);
            columnPB.measureType = DataSetModel.parseMeasureType(measureType);
            columnPB.autoMeasure = autoMeasure;
            for (let prop in params)
                columnPB[prop] = params[prop];
            datasetPB.schema.columns.push(columnPB);
        }

        let request = new coms.Messages.ComsMessage();
        request.payload = datasetPB.toArrayBuffer();
        request.payloadType = 'DataSetRR';
        request.instanceId = this.attributes.instanceId;

        return coms.send(request).then(response => {

            let datasetPB = coms.Messages.DataSetRR.decode(response.payload);
            if (datasetPB.incSchema) {

                this.set('rowCount', datasetPB.schema.rowCount);
                this.set('vRowCount', datasetPB.schema.vRowCount);
                this.set('columnCount', datasetPB.schema.columnCount);
                this.set('vColumnCount', datasetPB.schema.vColumnCount);
                this.set('tColumnCount', datasetPB.schema.tColumnCount);

                let changed = Array(datasetPB.schema.columns.length);
                let changes = Array(datasetPB.schema.columns.length);

                let columns = this.attributes.columns;
                for (let i = 0; i < datasetPB.schema.columns.length; i++) {
                    let columnPB = datasetPB.schema.columns[i];
                    let id = columnPB.id;
                    let column = this.getColumnById(id);
                    let created = false;

                    if (column === undefined) {
                        created = true;
                        column = { };
                        this._readColumnPB(column, columnPB);
                        columns.splice(column.index, 0, column);
                        for (let i = column.index + 1; i < columns.length; i++)
                            columns[i].index = i;
                    }
                    else
                        this._readColumnPB(column, columnPB);

                    this._updateDisplayIndices();

                    // add the cells, this should be in DataSetViewModel
                    if (column.hidden === false) {
                        let viewport = this.attributes.viewport;

                        if (column.dIndex > viewport.right) {  // to the right of the view
                            // do nothing
                        }
                        else if (column.dIndex < viewport.left) {
                            viewport.left  += 1;
                            viewport.right += 1;
                        }
                        else {
                            viewport.right += 1;
                            let cells = new Array(viewport.bottom - viewport.top + 1).fill(null);
                            this.attributes.cells.splice(column.dIndex - viewport.left, 0, cells);
                        }
                    }

                    changed[i] = columnPB.name;
                    changes[i] = {
                        id: id,
                        name: columnPB.name,
                        columnType: columnPB.columnType,
                        index: columnPB.index,
                        created: created,
                        dataChanged: created };
                }

                this.trigger('columnsInserted', { start: start, end: end });

                this.trigger('columnsChanged', { changed, changes });
            }

        });
    },
    _updateDisplayIndices() {
        let _dIndex = 0;
        let columns = this.attributes.columns;
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].hidden === false) {
                columns[i].dIndex = _dIndex;
                _dIndex += 1;
            }
            else
                columns[i].dIndex = -1;
        }
    },
    toggleFilterVisibility() {

        let setTo = ! this.get('filtersVisible');
        this.set('filtersVisible', setTo);
        let i = 0;
        let column = this.getColumn(i);
        let pairs = [];
        while(column.columnType === 'filter' && i < this.attributes.columns.length) {
            pairs.push( { id: column.id, values: { hidden: ! setTo } } );
            i += 1;
            column = this.getColumn(i);
        }
        return this.changeColumns(pairs);
    },
    deleteColumn(id) {
        let columns = this.get('columns');
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].id === id)
                return this.deleteColumns(i, i);
        }
        return Promise.resolve();
    },
    deleteColumns(start, end, isDisplayIndex, _force) {

        let dStart = start;
        let dEnd = end;
        if (isDisplayIndex) {
            start = this.indexFromDisplayIndex(start);
            end = this.indexFromDisplayIndex(end);
        }
        else {
            dStart = -1;
            dEnd = -1;
            for (let i = start; i <= end; i++) {
                let column = this.getColumn(i);
                if (column.hidden === false) {
                    let dIndex = this.indexToDisplayIndex(i);
                    if (dStart === -1)
                        dStart = dIndex;
                    dEnd = dIndex;
                }
            }
        }

        let coms = this.attributes.coms;

        let datasetPB = new coms.Messages.DataSetRR();
        datasetPB.op = coms.Messages.GetSet.DEL_COLS;
        datasetPB.columnStart = start;
        datasetPB.columnEnd = end;

        let request = new coms.Messages.ComsMessage();
        request.payload = datasetPB.toArrayBuffer();
        request.payloadType = 'DataSetRR';
        request.instanceId = this.attributes.instanceId;

        return coms.send(request).then(response => {

            let nDeleted = end - start + 1;
            let changed = Array(nDeleted);
            let changes = Array(nDeleted);

            for (let i = 0; i < nDeleted; i++) {
                let column = this.attributes.columns[start + i];
                changed[i] = column.name;
                changes[i] = { id: column.id, name: column.name, columnType: column.columnType, index: column.index, deleted: true };
            }

            let before = this.attributes.columns.slice(0, start);
            let after = this.attributes.columns.slice(end + 1);
            for (let i = 0; i < after.length; i++)
                after[i].index = start + i;

            this.attributes.columns = before.concat(after);

            let viewport = this.attributes.viewport;

            if (dStart !== -1) {
                if (dStart > viewport.right) {  // to the right of the view
                    // do nothing
                }
                else if (dEnd < viewport.left) {  // to the left of the view
                    viewport.left  -= nDeleted;
                    viewport.right -= nDeleted;
                }
                else if (dStart >= viewport.left && dEnd >= viewport.right) {
                    // overlapping the left side of the view
                    viewport.right = dStart - 1;
                }
                else if (dStart <= viewport.left && dEnd <= viewport.right) {
                    // overlapping the right side of the view
                    viewport.left = dEnd + 1 - nDeleted;
                    viewport.right -= nDeleted;
                }
                else if (dStart >= viewport.left && dEnd <= viewport.right) {
                    // contained in the view
                    viewport.right -= nDeleted;
                }
                else {
                    // starting before the view, extending after
                    viewport.right -= nDeleted;
                    viewport.left = viewport.right + 1;
                }
            }

            this.set('edited', true);

            let datasetPB = coms.Messages.DataSetRR.decode(response.payload);
            if (datasetPB.incSchema) {

                this.set('rowCount', datasetPB.schema.rowCount);
                this.set('vRowCount', datasetPB.schema.vRowCount);
                this.set('columnCount', datasetPB.schema.columnCount);
                this.set('vColumnCount', datasetPB.schema.vColumnCount);
                this.set('tColumnCount', datasetPB.schema.tColumnCount);

                for (let columnPB of datasetPB.schema.columns) {
                    let id = columnPB.id;
                    let column = this.getColumnById(id);
                    let oldName = column.name;
                    this._readColumnPB(column, columnPB);

                    changed.push(columnPB.name);
                    changes.push({
                        id: id,
                        name: columnPB.name,
                        index: columnPB.index,
                        oldName: oldName,
                        columnType: columnPB.columnType,
                        dataChanged: true,
                        nameChanged: oldName !== columnPB.name });
                }
            }

            this._updateDisplayIndices();

            this.trigger('columnsDeleted', { start: start, end: end, dStart: dStart,  dEnd: dEnd });
            this.trigger('columnsChanged', { changed, changes });
        });
    },
    changeColumn(id, values) {
        let column = this.getColumnById(id);
        return this.changeColumns([{ index: column.index, id: id, values: values }]);
    },
    changeColumns(pairs, _force) {

        let coms = this.attributes.coms;
        let datasetPB = new coms.Messages.DataSetRR();
        datasetPB.op = coms.Messages.GetSet.SET;
        datasetPB.incSchema = true;
        datasetPB.schema = new coms.Messages.DataSetSchema();

        for (let pair of pairs) {
            let id = pair.id;
            let values = pair.values;

            let column = this.getColumnById(id);

            let columnPB = new coms.Messages.DataSetSchema.ColumnSchema();
            columnPB.id = id;
            columnPB.measureType = DataSetModel.parseMeasureType(values.measureType);

            if ( ! ('name' in values))
                values.name = column.name;

            if (values.name === '')
                values.name = genColName(column.index);

            let nameChanged = (values.name !== column.name);
            let oldName = column.name;

            let testName = values.name;

            if (nameChanged) {
                let names = this.attributes.columns.map((column) => { return column.name; } );
                let i = 2;
                while (names.includes(testName) && testName !== oldName)
                    testName = values.name + ' (' + i++ + ')';
            }
            let newName = testName;

            columnPB.name = newName;

            if ('description' in values)
                columnPB.description = values.description;
            else
                columnPB.description = column.description;

            if ('hidden' in values)
                columnPB.hidden = values.hidden;
            else
                columnPB.hidden = column.hidden;

            if ('active' in values)
                columnPB.active = values.active;
            else
                columnPB.active = column.active;

            if ('childOf' in values)
                columnPB.childOf = values.childOf;
            else
                columnPB.childOf = column.childOf;

            if ('columnType' in values)
                columnPB.columnType = DataSetModel.parseColumnType(values.columnType);
            else
                columnPB.columnType = DataSetModel.parseColumnType(column.columnType);

            if ('autoMeasure' in values)
                columnPB.autoMeasure = values.autoMeasure;
            else
                columnPB.autoMeasure = column.autoMeasure;

            if ('dps' in values)
                columnPB.dps = values.dps;
            else
                columnPB.dps = column.dps;

            if ('formula' in values)
                columnPB.formula = values.formula;
            else
                columnPB.formula = column.formula;

            if (values.measureType !== 'continuous' && values.levels) {
                columnPB.hasLevels = true;
                for (let i = 0; i < values.levels.length; i++) {
                    let level = values.levels[i];
                    let levelPB = new coms.Messages.VariableLevel();
                    if (values.measureType === 'nominal' || values.measureType === 'ordinal') {
                        levelPB.value = level.value;
                        levelPB.label = level.label;
                        levelPB.importValue = '';
                        columnPB.levels.push(levelPB);
                    }
                    else {
                        levelPB.value = i;
                        levelPB.label = level.label;
                        levelPB.importValue = level.importValue;
                        columnPB.levels.push(levelPB);
                    }
                }
            }

            datasetPB.schema.columns.push(columnPB);
        }

        let request = new coms.Messages.ComsMessage();
        request.payload = datasetPB.toArrayBuffer();
        request.payloadType = 'DataSetRR';
        request.instanceId = this.attributes.instanceId;

        return coms.send(request).then(response => {
            let datasetPB = coms.Messages.DataSetRR.decode(response.payload);
            if (datasetPB.incSchema) {

                let changed = Array(datasetPB.schema.columns.length);
                let changes = Array(datasetPB.schema.columns.length);
                let nCreated = 0;
                let nHidden = 0;
                let nVisible = 0;

                for (let i = 0; i < datasetPB.schema.columns.length; i++) {
                    let columnPB = datasetPB.schema.columns[i];
                    let id = columnPB.id;
                    let column = this.getColumnById(id);

                    let newName = columnPB.name;

                    let levelNameChanges = this._determineLevelLabelChanges(column, columnPB);

                    let created;
                    let oldName;
                    let oldColumnType;
                    let hiddenChanged = false;
                    let activeChanged = false;
                    let oldDIndex = -1;

                    if (column !== undefined) {
                        created = false;
                        oldName = column.name;
                        oldColumnType = column.columnType;
                        oldDIndex = column.dIndex;
                        let oldHidden = column.hidden;
                        let oldActive = column.active;
                        this._readColumnPB(column, columnPB);
                        hiddenChanged = oldHidden !== column.hidden;
                        activeChanged = oldActive !== column.active;
                    }
                    else {
                        created = true;
                        oldName = columnPB.name;
                        oldColumnType = 0;
                        column = { };
                        nCreated++;
                        this._readColumnPB(column, columnPB);
                        this.attributes.columns[column.index] = column;
                    }
                    let nameChanged = (oldName !== columnPB.name);

                    changed[i] = columnPB.name;
                    changes[i] = {
                        id: id,
                        name: column.name,
                        columnType: oldColumnType,
                        index: column.index,
                        dIndex: oldDIndex,
                        oldName: oldName,
                        hiddenChanged: hiddenChanged,
                        activeChanged: activeChanged,
                        columnTypeChanged: column.columnType !== oldColumnType,
                        measureTypeChanged: true,
                        levelsChanged: true,
                        levelNameChanges: levelNameChanges,
                        nameChanged: nameChanged,
                        dataChanged: true,
                        created: created,
                    };

                    if (hiddenChanged) {
                        if (column.hidden) {
                            nHidden += 1;
                        }
                        else {
                            nVisible += 1;
                        }
                    }
                }

                if (nCreated > 0 || nVisible > 0 || nHidden > 0) {
                    if (nCreated > 0) {
                        this.set('columnCount', this.attributes.columnCount + nCreated);
                        this.set('tColumnCount', this.attributes.tColumnCount + nCreated);
                    }

                    this.set('vColumnCount', this.attributes.vColumnCount + nCreated + nVisible - nHidden);
                }


                if (nCreated > 0 || nVisible > 0 || nHidden > 0)
                    this._updateDisplayIndices();

                let old = this.attributes.viewport;
                let viewport = Object.assign({}, this.attributes.viewport);

                for (let change of changes) {
                    if (change.hiddenChanged) {
                        let column = this.getColumn(change.index);
                        if (column.hidden) {
                            if (change.dIndex > old.right) {  // to the right of the view
                                // do nothing
                            }
                            else if (change.dIndex < old.left) {  // to the left of the view
                                viewport.left  -= 1;
                                viewport.right -= 1;
                            }
                            else {
                                viewport.right -= 1;
                            }
                        }
                        else {
                            if (column.dIndex > viewport.right) {  // to the right of the view
                                // do nothing
                            }
                            else if (column.dIndex < viewport.left) {
                                viewport.left  += 1;
                                viewport.right += 1;
                            }
                            else {
                                viewport.right += 1;
                                let cells = new Array(viewport.bottom - viewport.top + 1).fill(null);
                                this.attributes.cells.splice(column.dIndex - viewport.left, 0, cells);
                            }
                        }
                    }
                }

                this.attributes.viewport = viewport;

                let hiddenRanges = this._clumpPropertyChanges(changes, 'hidden', true);
                let visibleRanges = this._clumpPropertyChanges(changes, 'hidden', false);
                let createRanges = this._clumpPropertyChanges(changes, 'created', true);

                let activeChangeRanges = this._clumpPropertyChanges(changes, 'active', true);
                activeChangeRanges = activeChangeRanges.concat(this._clumpPropertyChanges(changes, 'active', false));

                if (hiddenRanges.length > 0) {
                    for (let hRange of hiddenRanges)
                        this.trigger('columnsHidden', { start: hRange.start, end: hRange.end, dStart: hRange.dStart, dEnd: hRange.dEnd });
                }

                if (visibleRanges.length > 0) {
                    for (let vRange of visibleRanges)
                        this.trigger('columnsVisible', { start: vRange.start, end: vRange.end, dStart: vRange.dStart, dEnd: vRange.dEnd });
                }

                if (createRanges.length > 0) {
                    for (let cRange of createRanges)
                        this.trigger('columnsInserted', { start: cRange.start, end: cRange.end });
                }

                if (activeChangeRanges.length > 0) {
                    for (let range of activeChangeRanges)
                        this.trigger('columnsActiveChanged', { start: range.start, end: range.end, dStart: range.dStart, dEnd: range.dEnd, value: range.value });
                }

                this.trigger('columnsChanged', { changed, changes });
            }
        }).catch((error) => {
            console.log(error);
            throw error;
        });
    },
    _clumpPropertyChanges(changes, property, value) {
        let valueRanges = [];
        let hIndex = -1;
        for (let change of changes) {
            if (change[property + 'Changed'] && this.attributes.columns[change.index][property] === value) {
                if (hIndex === -1 || change.index > valueRanges[hIndex].end + 1) {
                    let range = { start: change.index, end: change.index, value: value };
                    if (change.dIndex !== undefined) {
                        range.dStart = change.dIndex;
                        range.dEnd = change.dIndex;
                    }

                    valueRanges.push( range );
                    hIndex += 1;
                }
                else if (change.index === valueRanges[hIndex].end + 1) {
                    valueRanges[hIndex].end = change.index;
                    valueRanges[hIndex].dEnd = change.dIndex;
                }
            }
        }
        return valueRanges;
    },

    _determineLevelLabelChanges(column, columnPB) {
        let levelNameChanges = [];
        if (column && column.levels && Array.isArray(column.levels)) {
            let levelLabels = {};
            for (let li = 0; li < column.levels.length; li++)
                levelLabels[column.levels[li].importValue] = column.levels[li].label;

            if (columnPB && columnPB.levels && Array.isArray(columnPB.levels)) {
                for (let li = 0; li < columnPB.levels.length; li++) {
                    let oldLabel = levelLabels[columnPB.levels[li].importValue];
                    if (oldLabel !== undefined && oldLabel !== columnPB.levels[li].label)
                        levelNameChanges.push({oldLabel: oldLabel, newLabel: columnPB.levels[li].label});
                }
            }
        }
        return levelNameChanges;
    },
    _readColumnPB(column, columnPB) {
        column.id = columnPB.id;
        column.name = columnPB.name;
        column.index = columnPB.index;
        column.columnType = DataSetModel.stringifyColumnType(columnPB.columnType);
        column.measureType = DataSetModel.stringifyMeasureType(columnPB.measureType);
        column.autoMeasure = columnPB.autoMeasure;
        column.dps = columnPB.dps;
        column.width = columnPB.width;
        column.formula = columnPB.formula;
        column.formulaMessage = columnPB.formulaMessage;
        column.description = columnPB.description;
        column.hidden = columnPB.hidden;
        column.active = columnPB.active;
        column.childOf = columnPB.childOf;

        let levels = null;
        if (columnPB.hasLevels) {
            levels = new Array(columnPB.levels.length);
            for (let i = 0; i < levels.length; i++) {
                let levelPB = columnPB.levels[i];
                if (column.measureType === 'nominaltext') {
                    levels[i] = {
                        label: levelPB.label,
                        value: i,
                        importValue: levelPB.importValue
                    };
                }
                else {
                    levels[i] = {
                        label: levelPB.label,
                        value: levelPB.value,
                        importValue: levelPB.value.toString()
                    };
                }
            }
        }
        column.levels = levels;
    },
});

DataSetModel.stringifyMeasureType = function(type) {
    switch (type) {
        case 1:
            return 'nominaltext';
        case 2:
            return 'nominal';
        case 3:
            return 'ordinal';
        case 4:
            return 'continuous';
        default:
            return 'none';
    }
};

DataSetModel.parseMeasureType = function(str) {
    switch (str) {
        case 'nominaltext':
            return 1;
        case 'nominal':
            return 2;
        case 'ordinal':
            return 3;
        case 'continuous':
            return 4;
        default:
            return 0;
    }
};


DataSetModel.stringifyColumnType = function(type) {
    switch (type) {
        case 1:
            return 'data';
        case 2:
            return 'computed';
        case 3:
            return 'recoded';
        case 4:
            return 'filter';
        case 0:
            return 'none';
        default:
            return 'none';
    }
};

DataSetModel.parseColumnType = function(str) {
    switch (str) {
        case 'data':
            return 1;
        case 'computed':
            return 2;
        case 'recoded':
            return 3;
        case 'filter':
            return 4;
        case 'none':
            return 0;
        default:
            return 1;
    }
};

const DataSetViewModel = DataSetModel.extend({

    initialize() {
        this.initializeDataSetModel();
        this.on('columnsChanged', event => this._columnsChanged(event));
    },
    defaults() {
        return _.extend({
            cells    : [ ],
            viewport : { left : 0, top : 0, right : -1, bottom : -1 },
        }, DataSetModel.prototype.defaults);
    },
    valueAt(rowNo, colNo) {
        let viewport = this.attributes.viewport;
        if (rowNo >= viewport.top &&
            rowNo <= viewport.bottom &&
            colNo >= viewport.left &&
            colNo <= viewport.right) {

            return this.attributes.cells[colNo - viewport.left][rowNo - viewport.top];
        }

        return null;
    },
    setViewport(viewport) {

        let nCols = viewport.right - viewport.left + 1;
        let nRows = viewport.bottom - viewport.top + 1;

        let cells = Array(nCols);

        for (let i = 0; i < nCols; i++) {
            let column = new Array(nRows);

            for (let j = 0; j < nRows; j++)
                column[j] = "" + (viewport.left + i) + ", " + (viewport.top + j);

            cells[i] = column;
        }

        this.attributes.cells = cells;
        this.attributes.viewport = Object.assign({}, viewport);

        this.trigger("viewportChanged");
        this.trigger("viewportReset");

        if (nRows !== 0 && nCols !== 0)
            this.readCells(viewport);
    },
    reshape(left, top, right, bottom) {

        // console.log("reshape : " + JSON.stringify({left:left,top:top,right:right,bottom:bottom}));

        let viewport = this.attributes.viewport;
        let cells = this.attributes.cells;
        let delta = { left: left, top: top, right: right, bottom: bottom };

        let nv = Object.assign({}, viewport);

        nv.left  -= left;
        nv.right += right;
        nv.top   -= top;
        nv.bottom += bottom;

        let nRows = nv.bottom - nv.top + 1;
        let nCols = nv.right - nv.left + 1;

        let innerLeft  = Math.max(viewport.left,  nv.left);
        let innerRight = Math.min(viewport.right, nv.right);
        let innerNCols = innerRight - innerLeft + 1;

        let requests = [ ];

        for (let i = 0; i > left; i--)
            cells.shift();
        for (let i = 0; i > right; i--)
            cells.pop();

        if (top < 0) {
            for (let i = 0; i < cells.length; i++) {
                let column = cells[i];
                for (let j = 0; j > top; j--)
                    column.shift();
            }
        }
        if (bottom < 0) {
            for (let i = 0; i < cells.length; i++) {
                let column = cells[i];
                for (let j = 0; j > bottom; j--)
                    column.pop();
            }
        }

        if (left > 0) {
            for (let i = 0; i < left; i++)
                cells.unshift(new Array(nRows));

            this.readCells({ left : nv.left, right : viewport.left - 1, top : nv.top, bottom : nv.bottom });
        }
        if (right > 0) {
            for (let i = 0; i < right; i++)
                cells.push(new Array(nRows));

            this.readCells({ left : viewport.right + 1, right : nv.right, top : nv.top, bottom : nv.bottom });
        }
        if (top > 0) {
            for (let i = 0; i < innerNCols; i++) {
                for (let j = 0; j < top; j++)
                    cells[i].unshift(".");
            }

            this.readCells({ left : innerLeft, right : innerRight, top : nv.top, bottom : viewport.top });
        }
        if (bottom > 0) {
            for (let i = 0; i < innerNCols; i++) {
                for (let j = 0; j < bottom; j++)
                    cells[i].push(".");
            }

            this.readCells({ left : innerLeft, right : innerRight, top : viewport.bottom, bottom : nv.bottom });
        }

        this.attributes.viewport = nv;
        this.attributes.cells = cells;

        this.trigger("viewportChanged");
    },
    readCells(viewport) {
        this.requestCells(viewport).then(cells => {
            this.setCells(viewport, cells);
        }).done();
    },
    _parseCells(response) {

        let columns = response.data;

        let rowStart    = response.rowStart;
        let columnStart = response.columnStart;
        let rowEnd      = response.rowEnd;
        let columnEnd   = response.columnEnd;

        let viewport = { left : columnStart, top : rowStart, right : columnEnd, bottom : rowEnd };

        let columnCount = columnEnd - columnStart + 1;
        let rowCount    = rowEnd    - rowStart + 1;

        let cells = new Array(columnCount);

        for (let colNo = 0; colNo < columnCount; colNo++) {

            let column = columns[colNo];
            let values = Array(column.values.length);

            for (let i = 0; i < column.values.length; i++) {
                let inValue = column.values[i];
                let outValue;
                if (inValue.type === 'o')
                    outValue = null;
                else
                    outValue = inValue[inValue.type];
                values[i] = outValue;
            }

            cells[colNo] = values;
        }

        return cells;
    },
    requestCells(viewport) {

        let coms = this.attributes.coms;

        let cellsRequest = new coms.Messages.DataSetRR();
        cellsRequest.incData = true;
        cellsRequest.rowStart    = viewport.top;
        cellsRequest.columnStart = viewport.left;
        cellsRequest.rowEnd      = viewport.bottom;
        cellsRequest.columnEnd   = viewport.right;
        cellsRequest.excHiddenCols = true;

        let request = new coms.Messages.ComsMessage();
        request.payload = cellsRequest.toArrayBuffer();
        request.payloadType = "DataSetRR";
        request.instanceId = this.attributes.instanceId;

        return coms.send(request).then(response => {
            let dsrrPB = coms.Messages.DataSetRR.decode(response.payload);
            let cells = this._parseCells(dsrrPB);
            return cells;
        });
    },
    changeCells(viewport, cells, cbHtml, _force) {

        let nRows = viewport.bottom - viewport.top + 1;
        let nCols = viewport.right - viewport.left + 1;

        let coms = this.attributes.coms;

        let cellsRequest = new coms.Messages.DataSetRR();
        cellsRequest.op = coms.Messages.GetSet.SET;
        cellsRequest.rowStart    = viewport.top;
        cellsRequest.columnStart = viewport.left;
        cellsRequest.rowEnd      = viewport.bottom;
        cellsRequest.columnEnd   = viewport.right;
        cellsRequest.excHiddenCols = true;

        if (typeof(cells) === 'string') {
            // send serialized data
            cellsRequest.incCBData = true;
            cellsRequest.cbText = cells;
            if (cbHtml)
                cellsRequest.cbHtml = cbHtml;
        }
        else if (cells === null) {

            cellsRequest.incData = true;

            if (viewport.top < this.attributes.rowCount &&
                viewport.bottom >= this.attributes.rowCount) {
                    nRows = this.attributes.rowCount - viewport.top + 1;
                    cellsRequest.rowEnd = this.attributes.rowCount - 1;
            }

            if (viewport.left < this.attributes.columnCount &&
                viewport.right >= this.attributes.columnCount) {
                    nCols = this.attributes.columnCount - viewport.left + 1;
                    cellsRequest.columnEnd = this.attributes.columnCount - 1;
            }

            for (let i = 0; i < nCols; i++) {
                let columnPB = new coms.Messages.DataSetRR.ColumnData();

                for (let j = 0; j < nRows; j++) {
                    let cellPB = new coms.Messages.DataSetRR.ColumnData.CellValue();
                    cellPB.o = coms.Messages.SpecialValues.MISSING;
                    cellPB.type = 'o';
                    columnPB.values.push(cellPB);
                }

                cellsRequest.data.push(columnPB);
            }
        }
        else {

            cellsRequest.incData = true;

            for (let i = 0; i < nCols; i++) {

                let inCells = cells[i];
                let columnType = this.getColumn(viewport.left + i, true).measureType;
                let columnPB = new coms.Messages.DataSetRR.ColumnData();

                for (let j = 0; j < nRows; j++) {
                    let outValue = new coms.Messages.DataSetRR.ColumnData.CellValue();
                    let inValue = inCells[j];
                    if (inValue === null) {
                        outValue.o = coms.Messages.SpecialValues.MISSING;
                        outValue.type = 'o';
                    }
                    else if (typeof(inValue) === 'string') {
                        outValue.s = inValue;
                        outValue.type = 's';
                    }
                    else if (Math.floor(inValue) === inValue) {
                        outValue.i = inValue;
                        outValue.type = 'i';
                    }
                    else {
                        outValue.d = inValue;
                        outValue.type = 'd';
                    }
                    columnPB.values.push(outValue);
                }

                cellsRequest.data.push(columnPB);
            }
        }

        let request = new coms.Messages.ComsMessage();
        request.payload = cellsRequest.toArrayBuffer();
        request.payloadType = 'DataSetRR';
        request.instanceId = this.attributes.instanceId;

        return coms.send(request).then(response => {

            let datasetPB = coms.Messages.DataSetRR.decode(response.payload);

            let viewport = {
                top:    datasetPB.rowStart,
                bottom: datasetPB.rowEnd,
                left:   datasetPB.columnStart,
                right:  datasetPB.columnEnd };

            nCols = viewport.right - viewport.left + 1;

            let changes = [ ];
            let changed = [ ];
            let nCreated = 0;

            if (datasetPB.incSchema) {
                changes = Array(datasetPB.schema.columns.length);
                changed = Array(datasetPB.schema.columns.length);

                for (let i = 0; i < datasetPB.schema.columns.length; i++) {
                    let columnPB = datasetPB.schema.columns[i];
                    let id = columnPB.id;
                    let column = this.getColumnById(id);
                    let newName = columnPB.name;
                    let levelNameChanges = this._determineLevelLabelChanges(column, columnPB);

                    let created = false;
                    let oldName;
                    let oldColumnType;
                    if (column !== undefined) {
                        oldName = column.name;
                        oldColumnType = column.columnType;
                        this._readColumnPB(column, columnPB);
                    }
                    else {
                        oldName = columnPB.name;
                        oldColumnType = 0;
                        column = { };
                        created = true;
                        nCreated++;
                        this._readColumnPB(column, columnPB);
                        this.attributes.columns[column.index] = column;
                    }

                    changed[i] = columnPB.name;
                    changes[i] = {
                        id: id,
                        oldName: oldName,
                        name: newName,
                        index: column.index,
                        columnType: oldColumnType,
                        columnTypeChanged: oldColumnType !== column.columnType,
                        measureTypeChanged: true,
                        levelsChanged: true,
                        levelNameChanges: levelNameChanges,
                        nameChanged: oldName !== newName,
                        dataChanged: true,
                        created: created,
                    };
                }
            }

            for (let i = 0; i < nCols; i++) {
                let column = this.getColumn(viewport.left + i, true);
                let name = column.name;
                if ( ! changed.includes(name)) {
                    changed.push(name);
                    changes.push({ id: column.id, columnType: column.columnType, index: column.index, oldName: name, dataChanged: true });
                }
            }

            if (nCreated > 0) {
                this.set('columnCount', this.attributes.columnCount + nCreated);
                this.set('vColumnCount', this.attributes.vColumnCount + nCreated);
                this.set('tColumnCount', this.attributes.tColumnCount + nCreated);

                this._updateDisplayIndices();
            }

            if (datasetPB.schema) {
                this.set('rowCount', datasetPB.schema.rowCount);
                this.set('vRowCount', datasetPB.schema.vRowCount);
            }

            let createRanges = this._clumpPropertyChanges(changes, 'created', true);
            if (createRanges.length > 0) {
                for (let cRange of createRanges)
                    this.trigger('columnsInserted', { start: cRange.start, end: cRange.end });
            }

            /*for (let change of changes) {
                if (change.created)
                    this.trigger('columnsInserted', { index: change.index });
            }*/

            this.set('edited', true);
            this.trigger('columnsChanged', { changed, changes });

            let cells = this._parseCells(datasetPB);
            this.setCells(viewport, cells);

            return viewport;
        });

    },
    setCells(viewport, cells) {

        let left   = Math.max(viewport.left,   this.attributes.viewport.left);
        let right  = Math.min(viewport.right,  this.attributes.viewport.right);
        let top    = Math.max(viewport.top,    this.attributes.viewport.top);
        let bottom = Math.min(viewport.bottom, this.attributes.viewport.bottom);

        let inColOffset = left - viewport.left;
        let inRowOffset = top - viewport.top;

        let outColOffset = left - this.attributes.viewport.left;
        let outRowOffset = top - this.attributes.viewport.top;

        let nRows = bottom - top + 1;
        let nCols = right - left + 1;

        for (let i = 0; i < nCols; i++) {

            let inCol  = cells[inColOffset + i];
            let outCol = this.attributes.cells[outColOffset + i];
            let columnInfo = this.getColumn(outColOffset + i, true);
            for (let j = 0; j < nRows; j++) {
                outCol[outRowOffset + j] = inCol[inRowOffset + j];
            }
        }

        this.trigger("cellsChanged", { left: left, top: top, right: right, bottom: bottom });
    },
    _columnsChanged(event) {

        for (let changes of event.changes) {
            if ( ! changes.dataChanged)
                continue;

            let column = this.getColumnById(changes.id);
            if (column.hidden)
                continue;

            let index = column.dIndex;
            let viewport = {
                left: index,
                top: this.attributes.viewport.top,
                right: index,
                bottom: this.attributes.viewport.bottom
            };
            this.readCells(viewport);
        }
    }
});

const genColName = function(index) {
    let alph = [
            'A','B','C','D','E','F','G','H','I',
            'J','K','L','M','N','O','P','Q','R',
            'S','T','U','V','W','X','Y','Z'
        ];

    let value = '';
    let c = index;
    do {
        let i = c % alph.length;
        value = alph[i] + value;
        c -= i;
        c /= alph.length;
        c -= 1;
    }
    while (c >= 0);

    return value;
};


module.exports = DataSetViewModel;
