'use strict';

const $ = require('jquery');
import OptionControl from './optioncontrol';
import TitledGridControl from './titledgridcontrol';
import ChildLayoutSupport from './childlayoutsupport';
const FormatDef = require('./formatdef');
const Icons = require('./iconsupport');
const focusLoop = require('../common/focusloop');


export class GridCheckbox extends ChildLayoutSupport(OptionControl(TitledGridControl)) {
    constructor(params) {
        super(params);

        Icons.addSupport(this);
    
        this.$_subel = $('<div role="presentation" class="silky-option-checkbox silky-control-margin-' + this.getPropertyValue("margin") + '" style="white-space: nowrap;"></div>');
    
        this.$el = this.$_subel;
    
        let horizontalAlign = this.getPropertyValue("horizontalAlignment");
        this.$_subel.attr('data-horizontal-align', horizontalAlign);
    }

    protected registerProperties(properties) {
        super.registerProperties(properties);

        this.registerSimpleProperty("format", FormatDef.bool);
    }

    onPropertyChanged(name) {
        super.onPropertyChanged(name);
        if (name === 'enable') {
            let enabled = this.getPropertyValue(name);
            this.$_subel.find('input').prop('disabled', enabled === false);
            if (enabled)
                this.$_subel.removeClass('disabled-text');
            else
                this.$_subel.addClass('disabled-text');
        }
    }

    getValue(keys) {
        if (this.checkedValue === null)
            return super.getValue(keys);

        let value = super.getValue([]);
        if (value === null)
            return false;

        if (Array.isArray(value) === false)
            return false;

        for (let i = 0; i < value.length; i++) {
            if (value[i] === this.checkedValue)
                return true;
        }

        return false;
    }

    setValue(value, keys) {
        if (this.checkedValue === null)
            return super.setValue(value, keys);

        let list = this.getSourceValue();
        if (list === null || Array.isArray(list) === false)
            list = [];
        else
            list = list.slice(0);

        if (value === false) {
            for (let i = 0; i < list.length; i++) {
                if (list[i] === this.checkedValue) {
                    list.splice(i, 1);
                    break;
                }
            }
        }
        else {
            let found = false;
            for (let i = 0; i < list.length; i++) {
                if (list[i] === this.checkedValue) {
                    found = true;
                    break;
                }
            }
            if (found === false)
                list.push(this.checkedValue);
        }

        return super.setValue(list);
    }

    createItem() {
        let type = "checkbox";
        this.checkedValue = this.getPropertyValue('optionPart');

        let value = this.getSourceValue();
        let label = this.getTranslatedProperty('label');
        if (label === null)
            label = this.getTranslatedProperty('name');

        this.labelId = focusLoop.getNextAriaElementId('label');
        let $checkbox = $(`<label id="${this.labelId}" style="white-space: nowrap;"></label>`);
        this.$input = $('<input class="silky-option-input" tabindex="0" type="checkbox" value="value" ' +  (value ? 'checked' : '') + ' >');
        this.$label = $('<span>' + label + '</span>');
        $checkbox.append(this.$input);
        $checkbox.append(this.$label);
        this.$_subel.append($checkbox);

        if (Icons.exists(this)) {
            this.$icons = Icons.get(this);
            let iconPosition = Icons.position(this);
            if (iconPosition === 'right')
                this.$_subel.append(this.$icons);
            else
                this.$_subel.prepend(this.$icons);
        }

        this.$input.on('click', (event) => {
            let enabled = this.getPropertyValue('enable');
            if ( ! enabled) {
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
        });

        this.$input.change((event) => {
            let value = this.$input[0].checked;
            this.setValue(value);
        });
    }

    onOptionValueChanged(key, data) {
        super.onOptionValueChanged(key, data);
        if (this.$input)
            this.$input.prop('checked', this.getValue());
    }
}

module.exports = GridCheckbox;
