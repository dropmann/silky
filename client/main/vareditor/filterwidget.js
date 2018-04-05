
'use strict';

const $ = require('jquery');
const Backbone = require('backbone');
Backbone.$ = $;
const keyboardJS = require('keyboardjs');
const tippy = require('tippy.js');

const FilterWidget = Backbone.View.extend({
    className: 'FilterWidget',
    initialize(args) {

        this.attached = false;
        this._inited = false;

        this._exampleFormulas = [
            "gender == 'female'",
            "score == 10",
            "consent == 'no'",
            "Q1 != 'don't know'",
            "ROW() <= 100",
            "ROW() % 2",
            "-1.5 < Z(score) < 1.5",
            "ROW() != 33 and ROW() != 37",
            "score <= 0.5"
        ];

        this.$el.empty();
        this.$el.addClass('jmv-filter-widget');
        this.$filterListButtons = $('<div class="jmv-filter-list-buttons"></div>').appendTo(this.$el);
        this.$filterList = $('<div class="jmv-filter-list-box"></div>').appendTo(this.$el);

        this.$addFilter = $('<div class="filter-button filter-button-tooltip add-filter" title="Add new filter" data-tippy-placement="left"><span class="mif-plus"></span></div>').appendTo(this.$filterListButtons);
        this.$addFilter.on('click', (event) => {
            this.$addFilter[0]._tippy.hide();
            this.$addFilter[0]._tippy.disable();
            this._addFilter();

        });
        this.$addFilter.on('mouseout', event => {
            this.$addFilter[0]._tippy.enable();
            this._clickedButton = false;
        });

        tippy(this.$addFilter[0], {
            placement: 'right',
            animation: 'perspective',
            duration: 200,
            delay: 700,
            flip: true,
            theme: 'jmv-filter'
        });

        this.model.dataset.on('dataSetLoaded', this._dataSetLoaded, this);
        this.model.dataset.on('columnsDeleted', event => this._columnsDeleted(event));
        this.model.dataset.on('columnsInserted', event => this._columnsInserted(event));
        this.model.dataset.on('columnsActiveChanged', event => this._columnsActiveChanged(event));
        this.model.dataset.on('columnsChanged', event => this._columnsChanged(event));

        this.$showFilter = $('<div class="filter-button filter-button-tooltip show-filter-columns" title="Show filter columns" data-tippy-placement="left" data-tippy-dynamictitle="true"></div>').appendTo(this.$filterListButtons);
        this.$showFilter.on('click', (event) => {
            this.$showFilter[0]._tippy.hide();
            this.$showFilter[0]._tippy.disable();

            let dataset = this.model.dataset;
            dataset.toggleFilterVisibility().then(() => {
                this._updateEyeButton();
            });

        });
        this.$showFilter.on('mouseout', event => {
            this.$showFilter[0]._tippy.enable();
        });

        tippy(this.$showFilter[0], {
            placement: 'right',
            animation: 'perspective',
            duration: 200,
            delay: 700,
            flip: true,
            theme: 'jmv-filter'
        });

    },
    _updateEyeButton() {
        let dataset = this.model.dataset;
        if (dataset.get('filtersVisible')) {
            this.$showFilter.removeClass('show-filter-columns');
            this.$showFilter.addClass('hide-filter-columns');
            this.$showFilter.attr('title', 'Hide filter columns');
        }
        else {
            this.$showFilter.removeClass('hide-filter-columns');
            this.$showFilter.addClass('show-filter-columns');
            this.$showFilter.attr('title', 'Show filter columns');
        }
    },
    _addFilter() {
        let dataset = this.model.dataset;
        let i = -1;
        let column = null;
        do {
            i += 1;
            column = dataset.getColumn(i);
        } while(column.columnType === 'filter');
        dataset.insertColumn(i, { columnType: 'filter', hidden: dataset.get('filtersVisible') === false }).then(() => {
            column = dataset.getColumn(i);
            this.model.setColumnForEdit(column.id);
        });
    },
    _columnsActiveChanged(event) {
        for (let c = event.start; c <= event.end; c++) {
            let column = this.model.dataset.getColumn(c);
            if (column.columnType === 'filter' && column.childOf === -1) {
                let $filter = this.$filterList.find('.jmv-filter-options[data-columnid=' + column.id + ']:not(.remove)');

                this._setActive($filter, event.value);
            }
        }
    },
    _getFilterDetails($filters, c) {
        let $filter = null;
        let x = 0;
        let y1 = 0;
        let y2 = 0;
        if ($filters.length === 0)
            return null;

        for (x = 0; x < $filters.length; x++) {
            $filter = $($filters[x]);
            let $formulaBoxes = $filter.find('.formula-box:not(.remove)');
            y1 = y2
            y2 += $formulaBoxes.length;
            if (c >= y1 && c < y2)
                break;
        }

        let details = { $filter: $filter, isBase: c === y1 };

        let $splitters = this.$filterList.find('.jmv-filter-splitter:not(.remove)');

        let sc = y1;
        if (y1 >= $splitters.length)
            sc = y1 - 1;

        details.$splitter = $($splitters[sc]);

        let g = c - y1;
        let $formulaBoxes = $filter.find('.formula-box:not(.remove)');
        details.$formulaBox = $($formulaBoxes[g]);

        return details;
    },
    _dataSetLoaded() {
        let columns = this.model.dataset.attributes.columns;
        let index = 0;
        for (let i = 0; i < columns.length; i++) {
            let column = columns[i];
            if (column.columnType !== 'filter')
                break;

            if (column.childOf === -1)
                this._createFilter(column, index++);
        }
    },
    _columnsDeleted(event) {
        let dataset = this.model.dataset;
        let removed = false;
        let $filters = this.$filterList.find('.jmv-filter-options:not(.remove)');
        for (let c = event.start; c <= event.end; c++) {

            let details = this._getFilterDetails($filters, c);
            if (details === null)
                break;

            removed = true;

            if (details.isBase) {
                details.$filter.one("webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend",
                (event) => {
                    details.$filter.remove();
                    details.$splitter.remove();
                });

                details.$filter.addClass('remove');
                details.$splitter.addClass('remove');


            }
            else {
                details.$formulaBox.one("webkitTransitionEnd otransitionend oTransitionEnd msTransitionEnd transitionend",
                (event) => {
                    details.$formulaBox.remove();
                });
                details.$formulaBox.addClass('remove');
            }
        }

        if (removed) {
            let columns = this.model.dataset.attributes.columns;
            let $filters = this.$filterList.find('.jmv-filter-options:not(.remove)');
            let data = [];
            let pIndex = 0;
            let nIndex = 2;
            for (let i = 0; i < columns.length; i++) {
                let column = columns[i];
                if (column.columnType !== 'filter')
                    break;

                if (column.childOf === -1) {
                    pIndex += 1;
                    nIndex = 2;
                    data.push({ id: column.id, values: { name: 'Filter ' + pIndex } } );
                }
                else {
                    data.push({ id: column.id, values: { name: 'F' + pIndex + '(' + nIndex + ')' } } );
                    nIndex += 1;
                }
            }
            if (data.length > 0)
                this.setColumnProperties($($filters[0]), data);
        }
    },
    _columnsInserted(event) {
        let column = this.model.dataset.getColumn(event.index);
        if (column.columnType === 'filter') {
            if (column.childOf === -1) {
                let columns = this.model.dataset.attributes.columns;
                let index = 0;
                for (let i = 0; i < columns.length; i++) {
                    let existingColumn = columns[i];
                    if (i >= event.index)
                        break;
                    if (existingColumn.columnType === 'filter') {
                        if (existingColumn.childOf === -1)
                            index += 1;
                    }
                    else
                        break;
                }
                this._createFilter(column, index);
            }
            else {
                let pColumn = this.model.dataset.getColumnById(column.childOf);
                let $filter = this.$filterList.find('.jmv-filter-options[data-columnid=' + pColumn.id + ']:not(.remove)');
                let $formulaList = $filter.find('.formula-list');
                let columns = this.model.dataset.attributes.columns;
                let index = 0;
                for (let i = 0; i < columns.length; i++) {
                    let existingColumn = columns[i];
                    if (i >= pColumn.index)
                        break;
                    if (existingColumn.columnType === 'filter') {
                        if (existingColumn.childOf === -1)
                            index += 1;
                    }
                    else
                        break;
                }
                this._createFormulaBox(pColumn, index, column, column.index - pColumn.index, $filter, $formulaList);
            }
            setTimeout(() => {
                this.$filterList.find('[contenteditable=false]').attr('contenteditable', 'true');
            }, 0);
        }
    },
    _columnsChanged(event) {

        for (let changes of event.changes) {

            if (changes.created || changes.deleted)
                continue;

            let column = this.model.dataset.getColumnById(changes.id);
            if (column.columnType !== 'filter')
                continue;

            let $formulaBox = this.$filterList.find('.formula-box[data-columnid=' + column.id + ']:not(.remove)');
            this._setFormula($formulaBox, column.formula, column.formulaMessage)

            if (column.childOf === -1) {
                let $filter = this.$filterList.find('.jmv-filter-options[data-columnid=' + column.id + ']:not(.remove)');

                let $label = $filter.find('.label');
                $label.text(column.name);

                this._setDescription($filter, column.description);
            }
        }
    },
    _removeFilter(id) {
        if (id === -1 && id !== null)
            return Promise.resolve();

        let dataset = this.model.dataset;
        let column = dataset.getColumnById(id);
        if (column.columnType !== 'filter')
            return Promise.resolve();

        let deleteFunction = (dF, id) => {
            let relatedColumns = this.columnsOf(id);
            if (relatedColumns.length === 0)
                return;

            relatedColumns.sort((a, b) => {
                if (a.index < b.index)
                    return -1;

                if (a.index > b.index)
                    return 1;

                return 0;
            });
            let dataset = this.model.dataset;
            let d = [];
            for (let i = 0; i < relatedColumns.length; i++) {
                if (d.length === 0) {
                    d[0] = relatedColumns[i].index;
                    d[1] = relatedColumns[i].index;
                }
                else if (relatedColumns[i].index === d[1] + 1)
                    d[1] = relatedColumns[i].index;
                else
                    break;
            }
            if (d.length === 2) {
                return dataset.deleteColumns(d[0], d[1]).then(() => {
                    return dF(dF, id);
                });
            }
        };

        return this.model.setColumnForEdit(id).then(() => {
            return deleteFunction(deleteFunction, id);
        });
    },

    _setFormula($formulaBox, formula, formulaMessage) {
        let $formula = $formulaBox.find('.formula');
        let $formulaMessage = $formulaBox.find('.formulaMessage');

        if ($formula.length === 0)
            $formula = $formula;
        $formula[0].textContent = formula;

        if (formulaMessage === '')
            $formula.removeClass('in-errror');
        else
            $formula.addClass('in-errror');
        $formulaMessage.text(formulaMessage);
    },
    _setDescription($filter, description) {
        let $description = $filter.find('.description');
        $description[0].textContent = description;
    },
    _setActive($filter, active) {
        let $status = $filter.find('.status');
        let $active = $filter.find('.active');
        if (active) {
            $status[0].textContent = 'active';
            $active.removeClass('filter-disabled');
            $active.attr('title', 'Filter is active');
        }
        else {
            $status[0].textContent = 'inactive';
            $active.addClass('filter-disabled');
            $active.attr('title', 'Filter is inactive');
        }


    },

    _createFormulaBox(parentColumn, pIndex, relatedColumn, rIndex, $filter, $formulaList) {
        let $formulaBox = $('<div class="formula-box" data-columnid="' + relatedColumn.id + '" data-parentid="' + parentColumn.id + '"></div>');

        let $list = $formulaList.find('.formula-box:not(.remove)');
        if (rIndex >= $list.length)
            $formulaBox.appendTo($formulaList);
        else
            $formulaBox.insertBefore($($list[rIndex]));

        $('<div class="equal">=</div>').appendTo($formulaBox);

        if (rIndex > 0) {
            let $removeNested = $('<div class="remove-nested" title="Remove nested filter"><span class="mif-cross"></span></div>').appendTo($formulaBox);
            this.removeNestedEvents($removeNested, relatedColumn.id);
        }
        else {
            let $addNested = $('<div class="add-nested" title="Add another nested filter"><span class="mif-plus"></span></div>').appendTo($formulaBox);
            this.addNestedEvents($addNested, parentColumn.id, $formulaBox);
        }

        let _example = this._exampleFormulas[Math.floor(Math.random() * Math.floor(this._exampleFormulas.length - 1))];
        let $formula = $('<div class="formula" type="text" placeholder="eg: ' + _example + '" contenteditable="true"></div>').appendTo($formulaBox);
        let $formulaMessageBox = $('<div class="formulaMessageBox""></div>').appendTo($formulaBox);
        let $formulaMessage = $('<div class="formulaMessage""></div>').appendTo($formulaMessageBox);

        if (rIndex > 0) {
            let subName = "F" + (pIndex + 1) + ' (' + (rIndex + 1) + ')';
            if (relatedColumn.name !== subName)
                this.setColumnProperties($filter, [{ id: relatedColumn.id, values: {  name: subName } }]);
        }

        $formula[0].textContent = relatedColumn.formula;
        $formulaMessage.text(relatedColumn.formulaMessage);
        if (relatedColumn.formulaMessage === '')
            $formula.removeClass('in-errror');
        else
            $formula.addClass('in-errror');

        $formula.addClass('selected');

        this.addEvents($filter, $formula, 'formula', relatedColumn.id);
    },

    _createFilter(column, index) {
        let edittingId = this.model.get("id");

        let $filters = this.$filterList.find('.jmv-filter-options:not(.remove)');

        let insertBefore = -1;
        if ($filters.length > 0 && index < $filters.length)
            insertBefore = index;

        let $filter = $('<div class="jmv-filter-options filter-hidden" data-columnid="' + column.id + '"></div>');
        if (insertBefore !== -1) {
            $filter.insertBefore($filters[insertBefore]);
            $('<div class="jmv-filter-splitter"></div>').insertAfter($filter);
        }
        else {
            $filter.appendTo(this.$filterList);
            if (index !== 0)
                $('<div class="jmv-filter-splitter"></div>').insertBefore($filter);
        }

        let $titleBox = $('<div class="title-box"></div>').appendTo($filter);
        $('<div class="label-parent"><div class="label">Filter ' + (index + 1) + '</div></div>').appendTo($titleBox);
        let $middle = $('<div class="middle-box"></div>').appendTo($titleBox);
        let $active = $('<div class="active" title="Filter is active"><div class="switch"></div></div>').appendTo($middle);
        let $status = $('<div class="status">active</div>').appendTo($middle);
        $('<div class="header-splitter"></div>').appendTo($titleBox);


        let $removeButton = $('<div class="remove-filter-btn" title="Remove filter"><span class="mif-cross"></span></div>');
        $removeButton.appendTo($titleBox);


        let $formulaList = $('<div class="formula-list"></div>').appendTo($filter);
        let $description = $('<div class="description" type="text" placeholder="Description"></div>').appendTo($filter);

        $removeButton.on('click', (event) => {
            this._removeFilter(column.id);
        });

        $filter.on('click', (event) => {
            this.model.dataset.set('editingVar', column.index);
        });

        let relatedColumns = this.columnsOf(column.id);
        for (let i = 0; i < relatedColumns.length; i++)
            this._createFormulaBox(column, index, relatedColumns[i].column, i, $filter, $formulaList);


        let name = $filter.find('.label')[0].textContent;
        if (column.name !== name)
            this.setColumnProperties($filter, [{ id: column.id, values: {  name: name } }]);

        $active.removeClass('filter-disabled');
        $status[0].textContent = column.active ? 'active' : 'inactive';
        if ( ! column.active)
            $active.addClass('filter-disabled');

        let activeChanged = (event) => {

            let active = column.active;
            let related = this.columnsOf(column.id);
            let pairs = [];
            for (let colInfo of related)
                pairs.push({id: colInfo.column.id, values: { active: !active } });

            this.setColumnProperties($filter, pairs);
            event.stopPropagation();
            event.preventDefault();
        };


        $active.on('click', activeChanged);
        $status.on('click', activeChanged);

        $description[0].textContent = column.description;

        this.addEvents($filter, $description, 'description', column.id);

        $description.attr('contenteditable', 'true');

        setTimeout(() => {
            $filter.removeClass('filter-hidden');
        }, 10);
    },
    focusOn($element) {
        setTimeout(() => {
            this._internalCreate = false;
            $element.focus();
            $element.select();
        }, 0);
    },
    setColumnProperties($filter, pairs) {
        if (pairs.length === 0)
            return;

        let $title = $filter.find(".title-box");
        let timeoutId = setTimeout(function () {
            $title.addClass('think');
        }, 400);
        return this.model.dataset.changeColumns(pairs).then(() => {
            clearTimeout(timeoutId);
            $title.removeClass("think");
        });
    },
    addNestedEvents($element, id) {
        $element.on('click', (event) => {
            let dataset = this.model.dataset;
            let relatedColumns = this.columnsOf(id);
            let index =relatedColumns[relatedColumns.length - 1].index + 1;
            dataset.insertColumn(index, { columnType: 'filter', childOf: id, hidden: dataset.get('filtersVisible') === false, active: relatedColumns[0].column.active }).then(() => {
                let column = dataset.getColumn(index);
                this._internalCreate = true;
                this.model.setColumnForEdit(column.id);
            });
            event.stopPropagation();
            event.preventDefault();
        });
    },
    removeNestedEvents($element, id) {
        $element.on('click', (event) => {
            let dataset = this.model.dataset;
            dataset.deleteColumn(id);

            event.stopPropagation();
            event.preventDefault();
        });
    },
    addEvents($filter, $element, name, columnId) {
        $element.data('id', columnId);

        $element.on('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
        });

        $element.focus(() => {
            keyboardJS.pause();
            let column = this.model.dataset.getColumnById(columnId);
            this.model.dataset.set('editingVar', column.index);
        });
        $element.blur((event) => {
            keyboardJS.resume();
            let data = { };
            data[name] = $element[0].textContent;
            this.setColumnProperties($filter, [{ id: columnId, values: data }]);
        });
        $element.on('keydown', (event) => {
            if (event.keyCode === 13 && event.shiftKey === false) {    //enter
                let data = { };
                data[name] = $element[0].textContent;
                this.setColumnProperties($filter, [{ id: columnId, values: data }]).then(() => {
                    $element.blur();
                });
                event.preventDefault();
            }

            if (event.keyCode === 9) {    //tab
                event.preventDefault();
            }
        });
    },
    _moveRight() {
        let dataset = this.model.dataset;
        let colNo = dataset.attributes.editingVar;
        colNo++;
        if (colNo <= dataset.attributes.vColumnCount - 1) {
            let column = dataset.getColumn(colNo);
            if (column.columnType === 'filter')
                dataset.set('editingVar', colNo);
        }
    },
    _moveLeft() {
        let dataset = this.model.dataset;
        let colNo = dataset.attributes.editingVar;
        colNo--;
        if (colNo >= 0) {
            let column = dataset.getColumn(colNo);
            if (column.columnType === 'filter')
                dataset.set('editingVar', colNo);
        }
    },
    detach() {
        if ( ! this.attached)
            return;
        this.$filterList.find('[contenteditable=true]').attr('contenteditable', 'false');

        this.attached = false;
    },
    columnsOf(id) {
        let dataset = this.model.dataset;
        let children = [];
        let columns = dataset.get("columns");
        for (let i = 0; i < columns.length; i++) {
            let col = columns[i];
            if (col.columnType === 'filter') {
                let parent = col.id === id || col.childOf === id;
                if (parent) {
                    if (col.id === id)
                        children.unshift({ column: col, index: i });
                    else
                        children.push({ column: col, index: i });
                }
            }
        }
        return children;
    },
    attach() {

        this.attached = true;

        this.update();

        setTimeout(() => {
            this.$filterList.find('[contenteditable=false]').attr('contenteditable', 'true');
        }, 0);

    },
    update() {
        this._updateEyeButton();

        let $filters = this.$filterList.find('.jmv-filter-options:not(.remove)');

        let edittingIndex = this.model.dataset.get('editingVar');
        for (let i = 0; i < $filters.length; i++) {
            let $filter = $($filters[i]);

            let columnId = parseInt($filter.data('columnid'));
            $filter.removeClass('selected');

            let relatedColumns = this.columnsOf(columnId);
            for (let rc = 0; rc < relatedColumns.length; rc++) {
                let relatedColumn = relatedColumns[rc];
                if (relatedColumn.index === edittingIndex) {
                    $filter.addClass('selected');
                    if (edittingIndex === relatedColumn.index) {
                        let $formula = $($filter.find('.formula')[rc]);
                        $formula.addClass('selected');
                        if (this._internalCreate) {
                            this.focusOn($formula);
                        }
                    }
                }
            }
        }
    }
});

module.exports = FilterWidget;
