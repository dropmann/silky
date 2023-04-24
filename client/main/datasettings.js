'use strict';

const EventEmitter = require('events');

class AppSettings extends EventEmitter {
    constructor(data) {
        super();

        //settings are created when recieved from the server or specifically defined by the client. A setting object
        // stores its definition and values
        this._settings = {

        }

        // proxy settings are used by the client for reading and writing to a setting. Proxy settings are weakly stored
        this._proxys = {

        }

        this.valueChangedEvent = this.valueChangedEvent.bind(this);

        this.processData(data);

        /*setTimeout((event) => {
            this.recieveData();
        }, 10000);*/
        
    }

    // jonathon needs to add to
    pushData(data) {
        // push to server

        //example data
       /*let data = {
            'sheets/results/analysis/varLabel': 0
        }*/
        console.log(data);
    }

    // jonathon needs to add to
    recieveData(event) {
        // get data from server
        


        // example data
        let data = {
            action: 'refresh', // update, remove, refresh
            content: { // for refresh all settings need to represented or they will be removed
                'sheet/results/analysis/varLabel': 0,
                'sheet[0]/results/analysis/varLabel': 1,
                'sheet[0]/name': 'worksheet 1',
                'sheet[1]/index': '0',
                'sheet[0]/DataviewMode': 'spreadsheet',
                'sheet[1]/DataviewMode': 'variablelist',
                'sheet[2]/DataviewMode': 'variablelist'
            }
        };

        /*let data = {
            action: 'remove',
            content: [ 
                'sheets/results/analysis/varLabel'
            ]
        };*/

        /*let data = {
            action: 'update',
            content: {
                'sheets/results/analysis/varLabel': 0
            }
        };*/

        switch (data.action) {
            case 'refresh':
                this.refreshData(data.content);
                break;
            case 'update':
                this.processData(data.content);
                break;
            case 'remove':
                this.removeSettings(data.content);
        }
    }

    refreshData(data) {
        this.startPurge();
        this.processData(data);
        this.endPurge();
    }

    startPurge() {
        for (let path in this._settings) {
            let setting = this._settings[path];
            setting._purge = true;
            setting.startPurge();
        }
    }

    endPurge() {
        for (let path in this._settings) {
            let setting = this._settings[path];
            if (setting._purge) {
                if (setting.hasDefinition()) { // if the setting has specifically been defined the setting is retained however the values are cleared.
                    setting._purge = false;
                    setting.clearContexts();
                }
                else
                    this.removeSetting(path);
            }
            else
                setting.endPurge();
        }
    }

    define(path, def) {
        let directPath = stripPath(path);
        let isRootPath = path === directPath;
        if (isRootPath === false)
            throw 'Must be root path';
        
        let rootSetting = this._settings[directPath];
        if (!rootSetting) {
            rootSetting = new Setting(directPath);
            this._settings[directPath] = rootSetting;
            this._settingAdded(rootSetting);
        }

        if (rootSetting.getOptions() !== null)
            throw 'Setting has already been defined.';
        
        rootSetting._purge = false;
        rootSetting.setOptions(def);
    }

    get(path) {
        let proxy = this._proxys[path];
        if (!proxy) {
            proxy = new ProxySetting(path, this);
            this._proxys[path] = proxy;
            proxy.once('dead', (event) => {
                delete this._proxys[event.path];
            });
        }

        return proxy;
    }

    _settingAdded(setting) {
        setting.on('change:value', this.valueChangedEvent);
        this.emit('setting:added', { path: setting.path() });
    }

    _settingRemoved(setting) {
        setting.off('change:value', this.valueChangedEvent);
        this.emit('setting.removed', { path: setting.path() });
        console.log(`setting removed:${setting.path()}`);
    }

    removeSetting(path) {
        let setting = this._settings[path];
        if (setting) {
            delete this._settings[path];
            this._settingRemoved(setting);
        }
    }

    removeSettings(paths) {
        for (let path of paths) {
            let rootSetting = this._settings[path];
            if (!rootSetting) {
                let directPath = stripPath(path);
                rootSetting = this._settings[directPath];
                if (rootSetting)
                    rootSetting.removeContext(path);
            }
            else {
                delete this._settings[path];
                this._settingRemoved(rootSetting);
            }
        }
    }

    valueChangedEvent(event) {
        let data = {};
        data[event.path] = event.value;
        
        this.pushData(data);
    }

    processData(data) {
        for (let path in data) {
            let directPath = stripPath(path);
            let rootSetting = this._settings[directPath];
            if (!rootSetting) {
                rootSetting = new Setting(directPath);
                this._settings[directPath] = rootSetting;
                this._settingAdded(rootSetting);
            }

            rootSetting._purge = false;
            let isRootSetting = path === directPath;

            let options = data[path];
            if (options.defaultValue !== undefined) {
                if (isRootSetting && rootSetting.getOptions() === null)
                    rootSetting.setOptions(options);
                else
                    throw 'Cannot set options to a context or options have already been asigned';
            }
            else
                rootSetting.setContext(data[path], path);
        }
    }

    setContextFocus(zone, context) {
        let proxys = this._focusZones[zone];
        if (!proxys) {
            proxys = [];
            this._focusZones[zone] = proxys;
        }
        
        if (context === null) {
            for (let proxy of proxys)
                proxy.setContextFocus(null);
        }
        else {
            for (let path in this._proxys) {
                let proxy = this._proxys[path];
                if (proxy.setContextFocus(context)) {
                    proxys.push(proxy);
                }
            }
        }
    }
}

class Value extends EventEmitter {
    constructor(path, setting) {
        super();
        this._setting = setting;
        this._path = path;
        this._value = null;
    }

    getValue() {
        if (this._value === null)
            return this._setting.getDefaultValue();

        return this._value;
    }

    path() {
        return this._path;
    }

    setValue(value) {
        let validated = this._setting.valiadate(value);
        if (validated !== this._value) {
            this._value = validated;

            this.emit('change:value', { path: this._path, value: this._value });

            return true;
        }
        return false;
    }

    getOptions() {
        return this._setting.getOptions();
    }
}

class Setting extends EventEmitter {
    constructor(path) {
        super();

        this.onValueChanged = this.onValueChanged.bind(this);

        this._path = path;
        this._options = null;
        this._local = false;
        this._global = false;
        this._defaultValue = null;

        this._contextValues = {};  // if global is ignored
    }

    path() {
        return this._path;
    }

    startPurge() {
        for (let path in this._contextValues) {
            let context = this._contextValues[path];
            context._purge = true;
        }
    }

    endPurge() {
        for (let path in this._contextValues) {
            let context = this._contextValues[path];
            if (context._purge)
                this.removeContext(path);
        }
    }

    setContext(value, path) {  // setContext is like setValue however will create the context if missing.
        if (path === undefined)
            path = this._path;
        
        let context = this._contextValues[path];
        if (!context) {
            context = new Value(path, this);
            this._contextValues[path] = context;
            this._valueAdded(context);
            this.emit('context:added', { path: path });
        }

        context.setValue(value);
        context._purge = false; // do not remove in a purge
        return context;
    }

    getContext(path) {
        if (this._global)
            return this._contextValues[this._path];
        
        return this._contextValues[path];
    }

    _valueAdded(value) {
        value.on('change:value', this.onValueChanged);
    }

    _valueRemoved(value) {
        value.off('change:value', this.onValueChanged);
        console.log(`context removed:${value.path()}`);
    }

    removeContext(path) {
        let context = this._contextValues[path]
        if (context) {
            delete this._contextValues[path];
            this._valueRemoved(context);

            this.emit('context:removed', { path: path });

            return true;
        }
        return false;
    }

    clearContexts() {
        for (let path in this._contextValues) {
            this.removeContext(path);
        }
    }

    onValueChanged(event) {
        this.emit('change:value', event);
    }

    getDefaultValue() {
        return this._defaultValue;
    }

    valiadate(value) {

        // needs doing but not important

        return value;
    }

    getOptions() {
        return this._options;
    }

    setOptions(options) {
        this._options = options;

        if (options.global !== undefined)
            this._global = options.global;

        if (options._local !== undefined)
            this._local = options.local;

        if (options.defaultValue !== undefined)
            this._defaultValue = options.defaultValue;

        if (options.value !== undefined)
            this.setContext(options.value, this._path);
        else if (options.global)
            this.setContext(options.defaultValue, this._path);

        this.emit('change:options', { path: this._path, setting: this, options: options });
    }
}

class ProxySetting extends EventEmitter {
    constructor(path, settings) {
        super();

        this._settings = settings;
        this._path = path;
        this._focusPath = path;
        this._rootPath = stripPath(path);
        this._dead = false; // base setting has been removed

        this._enabled = true;

        this.settingAddedEvent = this.settingAddedEvent.bind(this);
        this.optionsChangedEvent = this.optionsChangedEvent.bind(this);
        this.contextRemovedEvent = this.contextRemovedEvent.bind(this);
        this.contextAddedEvent = this.contextAddedEvent.bind(this);
        this.valueChangedEvent = this.valueChangedEvent.bind(this);

        this._settings.on('setting.removed', (event) => {
            if (this._rootPath === event.path)
                this.disconnectSetting();
        });

        this.connectToSetting(this._settings._settings[this._rootPath]);
    }

    setContextFocus(context) {
        if (context === null) {
            this._focusPath = this._path;
            return true;
        }

        context = this.parseContextPath(context);
        let parts = this.parseContextPath(this._path);
        if (context.length > parts.length - 1)
            return false;
        
        for (let i = 0; i < context.length; i++) {
            let cPart = context[i];
            let pPart = parts[i];
            if (cPart.name != pPart.name)
                return false;
            if (cPart.key === null)
                continue;
            if (pPart.key !== null)
                return false;
            
            pPart.key = cPart.key;
        }
        
        let focusPath = '';
        for (let j = 0; j < parts.length; j++) {
            focusPath += parts[j].name;
            if (parts[j].key !== null)
                focusPath += `[${parts[j].key}]`;
            if (j !== parts.length - 1)
                focusPath += '/';
        }

        if (focusPath !== this._focusPath) {
            this._focusPath = focusPath;
            this.disconnectContext();
        }
        return true;
    }

    disconnectSetting() {
        this._setting.off('change:options', this.optionsChangedEvent);
        this._setting.off('context:removed', this.contextRemovedEvent);
        this._setting = null;
        this.disconnectContext();
        //this.connectToSetting(this._settings._settings[this._rootPath]);
    }

    disconnectContext() {
        if (this._setting)
            this.disconnectSetting();
        else if (this._targetValue) {
            this._targetValue.off('change:value', this.valueChangedEvent);
            this._dead = true;
            this.emit('dead', { path: this._focusPath });
        }
        //if (this._setting)
        //    this._connectToContext(this._setting.getContext(this._focusPath));
    }
    

    connectToSetting(setting) {
        this._setting = setting;
        if (!this._setting)
            this._settings.on('setting:added', this.settingAddedEvent);
        else {
            this._setting.on('change:options', this.optionsChangedEvent);
            this._setting.on('context:removed', this.contextRemovedEvent);

            let targetValue = setting.getContext(this._focusPath);
            this._connectToContext(targetValue);
        }
    }

    settingAddedEvent(event) {
        if (this._rootPath === event.path) {
            this._settings.off('setting:added', this.settingAddedEvent);
            this.connectToSetting(this._settings._settings[this._rootPath]);
        }
    }

    contextAddedEvent(event) {
        if (this._focusPath === event.path) {
            this._settings.off('context:added', this.contextAddedEvent);
            this._connectToContext(this._setting.getContext(this._focusPath));
        }
    }

    contextRemovedEvent(event) {
        if (this.path === event.path)
            this.disconnectContext();
    }

    _connectToContext(context) {
        this._targetValue = context;
        if (!this._targetValue)
            this._setting.on('context:added', this.contextAddedEvent);
        else {
            this._targetValue.on('change:value', this.valueChangedEvent);
            //this.emit('change:value', { path: this._focusPath, value: this._targetValue.getValue() })
        }
    }

    valueChangedEvent(event) {
        this.emit('change:value', event);
    }

    optionsChangedEvent(event) {
        this._setting.off('change:options', this.optionsChangedEvent);
        this.emit('change:options', event);
    }

    getValue() {
        if (this._targetValue)
            return this._targetValue.getValue();
        
        if (this._setting)
            return this._setting.getDefaultValue();
        
        return null;
    }

    setValue(value) {
        if (this._targetValue)
            return this._targetValue.setValue(value);
    }

    isEnabled() {
        return this._enabled;
    }

    isDisabled() {
        return !this._enabled;
    }

    setEnabled(value) {
        if (value !== this._enabled) {
            this._enabled = value;
            this.emit('change:enabled', { path: this._focusPath, value: value });
        }
    }

    path() {
        return this._focusPath;
    }

    getOptions() {
        if (this._setting)
            return this._setting.getOptions();

        return false;
    }

    parseContextPath(contextPath) {
        if (contextPath === null)
            return null;

        let contextItems = context.split('/');
        for (let i = 0; i < contextItems.length; i++) {
            let contextItem = contextItems[i];
            let name = contextItem;
            let key = null;
            if (contextItem[contextItem.length - 1] === ']') {
                let start = contextItem.indexOf('[');
                if (start === 0)
                    throw 'path item cannot have no name';
                else if ((start !== -1)) {
                    name = contextItem.substring(0, start);
                    key = contextItem.substring(start + 1, contextItem.length - 1);
                }

            }
            contextItems[i] = {
                name: name, key: key
            };
        }

        return contextItems;
    }
}

const stripPath = function(path) {
    let pathItems = path.split('/');
    if (pathItems.length === 1)
        return path;
    else {
        for (let i = 0; i < pathItems.length - 1; i++) {
            let pathItem = pathItems[i];
            if (pathItem[pathItem.length - 1] === ']') {
                let start = pathItem.indexOf('[');
                if (start === -1)
                    break;

                if (start === 0) {
                    if (i !== 0)
                        throw 'path item cannot have no name';
                    else if (pathItems.length === 2) {
                        pathItems = [pathItems[1]];
                        break;
                    }
                }

                let name = pathItem.substring(0, start);
                let key = pathItem.substring(start + 1, pathItem.length - 1);
                pathItems[i] = name;
            }
        }
    }

    return pathItems.join('/');
}



const appSettings = new AppSettings({
    'sheet/results/analysis/varLabel': {
        defaultValue: 0,
        value: 1,
        global: true,
        options: [
            { name: 'name', value: 0, label: 'Variable Name' },
            { name: 'desc', value: 1, label: 'Variable Description' }
        ]
    }
});

module.exports = appSettings;
