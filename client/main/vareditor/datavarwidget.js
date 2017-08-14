
'use strict';

const _ = require('underscore');
const $ = require('jquery');
const Backbone = require('backbone');
Backbone.$ = $;
const keyboardJS = require('keyboardjs');

const DataVarWidget = Backbone.View.extend({
    className: 'DataVarWidget',
    initialize(args) {

        this.attached = true;

        this.$el.empty();
        this.$el.addClass('silky-variable-editor-datavarwidget');

        this.$body = $('<div class="silky-variable-editor-widget-body"></div>').appendTo(this.$el);
        this.$left = $('<div class="silky-variable-editor-widget-left"></div>').appendTo(this.$body);
        this.$types = $('<div class="silky-variable-editor-widget-types"></div>').appendTo(this.$left);
        this.$autoType = $('<div class="silky-variable-editor-autotype">(auto adjusting)</div>').appendTo(this.$left);
        this.$levels = $('<div class="silky-variable-editor-levels"></div>').appendTo(this.$body);
        this.$levelItems = $();

        this.$move = $('<div class="silky-variable-editor-widget-move"></div>').appendTo(this.$body);
        this.$moveUp = $('<div class="silky-variable-editor-widget-move-up"><span class="mif-arrow-up"></span></div>').appendTo(this.$move);
        this.$moveDown = $('<div class="silky-variable-editor-widget-move-down"><span class="mif-arrow-down"></span></div>').appendTo(this.$move);

        this.$moveUp.on('click', event => this._moveUp());
        this.$moveDown.on('click', event => this._moveDown());
        this.selectedLevelIndex = -1;

        let options = [
            { label: 'Continuous',   measureType: 'continuous' },
            { label: 'Ordinal',      measureType: 'ordinal' },
            { label: 'Nominal',      measureType: 'nominal' },
            { label: 'Nominal Text', measureType: 'nominaltext' },
        ];

        this.resources = { };

        let unique = Math.random();

        let optionClicked = (event) => {
            this.model.set({ measureType: event.data, autoMeasure: false });
        };

        for (let option of options) {
            let measureType = option.measureType;
            let $option = $('<div   data-type="' + measureType + '" class="silky-variable-editor-widget-option">').appendTo(this.$types);
            let $input  = $('<input data-type="' + measureType + '" name="' + unique + '" type="radio">').appendTo($option);
            let $icon   = $('<div   data-type="' + measureType + '" class="silky-variable-editor-variable-type"></div>').appendTo($option);
            let $label  = $('<span>' + option.label + '</span>').appendTo($option);

            $option.on('click', null, measureType, optionClicked);

            this.resources[option.measureType] = { $option : $option, $input : $input };
        }

        this.$typesHighlight = $('<div class="silky-variable-editor-widget-types-highlight"></div>').appendTo(this.$types);

        this.model.on('change:measureType', event => {
            this._setType(event.changed.measureType);
            this._setLevels(event.changed.measureType, this.model.get('levels'));
        });
        this.model.on('change:levels',      event => this._setLevels(this.model.get('measureType'), event.changed.levels));
        this.model.on('change:autoMeasure', event => this._setAutoMeasure(event.changed.autoMeasure));
    },
    _moveUp() {
        if (this.attached === false)
            return;
        if (this.model.attributes.measureType === 'continuous')
            return;
        let index = this.selectedLevelIndex;
        if (index < 1)
            return;
        let levels = this.model.get('levels');
        let clone  = levels.slice(0);
        let item   = clone.splice(index, 1)[0];
        clone.splice(index - 1, 0, item);
        this.selectedLevelIndex--;
        this.model.set('levels', clone);
    },
    _moveDown() {
        if (this.attached === false)
            return;
        if (this.model.attributes.measureType === 'continuous')
            return;
        let index = this.selectedLevelIndex;
        let levels = this.model.get('levels');
        if (index === -1 || index >= levels.length - 1)
            return;
        let clone  = levels.slice(0);
        let item   = clone.splice(index, 1)[0];
        clone.splice(index + 1, 0, item);
        this.selectedLevelIndex++;
        this.model.set('levels', clone);
    },
    _enableDisableMoveButtons() {
        if (this.model.attributes.measureType !== 'continuous') {
            let levels = this.model.get('levels');
            let index  = this.selectedLevelIndex;
            this.$moveUp.toggleClass('disabled', index < 1);
            this.$moveDown.toggleClass('disabled', index >= levels.length - 1 || index === -1);
        }
        else {
            this.$moveUp.addClass('disabled');
            this.$moveDown.addClass('disabled');
        }
    },
    _setType(measureType) {
        if (this.attached) {
            for (let t in this.resources) {
                let $option = this.resources[t].$option;

                if (t === measureType) {
                    let $input  = this.resources[measureType].$input;
                    $input.prop('checked', true);
                    $option.addClass('selected');

                    let css = $option.position();
                    css.width = $option.width();
                    css.height = $option.height();

                    this.$typesHighlight.css(css);
                }
                else {
                    $option.removeClass('selected');
                }
            }
            this._enableDisableMoveButtons();
        }
    },
    _setLevels(measureType, levels) {
        if ( ! this.attached)
            return;

        if (levels.length === 0)
            this.$levels.empty();
        else
            this.$levelItems.remove(":gt(" + (levels.length - 1) + ")");

        this.$moveUp.addClass('disabled');
        this.$moveDown.addClass('disabled');

        if (levels) {

            let keydownFunction = ((event) => {
                let $input = $(event.delegateTarget);
                let keypressed = event.keyCode || event.which;
                if (keypressed === 13) { // enter key
                    $input.blur();
                    if (this.model.get('changes'))
                        this.model.apply();
                    event.preventDefault();
                    event.stopPropagation();
                }
                else if (keypressed === 27) { // escape key
                    $input.blur();
                    if (this.model.get('changes'))
                        this.model.revert();
                    event.preventDefault();
                    event.stopPropagation();
                }
            });

            let changeFunction = (event) => {
                let $input = $(event.delegateTarget);
                let index = $input.data('index');
                this.model.editLevelLabel(index, $input.val());
                let level = this.model.get('levels')[index];
                let diff = level.importValue !== level.label;
                let $ivLabel = this.$levels.find(".silky-variable-editor-level[data-index = " + index + "]");
                $ivLabel.attr('data-changed', diff);
            };

            let focusFunction = (event) => {
                this._currentKeyboardContext = keyboardJS.getContext();
                keyboardJS.setContext('');
                let $input = $(event.delegateTarget);
                $input.select();
            };

            let blurFunction = () => {
                keyboardJS.setContext(this._currentKeyboardContext);
            };

            let clickFunction = event => {
                this.$levelItems.removeClass('selected');
                let $level = $(event.delegateTarget);
                $level.addClass('selected');

                let index = this.$levelItems.index($level);
                this.selectedLevelIndex = index;
                this._enableDisableMoveButtons();
            };

            let ivTag = 'Base Value';
            if (measureType === 'nominaltext')
                ivTag = 'Imported Value';

            this.$levelItems.removeClass('selected');
            for (let i = 0; i < levels.length; i++) {
                let level = levels[i];
                let $level = null;
                let $label = null;
                let $value = null;
                if (i >= this.$levelItems.length) {
                    let diff = level.importValue !== level.label;
                    $level = $('<div data-index="' + i + '" data-changed="' + diff + '" class="silky-variable-editor-level"></div>');
                    this.$levels.append($level);

                    $value = $('<div class="jmv-variable-editor-level-value">' + ivTag + ': ' + level.importValue + '</div>').appendTo($level);

                    $label = $('<input class="jmv-variable-editor-level-label" data-index="' + i + '" type="text" value="' + level.label + '" />').appendTo($level);
                    $label.on("change keyup paste", changeFunction);
                    $label.focus(focusFunction);
                    $label.blur(blurFunction);
                    $label.keydown(keydownFunction);

                    $level.on('click', clickFunction);
                    this.$levelItems.push($level);
                }
                else {
                    $level = $(this.$levelItems[i]);
                    $label = $level.find('.jmv-variable-editor-level-label');
                    $label.val(level.label);

                    let diff = level.importValue !== level.label;
                    $level.attr('data-changed', diff);

                    $value = $level.find('.jmv-variable-editor-level-value');
                    $value.text(ivTag + ': ' + level.importValue);
                }
                if (i === this.selectedLevelIndex)
                    $level.addClass('selected');
            }
        }

        this._enableDisableMoveButtons();

        this.$levelItems = this.$levels.find('.silky-variable-editor-level');
    },
    _setAutoMeasure(auto) {
        if ( ! this.attached)
            return;
        if (auto)
            this.$autoType.show();
        else
            this.$autoType.hide();
    },
    detach() {
        this.model.apply();
        this.attached = false;
    },
    attach() {
        this.attached = true;
        this.selectedLevelIndex = -1;
        this._setType(this.model.get('measureType'));
        this._setAutoMeasure(this.model.get('autoMeasure'));
        this._setLevels(this.model.get('measureType'), this.model.get('levels'));
    }
});

module.exports = DataVarWidget;
