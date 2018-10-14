
'use strict';

const LayoutSupplierView = require('./layoutsupplierview');
const FormatDef = require('./formatdef');
const EnumArrayPropertyFilter = require('./enumarraypropertyfilter');
const RequestDataSupport = require('./requestdatasupport');
const EnumPropertyFilter = require('./enumpropertyfilter');
const ToolbarButton = require('../common/toolbar/toolbarbutton');
const ToolbarSeparator = require('../common/toolbar/toolbarseparator');
const ToolbarGroup = require('../common/toolbar/toolbargroup');

const OutputVariableSuppler = function(params) {

    LayoutSupplierView.extendTo(this, params);
    RequestDataSupport.extendTo(this);

    this.$el.addClass("silky-options-output-variable-supplier");

    this.registerSimpleProperty("populate", "auto", new EnumPropertyFilter(["auto", "manual"], "auto"));
    this.registerSimpleProperty("format", FormatDef.variable);

    this._override("requestedTransferButtons", (baseFunction, buttons, transferAction) => {
        if (baseFunction)
            baseFunction.call(this, buttons, transferAction);

        let button = new ToolbarButton({ title: '', name: 'create', size: 'small', classes: 'jmv-variable-transfer-collection jmv-variable-create-transfer', items: [
                /*new ToolbarGroup({ title: 'Output Variable', orientation: 'vertical', titlePosition: 'top', items: [
                    new ToolbarButton({ title: 'Insert', name: 'appendOutputVar', hasIcon: true, resultFormat: FormatDef.variable }),
                    new ToolbarButton({ title: 'Append', name: 'appendOutputVar', hasIcon: true, resultFormat: FormatDef.variable })
                ]})*/

                new ToolbarButton({ title: 'Create New Output Variable...', name: 'appendOutputVar', hasIcon: false, resultFormat: FormatDef.variable })
                /*new ToolbarButton({ title: 'Insert...', name: 'insertOutputVar', hasIcon: true, resultFormat: FormatDef.variable })*/
            ]});

        buttons.unshift(button);
    });

    this._override("onContainerRendering", function(baseFunction, context) {

        baseFunction.call(this, context);

        let promise = this.requestData("columns", null);
        promise.then(columnInfo => {
            this.resources = columnInfo;
            this.populateItemList();
        });
    });

    this._override("onDataChanged", (baseFunction, data) => {
        if (data.dataType !== "columns")
            return;

        if (data.dataInfo.nameChanged || data.dataInfo.measureTypeChanged || data.dataInfo.dataTypeChanged || data.dataInfo.countChanged) {
            let promise = this.requestData("columns", null);
            promise.then(columnInfo => {
                this.resources = columnInfo;
                this.populateItemList();
            });
        }
    });

    this.requestMeasureType = function(columnId, item) {
        let promise = this.requestData("column", { columnId: columnId, properties: ["id", "columnType", "outputFrom" ] });
        promise.then(rData => {

            item.properties.outputFrom = rData.outputFrom;
            item.properties.columnId = rData.id;
            item.properties.columnType = rData.columnType;
          });
        return promise;
    };

    this._checkPermitted = function(column) {
        return column.columnType === 'output' && column.outputFrom === 0;
    };

    this.populateItemList = function() {

        let populateMethod = this.getPropertyValue('populate');
        if (populateMethod === "manual")
            return;

        let permittedCount = 0;

        let items = [];
        let columns = this.resources.columns;
        let promises = [];

        let process = (column, item) => {
            return this.requestMeasureType(column.id, item).then(() => {
                if (this._checkPermitted(column)) {
                    items.splice(permittedCount, 0, item);
                    permittedCount += 1;
                }
                else {
                    items.push(item);
                    item.properties.permitted = false;
                }
            });
        };

        for (let i = 0; i < columns.length; i++) {
            let column = columns[i];
            if (column.columnType !== 'output')
                continue;

            let item = { value: new FormatDef.constructor(column.name, FormatDef.variable), properties: {  id: column.id, permitted: true } };

            promises.push(process(column, item));
        }

        Promise.all(promises).then(() => {
            this.setList(items);
        });
    };
};

module.exports = OutputVariableSuppler;
