
'use strict';

const LayoutSupplierView = require('./layoutsupplierview');
const FormatDef = require('./formatdef');
const EnumArrayPropertyFilter = require('./enumarraypropertyfilter');
const RequestDataSupport = require('./requestdatasupport');
const EnumPropertyFilter = require('./enumpropertyfilter');

const LayoutVariablesView = function(params) {

    LayoutSupplierView.extendTo(this, params);
    RequestDataSupport.extendTo(this);

    this.$el.addClass("silky-options-variable-supplier-group");

    this.registerSimpleProperty("suggested", [], new EnumArrayPropertyFilter(["continuous", "ordinal", "nominal", "nominaltext", "id"]));
    this.registerSimpleProperty("permitted", [], new EnumArrayPropertyFilter(["continuous", "ordinal", "nominal", "nominaltext", "id", "numeric", "factor"]));
    this.registerSimpleProperty("populate", "auto", new EnumPropertyFilter(["auto", "manual"], "auto"));
    this.registerSimpleProperty("format", FormatDef.variable);

    this._override("onContainerRendering", function(baseFunction, context) {

        //this.resources = context.resources;

        baseFunction.call(this, context);

        let promise = this.requestData("columns", null);
        promise.then(columnInfo => {
            this.resources = columnInfo;
            this.populateItemList();
        });

        //this.populateItemList();
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
        let promise = this.requestData("column", { columnId: columnId, properties: [ "measureType", "id", "hidden", "columnType", "dataType" ] });
        promise.then(rData => {
            if (rData.measureType === undefined)
                rData.measureType = "none";

            item.properties.measureType = rData.measureType;
            item.properties.dataType = rData.dataType;
            item.properties.columnId = rData.id;
            item.properties.hidden = rData.hidden;
            item.properties.columnType = rData.columnType;
          });
        return promise;
    };

    this._waitingFor = 0;

    this._checkPermitted = function(column, permitted) {
        let measureType = column.measureType;
        if ((column.measureType === 'nominal' || column.measureType === 'ordinal') && column.dataType === 'text')
            measureType = column.measureType + 'text';
        if (permitted.includes(measureType))
            return true;

        if (column.measureType === 'id')
            return false;
        else if ((column.measureType === 'nominal' || column.measureType === 'ordinal') && permitted.includes('factor'))
            return true;
        else if ((column.dataType === 'integer' || column.dataType === 'decimal') && permitted.includes('numeric'))
            return true;

        return false;
    };

    this.populateItemList = function() {

        let populateMethod = this.getPropertyValue('populate');
        if (populateMethod === "manual")
            return;

        let suggested = this.getPropertyValue("suggested");
        let permitted = this.getPropertyValue("permitted");

        if (permitted.length === 0)
            permitted = ['factor', 'numeric'];

        let suggestedCount = 0;
        let permittedCount = 0;

        let items = [];
        let columns = this.resources.columns;
        let promises = [];

        let process = (column, item) => {
            return this.requestMeasureType(column.id, item).then(() => {
                if (item.properties.hidden || item.properties.columnType === 'filter')
                    return;

                if (suggested && this._contains(column.measureType, suggested)) {
                    items.splice(suggestedCount, 0, item);
                    suggestedCount += 1;
                }
                else if (permitted && this._checkPermitted(column, permitted)) {
                    items.splice(suggestedCount + permittedCount, 0, item);
                    permittedCount += 1;
                }
                else {
                    items.push(item);
                    item.properties.permitted = permitted.length === 0;
                }
            });
        };

        for (let i = 0; i < columns.length; i++) {
            let column = columns[i];
            if (column.measureType === 'none')
                continue;
            let item = { value: new FormatDef.constructor(column.name, FormatDef.variable), properties: {  id: column.id, permitted: true } };

            promises.push(process(column, item));
        }

        Promise.all(promises).then(() => {
            this.setList(items);
        });
    };

    this._contains = function(value, list) {
        for (let i = 0; i < list.length; i++) {
            if (value === list[i])
                return true;
        }
        return false;
    };
};

module.exports = LayoutVariablesView;
