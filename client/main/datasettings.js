'use strict';

const EventEmitter = require('events');

class DataSetting extends EventEmitter {
    constructor(name, defaultValue, useContext) {
        super();

        this._name = name;
        this._enabled = true;
        this._values = {};
        this._values[this._name] = null; //root value
        this._context = null;
        this._useContext = useContext | false;

        this._defaultValue = defaultValue;
    }

    getValue(ns) {
        if (ns === undefined)
            ns = this.getNamespace(this._context);
        
        let currentValue = this._values[ns];
        
        if (currentValue === undefined || currentValue === null)
            currentValue = this._defaultValue;
        
        return currentValue;
    }

    isEnabled() {
        return this._enabled;
    }

    isDisabled() {
        return ! this._enabled;
    }

    name() {
        return this._name;
    }

    setEnabled(value) {
        if (value !== this._enabled) {
            this._enabled = value;
            this.emit('change:enabled', { name: this._name, value: value });
        }
    }

    getNamespace(context) {
        let ns = this._name;
        if (context !== null)
            ns = `${context}/${this._name}`;
        return ns;
    }

    setValue(value, ns) {
        if (ns === undefined)
            ns = this.getNamespace(this._context);
        
        let currentValue = this.getValue(ns);
        
        if (value !== currentValue) {

            let setValue = value;
            if (setValue === this._defaultValue)
                setValue = null;
            
            this._values[ns] = setValue;
            
            this.emit('change:value', { name: this._name, ns, value });
        }
    }

    setContext(context) {
        if (!this._useContext || this._context === context) {
            this._context = context;
            return;
        }
        
        let currentValue = this.getValue();
        
        this._context = context;

        let ns = this.getNamespace(this._context);
        let value = this.getValue(ns);
        
        if (value !== currentValue)
            this.emit('change:value', { name: this._name, ns, value });
    }

    getValues() {
        return this._values;
    }

    changeContextName(oldContext, newContext) {
        if (this._context === oldContext)
            this._context = newContext;

        let oldNamespace = this.getNamespace(oldContext);
        let value = this._values[oldNamespace];
        if (value !== undefined) {
            let newNamespace = this.getNamespace(newContext);
            this._values[newNamespace] = value;
            delete this._values[oldNamespace];
            return true;
        }

        return false;
    }

    removeContext(context) {
        if (this._context = context)
            this.setContext(null);
        
        let ns = this.getNamespace(context);
        let value = this._values[ns];
        if (value !== undefined) {
            delete this._values[ns];
            return true;
        }

        return false;
    }
}

class DataSettings extends EventEmitter {
    constructor() {
        super();
        
        // Data Settings list and defaults ////
        this._settings = {
            varLabel: new DataSetting('varLabel', 1, true)
        };
        //////

        for (let settingName in this._settings) {
            let setting = this._settings[settingName];
            setting.on('change:value', event => {
                this.pushChange(event);
            });
        }
    }

    getValues() {
        let data = {};
        for (let name in this._settings) {
            let setting = this._settings[name];
            data = { data, ...setting.getValues() };
        }
        return data;
    }

    pushChange(change) {
        let value = change.value;
        let namespace = change.ns;

        let data = {};
        data[namespace] = value;

        // push data to server
    }

    pullSettings() {
        // pull in values from server

        let data = {}; // needs populating... i expect this { varLabel: 1, othersetting: 'john', sheet1/othersetting: 'sam',  ... }

        // but this obviously can be changed to {'' : { varLabel: 1, othersetting: 'john' }, sheet1 : { othersetting: 'sam' }, ...}
        // depending on what is easier on the server
        
        // the data needs checking for cleanup on the server incase a ns has been removed but not removed from the setting list for some reason.
        // The second format makes this much easier but maybe not overall.

        for (let ns in data) {
            let value = data[ns].value;

            let index = ns.lastIndexOf('/');
            let name = ns;
            if (index !== -1)
                name = ns.substring(index + 1);
            
            let setting = this._settings[name];
            if (setting)
                setting.setValue(value, ns);
        }
    }

    get(name) {
        let setting = this._settings[name];
        if (!setting)
            throw 'This setting does not exist.';
        
        return setting;
    }

    setContext(context) {
        for (let name in this._settings) {
            let setting = this._settings[name];
            setting.setContext(context);
        }
    }

    changeContextName(oldName, newName) {
        // ns need to be changed on the server as well.

        for (let name in this._settings) {
            let setting = this._settings[name];
            setting.changeContextName(oldContext, newContext);
        }
    }

    removeContext(name) {
        // ns need to be removed on the server as well.

        for (let name in this._settings) {
            let setting = this._settings[name];
            setting.removeContext(context);
        }
    }
}

module.exports = new DataSettings();
