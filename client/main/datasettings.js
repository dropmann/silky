'use strict';

const EventEmitter = require('events');

class ContextSetting extends Setting {
    constructor(setting, parent) {
        super(this._baseSetting.name(), parent);
        this._baseSetting = setting;

        let options = setting.getOptions();
        if (options !== null)
            this.setOptions(options);
        else {
            setting.once('change:options', (event) => {
                this.setOptions(setting.getOptions());
            });
        }
    }
}

class Setting extends EventEmitter {
    constructor(name, parent) {
        super();

        this._name = name;
        this._enabled = false;
        this._value = null;
        this._options = null;
        this._local = false;
        this._global = false;
        this._defaultValue = null;
        this._parent = parent;
    }

    setOptions(options) {

        let value = options.value;
        if (value !== undefined && Object.keys(options).length === 1) {
            this.setValue(options.value);
            return;
        }

        let currentValue = this.getValue(); //if the underlying value could change because of the definition change, store the current value

        this._options = options;

        if (options.global !== undefined)
            this._global = options.global;
        
        if (options._local !== undefined)
            this._local = options.local;
        
        if (options.defaultValue !== undefined)
            this._defaultValue = options.defaultValue;
        
        this.emit('change:options', { name: this._name, path: this.path(), options: options });

        if (options.value !== undefined)
            this.setValue(options.value);
        else  // force value change because default value has changed
        {
            value = this.getValue();
            if (currentValue !== value)
                this.emit('change:value', { name: this._name, path: this.path(), value: value, contextChanged: false });
        }
    }

    getOptions() {
        return this._options;
    }

    getValue() {
        if (this._value === null)
            return this._defaultValue;
        
        return this._value;
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

    path() {
        return this._parent.path() + this._name;
    }

    setEnabled(value) {       
        if (value !== this._enabled) {
            this._enabled = value;
            this.emit('change:enabled', { name: this._name, value: value });
        }
    }

    setValue(value) {  
        if (value !== this._value) {        
            
            let value = this._valiadateValue(value);

            this._value = value;
            
            this.emit('change:value', { name: this._name, path: this.path(), value });
        }
    }

    validateValue(value) {

        // validation still needs doing

        return value;
    }
/*
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

    parseSettingSpace(settingSpacePath) {
        return settingSpacePath.split('/');
    }

    contextToPath(context) {
        let contextPath = '';
        for (let item of context) {
            if (item.context === null)
                contextPath += `${item.name}/`;
            else
                contextPath += `${item.name}[${item.key}]/`;
        }
        return contextPath; //contextPath always ends with a forward slash
    }

    settingSpaceToPath(settingSpace) {
        return settingSpace.join('/'); //settingSpace path doesn't end with a forward slash
    }

    settingSpaceToContext(settingSpace) {
        let context = [];
        for (let name of settingSpace) {
            context.push({ name: name, key: null });
        }
        return context;
    }

    isSettingSpaceCompatible(settingSpacePath) {
        return this._settingSpacePath.startsWith(settingSpacePath);
    }
*/
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

    return pathItems;
}

class SettingProxy extends EventEmitter {
    constructor(path, space) {
        this._path = path;
        this._pathItems = this.parseContextPath(path);
        this._space = space;

        this._space.on('change:value', (event) => {
            if (this.isCompatiblePath(event.path, event.global))
                this.emit('change:value', event);
        });

        this._space.on('change:enabled', (event) => {
            if (this.isCompatiblePath(event.path, event.global))
                this.emit('change:enabled', event);
        });

        this._space.on('change:options', (event) => {
            if (this.isCompatiblePath(event.path, event.global))
                this.emit('change:options', event);
        });
    }

    isCompatiblePath(path, isGlobal) {
        let match = true;
        let pathItems = this.parseContextPath(path);
        if (pathItems.length !== this._pathItems.length)
            match = false;
        else {
            for (let i = 0; i < pathItems.length; i++) {
                let sourceItem = pathItems[i];
                let listenerItem = this._pathItems[i];
                if (sourceItem.name !== listenerItem.name)
                    match = false;
                else if (isGlobal === false && listenerItem.key !== null && listenerItem.key !== sourceItem.key)
                    match = false;

                if (match === false)
                    break;
            }
        }

        return match;
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

    setValue(value) {
        this._space.setValue(value, this._path);
    }

    value() {

    }

    isEnabled() {

    }

    getOptions() {

    }
}

class ContextSpace extends EventEmitter {
    constructor(key, parent) {
        this._key = key;

        this._parent = parent;
    }
}

class SettingSpace extends EventEmitter {
    constructor(name, parentSpace) {

        super();

        this._name = name;
        this._key = null;

        if (name[name.length - 1] === ']') {
            let start = name.indexOf('[');
            if (start > 0) {
                this._name = name.substring(0, start);
                this._key = name.substring(start + 1, name.length - 1);
            }
        }

        this._parentSpace = parentSpace;

        this._settings = {};
        this._spaces = {};

        this._contexts = {};
        this._proxy = {};

        this._path = this.path();
    }

    isContextSpace() {
        return this._key !== null;
    }

    name() {
        return this._name;
    }

    key() {
        return this._key;
    }

    path() {
        let ns = this._name;
        if (this._parentSpace != null) {
            let path = this._parentSpace.path();
            if (path !== null) {
                if (this._parentSpace.name() === this._name && this._parentSpace.key() === null && this._key !== null)
                    ns = `${path}[${this._key}]`;
                else
                    ns = `${path}${this._name}`;
            }
        }
        
        return ns + '/';
    }

    createSetting(name, options) {
        if (this.isContextSpace())
            throw 'Settings can only be created in a root settings space.';

        let setting = new Setting(name, this);

        this._settings[name] = setting;

        setting.on('change:value', (event) => {
            this.emit('change:value', event);
            this.onValueChanged(setting, event);
        });
        setting.on('change:enabled', (event) => {
            this.emit('change:enabled', event);
        });

        if (options)
            setting.setOptions(options);
        else {
            setting.once('change:options', (event) => {
                this.emit('change:options', event);
            });
        }

        for (let contextName in this._contexts) {
            let context = this._contexts[contextName];
            context.createSetting(name, options);
        }

        return setting;
    }

    createSettingSpace(name) {
        if (this.isContextSpace())
            throw 'A new settings space can only be created in a root settings space.';
        
        let settingSpace = new SettingSpace(name, this);
        this._spaces[name] = settingSpace;

        settingSpace.on('change:value', this.echoValueChange);
        settingSpace.on('change:enabled', this.echoEnabledChange);
        settingSpace.once('change:options', this.echoOptionsChange);

        return settingSpace;
    }

    cloneTo(space) {
        for (let settingName in this._settings) {
            let templateSetting = this._settings[settingName];
            let contextSetting = space.createSetting(settingName);
            let options = templateSetting.getOptions();
            if (options !== null)
                contextSetting.setOptions(options);
            else {
                templateSetting.once('change:options', (event) => {
                    contextSetting.setOptions(templateSetting.getOptions());
                });
            }
        }

        for (let spaceName in this._spaces) {
            let templateSpace = this._spaces[spaceName];
            let space = context.createSettingSpace(spaceName);
            templateSpace.cloneTo(space);
        }
    }

    addItem(key) {
        if (this.isContextSpace())
            throw 'A new item can only be created in a root settings space.';

        let context = new SettingSpace(`${this._name}[${key}]`, this);
        this._contexts[key] = context;

        context.on('change:value', this.echoValueChange);
        context.on('change:enabled', this.echoEnabledChange);
        context.once('change:options', this.echoOptionsChange);

        this.cloneTo(context);

        return context;
    }

    removeItem(key) {
        if (this.isContextSpace())
            throw 'An item can only be removed in a root settings space.';

        let context = this._contexts[key];

        context.off('change:value', this.echoValueChange);
        context.off('change:enabled', this.echoEnabledChange);
        context.off('change:options', this.echoOptionsChange);
    }

    echoValueChange(event) {
        this.emit('change:value', event);
    }

    echoEnabledChange(event) {
        this.emit('change:enabled', event);
    }

    echoOptionsChange(event) {
        this.emit('change:options', event);
    }

    get(path) {
        let pathItems = stripPath(path);
        if (path.endsWith('/')) { // settingSpace Path
            let settingSpace = this._spaces[pathItems[0]];
            if (!settingSpace)
                throw 'No setting space with this name.';
            
            return settingSpace;
        }
        
        let proxy = this._proxys[path];
        if (!proxy) {
            proxy = new SettingProxy(path, this);
            this._proxys[path] = proxy;
        }
        return proxy;
    }

    setValue(value, path) {
        let pathItems = path.split('/');
        if (pathItems.length === 1) {
            let setting = this._settings[pathItems[0]];
            if (setting) {
                setting.setValue(value);
                return true;
            }
            return false;
        }
            
        let space = this._spaces[pathItems[0]];
        if (!space)
            space = this._contexts[pathItems[0]];
        
        if (space) {
            pathItems.shift();
            return space.setValue(value, pathItems.join('/'));
        }

        return false;
    }

    processData(data) {
        for (let path in data) {
            let directPath = stripPath(path);
            let setting = this.getSetting(directPath);
            let isRootSetting = path === directPath;

            let options = data[path];

            if (isRootSetting && setting.getOptions() === null)
                setting.setOptions(options);
            else if (options.value !== undefined)
                setting.setValue(path, options.value);
            else
                throw 'Inapropriate data. Setting was already defined or did not contain a value';
        }
    }

    onValueChanged(setting, event) {

    }
}

class AppSettings extends SettingSpace {
    constructor() {

        super(null, null);

        this.initaliseSettings(); // Asks the server for its settings

        // test code
        setTimeout(event => {
            let data = {
                'sheets[0]/results/analysis/varLabel': { value: 0 },
                'sheets[0]/name': { value: `Damo's worksheet ` },
                'sheets[2]/DataviewMode': { value: 'spreadsheet' },
            };

            this.processData(data);
        }, 10000);
    }

    setFocus(path) {
        this._context = context;
        let path = this.path();
        if (context)
            path = `${path.substring(0, path.length - 1)}[${context}]/`;

        this.emit('change:context', { path });
    }


    onValueChanged(setting, event) {
        if (setting.local === false && event.contextChanged === false)
            this.pushChange(event);
    }

    pushChange(change) {
        let value = change.value;
        let path = change.path;

        let data = {};
        data[path] = value;

        console.log(change);

        // push data to server
    }

    initaliseSettings() {

        // example data
        let data = {
            'sheets/results/analysis/varLabel': {
                value: 1,
                defaultValue: 0,
                global: true,
                options: [
                    { name: 'name', value: 0, label: 'Variable Name' },
                    { name: 'desc', value: 1, label: 'Variable Description' }
                ]
            },
            'sheets[0]/name': { value: 'worksheet 1' },
            'sheets[1]/index': { value: '0' },
            'sheets[0]/DataviewMode': { value: 'spreadsheet' }, //server provides the saved value, erver doesn't care about this settings but client might want them saved in the file
            'sheets[1]/DataviewMode': { value: 'variablelist' },
            'sheets[2]/DataviewMode': { value: 'variablelist' },
        };

        this.processData(data);
    }
}

const appSettings = new AppSettings(settings);

module.exports = appSettings;
