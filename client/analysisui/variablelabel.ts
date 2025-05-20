'use strict';

const $ = require('jquery');
import OptionControl from './optioncontrol';
import TitledGridControl from './titledgridcontrol';
const RequestDataSupport = require('./requestdatasupport');
const FormatDef = require('./formatdef');
const focusLoop = require('../common/focusloop');

export class VariableLabel extends OptionControl(TitledGridControl) {
    constructor(params) {
        super(params);

        RequestDataSupport.extendTo(this);

        this.$icon = null;
        this.$label = null;
        this.$el = $('<div style="white-space: nowrap;" class="silky-list-item silky-format-variable"></div>');
    
        this._updateCount = 0;
    }

    protected registerProperties(properties) {
        super.registerProperties(properties);

        this.registerSimpleProperty("format", FormatDef.variable);
    }

    onDataChanged(data) {
        if (data.dataType !== "columns")
            return;

        if (data.dataInfo.measureTypeChanged || data.dataInfo.dataTypeChanged || data.dataInfo.countChanged)
            this.updateView();
    }

    getAriaLabel() {
        let format = this.getPropertyValue('format');
        let value = this.getValue();
        return format.toAriaLabel(value);
    }

    createItem() {
        let displayValue = this.getValue();
        if (displayValue === null)
            displayValue = '';

        this.labelId = focusLoop.getNextAriaElementId('label');

        this.$label = $(`<div id="${this.labelId}" aria-label="${ this.getAriaLabel() }" style="white-space: nowrap;  display: inline-block;" class="silky-list-item-value">${ displayValue }</div>`);
        this.$icon = $('<div class="silky-variable-type-img" style="display: inline-block; overflow: hidden;"></div>');

        this.$el.append(this.$icon);
        this.$el.append(this.$label);
    }

    addedContentToCell(cell) {
        let displayValue = this.getValue();
        if (displayValue === null)
            displayValue = '';
        this._cell = cell;
        this._updateIcon(displayValue);
    }

    _updateIcon(columnName) {
        this._updateCount += 1;
        let promise = this.requestData("column", { columnName: columnName, properties: [ "measureType", "dataType" ], requestId: this._updateCount });
        promise.then(rData => {
            if (rData.requestData.requestId !== this._updateCount)
                return;

            this.$icon.removeClass();

            if (rData.columnFound === false)
               this.$el.addClass('unavaliable_variable');
           else
               this.$el.removeClass('unavaliable_variable');

            let measureType = rData.measureType;
            if (measureType === undefined)
                measureType = "none";
            let dataType = rData.dataType;
            if (dataType === undefined)
                dataType = "none";
            var imageClasses = 'silky-variable-type-img';
            if (measureType !== null && measureType !== undefined)
                imageClasses = imageClasses + ' silky-variable-type-' + measureType;
            else
                imageClasses = imageClasses + ' silky-variable-type-none';

            if (dataType !== null && dataType !== undefined)
                imageClasses = imageClasses + ' jmv-data-type-' + dataType;
            else
                imageClasses = imageClasses + ' jmv-data-type-none';

            this.$icon.addClass(imageClasses);
        });
    };

    onOptionValueChanged(key, data) {
        super.onOptionValueChanged(key, data);
        this.updateView();
    }

    updateView() {
        if (this.$label === null)
            return;

        let displayValue = this.getValue();
        this.$label.text(displayValue);
        this._updateIcon(displayValue);
        this.$label.attr('aria-label', this.getAriaLabel());
    }
}

export default VariableLabel;
