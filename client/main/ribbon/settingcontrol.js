
'use strict';

const DataSettings = require('../datasettings');

class SettingControl {

    constructor(settingName) {

        this.setting = DataSettings.get(settingName);
    }

    connect() {

        this.setEnabled(this.setting.isEnabled())
        this.setting.on('change:enabled', (event) => {
            this.setEnabled(event.value);
        });

        this.displayValue(this.setting.getValue());
        this.setting.on('change:value', (event) => {
            this.displayValue(event.value);
        });

        let def = this.setting.getOptions();
        if (def)
            this.setDefinition(def);
        else {
            this.setting.once('change:options', (event) => {
                this.setDefinition(event.options);
            });
        }
    }

    setValue(value) {
        this.setting.setValue(value);
    }
};

module.exports = SettingControl;
