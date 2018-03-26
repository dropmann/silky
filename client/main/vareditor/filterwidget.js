
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

        this.$showFilter = $('<div class="filter-button filter-button-tooltip show-filter-columns" title="Show filter columns" data-tippy-placement="left" data-tippy-dynamictitle="true"></div>').appendTo(this.$filterListButtons);
        this.$showFilter.on('click', (event) => {
            this.$showFilter[0]._tippy.hide();
            this.$showFilter[0]._tippy.disable();

            let dataset = this.model.dataset;
            dataset.toggleFilterVisibility().then(() => {
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

        this.model.on('change:formula', (event) => this._setFormula(event.changed.formula));
        this.model.on('change:formulaMessage', (event) => this._setFormulaMessage(event.changed.formulaMessage));
        this.model.on('change:description', (event) => this._setDescription(event.changed.description));
        this.model.on('change:active', (event) => this._setActive(event.changed.active));
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
    _setFormula(formula) {
        if ( ! this.attached)
            return;
        this.$formula[0].textContent = formula;
    },
    _setDescription(description) {
        if ( ! this.attached)
            return;
        this.$description[0].textContent = description;
    },
    _setActive(active) {
        if ( ! this.attached)
            return;
        if (active) {
            this.$status[0].textContent = 'active';
            this.$active.removeClass('filter-disabled');
            this.$active.attr('title', 'Filter is active');
        }
        else {
            this.$status[0].textContent = 'inactive';
            this.$active.addClass('filter-disabled');
            this.$active.attr('title', 'Filter is inactive');
        }


    },
    _setFormulaMessage(formulaMessage) {
        if ( ! this.attached)
            return;

        if (formulaMessage === '')
            this.$formula.removeClass('in-errror');
        else
            this.$formula.addClass('in-errror');
        this.$formulaMessage.text(formulaMessage);
    },

    _createFilter(column, index, columnIndex) {
        let edittingId = this.model.get("id");
        let $filter = null;
        let $removeButton = null;

        if (index >= this.$filters.length) {
            if (index !== 0)
                $('<div class="jmv-filter-splitter"></div>').appendTo(this.$filterList);
            $filter = $('<div class="jmv-filter-options filter-hidden"></div>').appendTo(this.$filterList);
            let $titleBox = $('<div class="title-box"></div>').appendTo($filter);
            $('<div class="label-parent"><div class="label">Filter ' + (index + 1) + '</div></div>').appendTo($titleBox);
            let $status = $('<div class="status">active</div>').appendTo($titleBox);
            $('<div class="active" title="Filter is active"><div class="switch"></div></div>').appendTo($titleBox);
            $('<div class="header-splitter"></div>').appendTo($titleBox);


            $removeButton = $('<div class="remove-filter-btn" title="Remove filter"><span class="mif-cross"></span></div>');
            $removeButton.appendTo($titleBox);


            //$('<div class="title" type="text" placeholder="Name"></div>').appendTo($titleBox);
            $('<div class="formula-list"></div>').appendTo($filter);
            $('<div class="description" type="text" placeholder="Description"></div>').appendTo($filter);
        }
        else
            $filter = $(this.$filters[index]);

        if ($removeButton === null)
            $removeButton = $filter.find('.remove-filter-btn');
        $removeButton.off();
        $removeButton.on('click', (event) => {
            this._removeFilter(column.id);
        });

        $filter.data('columnIndex', columnIndex);
        $filter.data('columnId', column.id);
        $filter.removeClass('selected');

        $filter.off();
        $filter.on('click', (event) => {
            this.model.apply().then(() => {
                this.model.setColumnForEdit(column.id);
            });

        });


        let $formulaList = $filter.find('.formula-list');

        let relatedColumns = this.columnsOf(column.id);
        let $formulas = $filter.find('.formula-box');
        if (relatedColumns.length < $formulas.length) {
            for (let i = relatedColumns.length; i < $formulas.length; i++)
                $($formulas[i]).remove();
        }
        for (let i = 0; i < relatedColumns.length; i++) {
            let relatedColumn = relatedColumns[i].column;
            let $formulaBox = null;

            if (i >= $formulas.length) {
                $formulaBox = $('<div class="formula-box"></div>').appendTo($formulaList);
                $('<div class="equal">=</div>').appendTo($formulaBox);

                if (i > 0)
                    $('<div class="remove-nested" title="Remove nested filter"><span class="mif-cross"></span></div>').appendTo($formulaBox);
                else
                    $('<div class="add-nested" title="Add another nested filter"><span class="mif-plus"></span></div>').appendTo($formulaBox);

                $('<div class="formula" type="text" placeholder="Example formula: A > 4\u2026"></div>').appendTo($formulaBox);
                let $formulaMessageBox = $('<div class="formulaMessageBox""></div>').appendTo($formulaBox);
                $('<div class="formulaMessage""></div>').appendTo($formulaMessageBox);
            }
            else
                $formulaBox = $($formulas[i]);


            if (i > 0) {
                let subName = "F" + (index + 1) + ' - ' + i;
                if (relatedColumn.name !== subName)
                    this.setColumnProperties($filter, [{ id: relatedColumn.id, values: {  name: subName } }]);
            }

            let $addNested = $formulaBox.find('.add-nested');
            if ($addNested.length > 0) {
                $addNested.off();
                this.addNestedEvents($addNested, column.id, $formulaBox);
            }

            let $removeNested = $formulaBox.find('.remove-nested');
            if ($removeNested.length > 0) {
                $removeNested.off();
                this.removeNestedEvents($removeNested, relatedColumn.id);
            }

            let $formula = $formulaBox.find('.formula');
            if (this._internalCreate && edittingId === relatedColumn.id) {
                this.focusOn($formula);
            }


            let $formulaMessage = $formulaBox.find('.formulaMessage');

            this.removeEvents($formula);


            $formula[0].textContent = relatedColumn.formula;
            $formulaMessage.text(relatedColumn.formulaMessage);
            if (relatedColumn.formulaMessage === '')
                $formula.removeClass('in-errror');
            else
                $formula.addClass('in-errror');

            $formula.removeClass('selected');

            if (edittingId === relatedColumn.id) {
                this.$formulaMessage = $formulaMessage;
                this.$formula = $formula;

                $formula.addClass('selected');
                $filter.addClass('selected');
            }

            this.addEvents($formula, 'formula', edittingId === relatedColumn.id, relatedColumn.id);

            $formula.attr('contenteditable', 'true');
        }


        let $description = $filter.find('.description');
        let $status = $filter.find('.status');
        let $active = $filter.find('.active');

        let name = $filter.find('.label')[0].textContent;
        if (column.name !== name)
            this.setColumnProperties($filter, [{ id: column.id, values: {  name: name } }]);

        this.removeEvents($description);

        $active.removeClass('filter-disabled');
        $status[0].textContent = column.active ? 'active' : 'inactive';
        if ( ! column.active)
            $active.addClass('filter-disabled');

        $active.off();
        $active.on('click', (event) => {
            this.model.setColumnForEdit(column.id).then(() => {
                let active = this.model.get('active');
                let related = this.columnsOf(column.id);
                let pairs = [];
                for (let colInfo of related)
                    pairs.push({id: colInfo.column.id, values: { active: !active } });

                this.setColumnProperties($filter, pairs);
            });
            event.stopPropagation();
            event.preventDefault();
        });

        $description[0].textContent = column.description;

        if (edittingId === column.id) {
            this.$description = $description;
            this.$status = $status;
            this.$active = $active;
            this.$filter = $filter;
        }

        this.addEvents($description, 'description', edittingId === column.id, column.id);

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
        this.model.dataset.changeColumns(pairs).then(() => {
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
    addEvents($element, name, editting, columnId) {
        $element.data('id', columnId);

        $element.on('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
        });

        if (editting) {
            $element.focus(() => {
                keyboardJS.pause();
            });
            $element.blur((event) => {
                keyboardJS.resume();
                this.model.apply();
            });
            $element.on('keydown', (event) => {
                if (event.keyCode === 13 && event.shiftKey === false) {    //enter
                    this.model.apply().then(() => {
                        $element.blur();
                    });
                    event.preventDefault();
                }

                if (event.keyCode === 9) {    //tab
                    event.preventDefault();
                }
            });
            $element.on('input', (event) => {
                this.model.set(name, $element[0].textContent);
            });
        }
        else {
            $element.on('focus', (event) => {
                keyboardJS.pause();
                let colId = $element.data('id');
                if (colId === this.model.get("id"))
                    return;

                this.model.apply().then(() => {
                    this.model.setColumnForEdit(colId);
                });
            });
        }
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
    removeEvents($element) {
        $element.off();
    },
    detach() {
        if ( ! this.attached)
            return;
        this.model.apply();

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

        let dataset = this.model.dataset;

        this.$filterList = this.$el.find('.jmv-filter-list-box');

        this.$filters = this.$filterList.find('.jmv-filter-options');

        let $splitters =  this.$filterList.find('.jmv-filter-splitter');

        let columns = dataset.get("columns");
        let filterColumns = [];
        for (let i = 0; i < columns.length; i++) {
            let col = columns[i];
            if (col.columnType === 'filter') {
                if (col.childOf === -1)
                    filterColumns.push({ column: col, index: i });
            }
        }

        let $widgets = this.$filterList.find('.jmv-filter-options');

        if (filterColumns.length < $widgets.length) {
            for (let i = filterColumns.length; i < $widgets.length; i++) {
                $($widgets[i]).remove();
                if (i !== 0)
                    $($splitters[i-1]).remove();
            }
        }
        for (let i = 0; i < filterColumns.length; i++) {
                this._createFilter(filterColumns[i].column, i, filterColumns[i].index);
        }

        this.$filters = this.$filterList.find('.jmv-filter-options');

        setTimeout(() => {
            this.$filterList.find('[contenteditable=false]').attr('contenteditable', 'true');
        }, 0);

        //this.$addFilter[0]._tippy.enable();
        //this.$removeFilter[0]._tippy.enable();
    }
});

module.exports = FilterWidget;
