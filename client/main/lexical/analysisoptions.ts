export class Option {
    protected _template: any;
    private _templateOverride = { }
    private _isLeaf: boolean;
    protected _initialized: boolean = false;
    protected _value: any;
    protected children = [];

    constructor(template, value, isLeaf) {
        this._template = template;
        this._templateOverride = { };
        this._isLeaf = isLeaf;
        this._initialized = false;
        this.setValue(value);
    }

    setProperty(property, value) {
        if (value === this._template[property])
            delete this._templateOverride[property];
        else
            this._templateOverride[property] = value;
    }

    getProperty(property) {
        let value = this._templateOverride[property];
        if (value === undefined)
            value = this._template[property];

        return value;
    }

    getValue() {
        if (this._isLeaf)
            return this._value;
        else if (this instanceof ParentOption)
            return this._onGetValue();
        else
            throw "Shouldn't get here";
    }

    arraysEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length !== b.length) return false;

        for (let i = 0; i < a.length; ++i) {
            if (this.areEqual(a[i], b[i]) === false)
                return false;
        }
        return true;
    }

    objectsEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;

        const obj1Keys = Object.keys(a).sort();
        const obj2Keys = Object.keys(b).sort();
        if (obj1Keys.length !== obj2Keys.length)
            return false;

        return obj1Keys.every((key, index) => {
            const objValue1 = a[key];
            const objValue2 = b[obj2Keys[index]];
            return this.areEqual(objValue1, objValue2);
        });
    }

    areEqual(a, b) {
        if (globalThis.Array.isArray(a) && a !== null) {
            if (this.arraysEqual(b, a) === false)
                return false;
        }
        if (typeof a === 'object' && a !== null) {
            if (this.objectsEqual(b, a) === false)
                return false;
        }
        else if (b !== a)
            return false;

        return true;
    }

    setValue(value) {
        let changed = false;
        if (this._isLeaf) {
            if (this.areEqual(value, this._value) === false) {
                changed = true;
                this._value = value;
            }
        }
        else {
            if (this._initialized === false) {
                this.children = [];
                if (value === null)
                    return true;

                if (this instanceof ParentOption)
                    this._createChildren(value);
                changed = true;
            }
            else if (value === null) {
                if (this.children.length > 0) {
                    this.children = [];
                    changed = true;
                }
            }
            else {
                if (this instanceof ParentOption)
                    changed = this._updateChildren(value) || changed;
            }
        }

        if (value !== null)
            this._initialized = true;
        
        return changed;
    }

    getAssignedColumns() {
        if (this._isLeaf)
            return this._onGetAssignedColumns();
        else {
            let r = [];
            for (let i = 0; i < this.children.length; i++) {
                let child = this.children[i];
                r = r.concat(child.getAssignedColumns());
            }
            r = [...new Set(r)];
            return r;
        }
    }

    getAssignedOutputs() {
        if (this._isLeaf)
            return this._onGetAssignedOutputs();
        else {
            let r = [];
            for (let i = 0; i < this.children.length; i++) {
                let child = this.children[i];
                r = r.concat(child.getAssignedOutputs());
            }
            r = [...new Set(r)];
            return r;
        }
    }

    renameColumn(oldName, newName) {
        if (this._isLeaf)
            this._onRenameColumn(oldName, newName);
        else {
            for (let i = 0; i < this.children.length; i++)
                this.children[i].renameColumn(oldName, newName);
        }
    }

    renameLevel(variable, oldLabel, newLabel, getOption) {
        if (this._isLeaf)
            this._onRenameLevel(variable, oldLabel, newLabel, getOption);
        else {
            for (let i = 0; i < this.children.length; i++)
                this.children[i].renameLevel(variable, oldLabel, newLabel, getOption);
        }
    }

    clearColumnUse(columnName) {
        if (this._isLeaf)
            this._onClearColumnUse(columnName);
        else {
            for (let i = 0; i < this.children.length; i++)
                this.children[i].clearColumnUse(columnName);
        }
    }

    _onGetAssignedColumns() {
        return [];
    }

    _onGetAssignedOutputs() {
        return [];
    }

    _onClearColumnUse(columnName) {  }

    _onRenameColumn(oldName, newName) {  }

    _onRenameLevel(variable, oldLevel, newLevel, getOption) {  }
}

export class Integer extends Option {
    constructor(template, value = 0) {
        super(template, value, true);
    }
}

export class Decimal extends Option {
    constructor(template, value = 0) {
        super(template, value, true);
    }
}

export class Level extends Option {
    constructor(template, value = null) {
        super(template, value, true);
    }

    _onRenameLevel(variable, oldLabel, newLabel, getOption) {
        let linkedVariable = this.getProperty('variable');
        if (linkedVariable) {
            if (linkedVariable.startsWith('(') && linkedVariable.endsWith(')')) {
                let binding = linkedVariable.slice(1, -1);
                linkedVariable = getOption(binding).getValue();
            }
            if (linkedVariable === variable && this._value === oldLabel)
                this._value = newLabel;
        }
    }
}

export class Variable extends Option {
    constructor(template, value = null) {
        super(template, value, true);
    }

    _onClearColumnUse(columnName) {
        if (this._value === columnName)
            this._value = null;
    }

    _onGetAssignedColumns() {
        if (this._value !== null)
            return [ this._value ];
        else
            return [];
    }

    _onRenameColumn(oldName, newName) {
        if (this._value === oldName)
            this._value = newName;
    }
}

export class Variables extends Option {
    constructor(template, value = null) {
        super(template, value, true);
    }

    _onGetAssignedColumns() {
        let r = [];
        if (this._value !== null)
            r = this._value;

        r = [...new Set(r)];
        return r;
    }

    _onClearColumnUse(columnName) {
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                if (this._value[i] === columnName) {
                    this._value.splice(i, 1);
                    i -= 1;
                }
            }
        }
    }

    _onRenameColumn(oldName, newName) {
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                if (this._value[i] === oldName)
                    this._value[i] = newName;
            }
        }
    }
}

export class Output extends Variable {
    constructor(template, value = null) {
        super(template, value);
    }

    _onGetAssignedOutputs() {
        if (this._value !== null)
            return [ this._value ];
        else
            return [];
    }
}

export class Outputs extends Variables {
    constructor(template, value = null) {
        super(template, value);
    }

    _onGetAssignedOutputs() {
        let r = [];
        if (this._value !== null)
            r = this._value;

        r = [...new Set(r)];
        return r;
    }
}

export class Terms extends Option {
    constructor(template, value = null) {
        super(template, value, true);
    }

    _onGetAssignedColumns() {
        let t = [];
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                if (this._value[i] !== null && this._value[i].length > 0)
                    t = [...new Set(t.concat(this._value[i]))];
            }
        }
        return t;
    }

    _onClearColumnUse(columnName) {
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                for (let j = 0; j < this._value[i].length; j++) {
                    if (this._value[i][j] === columnName) {
                        this._value.splice(i, 1);
                        i -= 1;
                        break;
                    }
                }
            }
        }
    }

    _onRenameColumn(oldName, newName) {
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                for (let j = 0; j < this._value[i].length; j++) {
                    if (this._value[i][j] === oldName)
                        this._value[i][j] = newName;
                }
            }
        }
    }

}

export class Term extends Option {
    constructor(template, value = null) {
        super(template, value, true)
    }

    _onGetAssignedColumns() {
        let r = [];
        if (this._value !== null)
            r = this._value;

        r = [...new Set(r)];
        return r;
    }

    _onClearColumnUse(columnName)  {
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                if (this._value[i] === columnName) {
                    this._value = null;
                    return;
                }
            }
        }
    }

    _onRenameColumn(oldName, newName) {
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                if (this._value[i] === oldName)
                    this._value[i] = newName;
            }
        }
    }
}

export class Pairs extends Option {
    constructor(template, value) {
        super(template, value, true);
    }

    _onGetAssignedColumns() {
        let r = [];
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                if (this._value[i] !== null) {
                    r.push(this._value[i].i1);
                    r.push(this._value[i].i2);
                }
            }
        }

        r = [...new Set(r)];
        return r;
    }

    _onClearColumnUse(columnName) {
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                if (this._value[i] !== null) {
                    if (this._value[i].i1 === columnName)
                        this._value[i].i1 = null;
                    if (this._value[i].i2 === columnName)
                        this._value[i].i2 = null;
                    if (this._value[i].i1 === null && this._value[i].i2 === null) {
                        this._value.splice(i, 1);
                        i -= 1;
                    }
                }
            }
        }
    }

    _onRenameColumn(oldName, newName) {
        if (this._value !== null) {
            for (let i = 0; i < this._value.length; i++) {
                if (this._value[i] !== null) {
                    if (this._value[i].i1 === oldName)
                        this._value[i].i1 = newName;
                    if (this._value[i].i2 === oldName)
                        this._value[i].i2 = newName;
                }
            }
        }
    }
}

abstract class ParentOption extends Option {
    constructor(template, value) {
        super(template, value, false);

        if (value !== null)
            this._createChildren(value);
    }

    abstract _createChildren(value);

    abstract _updateChildren(value);

    abstract getChild(index);

    abstract _onGetValue();    
}

export class Group extends ParentOption {
    private _indexedChildren = { }

    constructor(template, value) {
        super(template, value);

        if (value !== null)
            this._createChildren(value);
    }

    _onGetValue() {
        if (this._initialized === false)
            return null;

        var r = { };
        for (let i = 0; i < this._template.elements.length; i++) {
            let element = this._template.elements[i];
            if (this.children.length > i)
                r[element.name] = this.children[i].getValue();
        }
        return r;
    }

    _createChildren(value) {
        this._indexedChildren = { };
        for (let i = 0; i < this._template.elements.length; i++) {
            let element = this._template.elements[i];
            let child = OptionTypes.create(element, value[element.name]);
            this.children.push(child);
            this._indexedChildren[element.name] = child;
        }
    }

    _updateChildren(value) {
        let changed = false;
        this.children = [];
        let newIndexedChildren = {};
        for (let i = 0; i < this._template.elements.length; i++) {
            let element = this._template.elements[i];
            let child = this._indexedChildren[element.name];
            if (child) {
                changed = child.setValue(value[element.name]) || changed;
                delete this._indexedChildren[element.name];
            }
            else {
                child = OptionTypes.create(element, value[element.name]);
                changed = true;
            }

            this.children.push(child);
            newIndexedChildren[element.name] = child;
        }
        this._indexedChildren = newIndexedChildren;
        return changed;
    }

    getChild(name) {
        return this._indexedChildren[name];
    }
}

export class Pair extends Group {
    constructor(template, value) {
        super({ type: 'Group', elements: [{ type: 'Variable', name: 'i1' }, { type: 'Variable', name: 'i2' }] }, value);
    }
}

export class Array extends ParentOption {
    constructor(template, value) {
        super(template, value);

        if (value !== null)
            this._createChildren(value);
    }

    _onGetValue() {
        if (this._initialized === false)
            return null;

        var r = [];
        for (let i = 0; i < this.children.length; i++)
            r.push(this.children[i].getValue());
        return r;
    }

    _createChildren(value) {
        for (let i = 0; i < value.length; i++)
            this.children.push(OptionTypes.create(this._template.template, value[i]));
    }

    _updateChildren(value) {
        let changed = false;
        for (let i = 0; i < value.length; i++) {
            if (i < this.children.length)
                changed = this.children[i].setValue(value[i]) || changed;
            else {
                this.children.push(OptionTypes.create(this._template.template, value[i]));
                changed = true;
            }
        }

        if (value.length < this.children.length) {
            this.children.splice(value.length - this.children.length);
            changed = true;
        }

        return changed;
    }

    getChild(index) {
        return this.children[index];
    }
}

const OptionTypes = { 
    create: function(template, value) {
        let type = template.type;
        if (type === 'number') // because a class can't be called 'number'
            type = 'Decimal';
        return new OptionTypes[type](template, value);
    },
    Option,
    Integer,
    Level,
    Variable,
    Variables,
    Output,
    Outputs,
    Term,
    Terms,
    Pair,
    Pairs,
    Group,
    Array
}

export default OptionTypes;
