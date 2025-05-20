
'use strict';

const $ = require('jquery');

import TitledGridControl from './titledgridcontrol';
import OptionControl from './optioncontrol';
import ChildLayoutSupport from './childlayoutsupport';
import EnumPropertyFilter from './enumpropertyfilter';
const FormatDef = require('./formatdef');
const Icons = require('./iconsupport');
const focusLoop = require('../common/focusloop');

export class LayoutGroupView extends TitledGridControl {
    static create(params) {
        let isOptionControl = params.label === undefined;
        if (isOptionControl)
            return new OptionedLabel(params);
        else {
            return new Label(params);
        }
    }

    constructor(params, isOptionControl) {
        super(params);

        this.isOptionControl = isOptionControl;

        if (isOptionControl === false)
            this.registerSimpleProperty("label", "");

        Icons.addSupport(this);

        this.style = this.getPropertyValue('style');

        let groupText = "";
        if (isOptionControl === false)
            groupText = this.getPropertyValue('label');

        if (groupText === null)
            groupText = "";

        groupText = this.translate(groupText);

        let classes = groupText === "" ? "silky-control-label-empty" : "";

        let hasChildren = this.hasProperty('controls');

        if (hasChildren === false) {
            if (params.cell && params.verticalAlignment === undefined) {
                this.setPropertyValue('verticalAlignment', 'center');
            }
        }
        
        let isHeading = true;
        if (hasChildren === false)
            isHeading = this.getPropertyValue('heading');
            
        classes += hasChildren === false ? ' no-children' : '';
        classes += isHeading ? ' heading-formating' : '';

        this.labelId = focusLoop.getNextAriaElementId('label');
        this.$_subel = $(`<div id="${ this.labelId }" role="heading" aria-level="3" class="silky-control-label silky-control-margin-${ this.getPropertyValue("margin") } ${ classes }" style="white-space: nowrap;"><span>${ groupText }</span></div>`);
        this.$el = this.$_subel;

        if (Icons.exists(this)) {
            this.$icons = Icons.get(this);
            let iconPosition = Icons.position(this);
            if (iconPosition === 'right')
                this.$_subel.append(this.$icons);
            else
                this.$_subel.prepend(this.$icons);
        }
    }

    protected registerProperties(properties) {
        super.registerProperties(properties);

        this.registerSimpleProperty("style", "list", new EnumPropertyFilter(["list", "inline", "list-inline", "inline-list"], "list"));
        this.registerSimpleProperty("margin", "large", new EnumPropertyFilter(["small", "normal", "large", "none"], "large"));
        this.registerSimpleProperty("format", FormatDef.string);
        this.registerSimpleProperty("heading", false);
    }
    

    onI18nChanged() {
        let label = null;
        if (this.isOptionControl) {
            let format = this.getPropertyValue('format');
            label = format.toString(this.getValue());
        }
        else
            label = this.getPropertyValue('label');
        this.setLabel(label);
    }

    setLabel(value) {
        if (value === null)
            value = '';

        value = this.translate(value);

        this.$_subel.html('<span>' + value + '</span>');
        this.$_subel.trigger("contentchanged");

        if (value === "")
            this.$_subel.addClass("silky-control-label-empty");
        else
            this.$_subel.removeClass("silky-control-label-empty");
    }
}

export class Label extends ChildLayoutSupport(LayoutGroupView) {
    constructor(params) {
        super(params, false);
    }

    onPropertyChanged(name) {
        super.onPropertyChanged(name);

        if (name === 'label')
            this.setLabel(this.getPropertyValue(name));
    }

    setValue(value) {
        this.setPropertyValue("label", value);
    }
}

export class OptionedLabel extends ChildLayoutSupport(OptionControl(LayoutGroupView)) {
    constructor(params) {
        super(params, true);
    }

    onPropertyChanged(name) {
        super.onPropertyChanged(name);

        if (name === 'enable') {
            let disabled = this.getPropertyValue(name) === false;
            if (disabled)
                this.$_subel.addClass('disabled-text');
            else
                this.$_subel.removeClass('disabled-text');
        }
    }

    onOptionValueChanged(key, data) {
        super.onOptionValueChanged(key, data);
        let format = this.getPropertyValue('format');
        this.setLabel(format.toString(this.getValue()));
    }
}

export default LayoutGroupView;
