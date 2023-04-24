
'use strict';

const $ = require('jquery');
const Backbone = require('backbone');
const DataSettings = require('../datasettings');
const SettingControl = require('./settingcontrol');

const focusLoop = require('../../common/focusloop');

class RibbonListbox extends SettingControl {

    /*
    params
    {
        title:      //Title to be displayed
        name:       //Button Id used in action event  REQUIRED!
        tabName:    //Tab in which the button lives (namespace). Will add if not specified.
        right:      //Is the button docked to the right? [default: false]
        icon:       //svg to have as an icon
        $el:        //jquery element. Will create if not defined.
        class:       //define a type so styling can be customised. It will be added as class attribute.
    }
    */

    constructor(params) {
        super(params.name);

        let title = params.title === undefined ? null : params.title;
        let icon = params.icon === undefined ? null : params.icon;
        let name = params.name;
        let right = params.right === undefined ? false : params.right;
        let margin =  params.margin === undefined ? 'normal' : params.margin;
        let classes =  params.class === undefined ? null : params.class;
        let level = params.level === undefined ? 0 : params.level;
        let shortcutKey = params.shortcutKey === undefined ? null : params.shortcutKey.toUpperCase();

        this.$el = $(`<div></div>`);
        this.$el.addClass('jmv-ribbon-button');
        this.$el.addClass('jmv-ribbon-button-margin-' + margin);
        this.$el.addClass('jmv-ribbon-button-size-medium');

        this.labelId = focusLoop.getNextAriaElementId('label');

        if (shortcutKey) {
            this.shortcutKey = shortcutKey.toUpperCase();
            let stcOptions = { key: this.shortcutKey, action: event => this._clicked(event, false) };
            if (params.shortcutPosition)
                stcOptions.position = params.shortcutPosition;
            focusLoop.applyShortcutOptions(this.$el[0], stcOptions);
        }

        if (classes !== null)
            this.$el.addClass(classes);

        this.tabName = null;
        this._definedTabName = false;
        if (params.tabName !== undefined) {
            this.tabName = params.tabName;
            this._definedTabName = true;
        }

        this.icon = icon;
        this.title = title;
        this.name = name;
        this.dock = right ? 'right' : 'left';
        this.level = level;

        if (icon !== null)
            this.$el.addClass('has-icon');

        this.$el.attr('data-name', this.name.toLowerCase());
        this.focusId = focusLoop.getNextFocusId();
        this.$el.attr('data-focus-id', this.focusId);
        this.$el.attr('disabled');
        if (right)
            this.$el.addClass('right');

        this._refresh();

        this.connect();
    }

    displayValue(value) {
        this.$el.find('select')[0].value = value;
    }

    setEnabled(enabled) {
        let $select = this.$el.find('select');
        if (enabled) {
            this.$el.removeAttr('disabled');
            $select.removeAttr('disabled');
        }
        else {
            this.$el.attr('disabled', '');
            $select.attr('disabled', '');
        }
    }

    setDefinition(def) {
        let options = def.options;
        let html = '';
        for (let option of options)
            html += `<option value="${option.value}">${option.label}</option>`;

        let $select = this.$el.find('select');
        $select.html(html);
        $select[0].value = this.setting.getValue();
    }

    setParent(parent, parentShortcutPath, inMenu) {
        this.parent = parent;

        let shortcutPath = parentShortcutPath;
        if (this.shortcutKey)
            focusLoop.applyShortcutOptions(this.$el[0], { path: parentShortcutPath });

        if (inMenu) {
            this.$el.attr('role', 'menuitem');
            this.inMenu = inMenu;

            focusLoop.createHoverItem(this, () => {
                if (this.menu)
                    this.showMenu(true);
                else
                    this.$el[0].focus({preventScroll:true});
            });
        }
    }

    setTabName(name) {
        if (this._definedTabName === false)
            this.tabName = name;
    }

    getMenus() {
        return [];
    }

    _refresh() {
        let html = '';
        html += '   <div class="jmv-ribbon-button-icon" role="none">' + (this.icon === null ? '' : this.icon) + '</div>';
        html += `<div id="${this.labelId}" class="jmv-ribbon-button-label">${this.title}</div><select aria-labelledby="${this.labelId}"></select>`;

        this.$el.html(html);

        let $select = this.$el.find('select');
        $select.on('change', (event) => {
            this.setValue(parseInt($select[0].value));
        });
    }
};

module.exports = RibbonListbox;
