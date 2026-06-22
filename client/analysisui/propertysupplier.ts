'use strict';

import { EventEmitter, Listener } from 'tsee';
import { CtrlDef } from './optionsview';

export interface IPropertyFilter<T> {
    check: (value: T) => T;
}

interface IProperties<T> {
    trigger: string;
    isDefined?: boolean;
    get: () => T;
    set: (value: T) => void;
    value?: T;
    binding?: string;
    externalTrigger?: any;
}

export type EventHandlers<P> = {
    [K in keyof P as P[K] extends Listener ? `${(K & string)}` : `${(K & string)}_changed`]: (P[K] extends Listener ? P[K] : Listener);
};

class PropertyBag<P extends CtrlDef> {
    public properties: Partial<{ [K in keyof P]: IProperties<P[K]> }> = { };
    private editing = 0;
    private pendingEvents: { [key: string]: boolean } = { };

    reset() {
        for (let key in this.properties)
            delete this.properties[key];
    }

    registerComplexProperty<K extends (keyof P & string)>(name: K, getter: () => P[K], setter: (value: P[K]) => void, externalTrigger: string) {
        if (this.properties[name] !== undefined)
            return;

        this.properties[name] = { get: getter, set: setter, trigger: externalTrigger, externalTrigger: externalTrigger };
    }

    registerSimpleProperty<K extends keyof P>(name: K, initialValue: P[K], filter: IPropertyFilter<P[K]>=null, defined=false) {
        if (this.properties[name] !== undefined && this.properties[name].isDefined)
            return;

        let property: IProperties<P[K]> = {
            trigger: (name.toString() + "_changed"),
            isDefined: defined,
            get: () => {
                return this.properties[name].value;
            },
            set: (value: P[K]) => {
                var v = value;
                if (filter !== null)
                    v = filter.check(value);
                this.properties[name].value = v;
            },
            value: initialValue,
            binding: undefined
        };

        let dataBound = this.isValueDataBound(initialValue);
        if (dataBound) {
            property.binding = initialValue as string;
            property.value = null;
        }

        this.properties[name] = property;
    }

    isValueDataBound(value: any) {
        if (typeof value === 'string') {
            let temp = value.trim();
            return temp.startsWith('(') && temp.endsWith(')');
        }

        return false;
    }

    getPropertyValue<K extends keyof P>(owner: PropertySupplier<P>, property: K): P[K] {
        var propertyObj = this.properties[property];
        if (propertyObj === undefined)
            throw "property '" + property.toString() + "' does not exist";

        var value = propertyObj.get.call(owner);
        if (typeof value === 'function')
            return value.call(owner);
        else
            return value;
    }

    setPropertyValue<K extends (keyof P & string)>(owner: PropertySupplier<P>, property: K, value: P[K]): boolean {
        if (property === "name" || property === "type")
            throw "Cannot change the '" + property.toString() + "' property";

        var propertyObj = this.properties[property];
        if (propertyObj === undefined)
            throw "property '" + property.toString() + "' does not exist";

        var oldValue = propertyObj.get.call(owner);
        if (oldValue !== value) {
            propertyObj.set.call(owner, value);
            if (propertyObj.externalTrigger === undefined)
                this.firePropertyChangedEvent(owner, property);
            return true;
        }

        return false;
    }

    isPropertyDefined<K extends keyof P>(propertyName: K) {
        let property = this.properties[propertyName];
        return property && property.isDefined;
    }

    hasProperty<K extends keyof P>(property: K) {
        return property in this.properties;
    }

    getTrigger<K extends keyof P>(property: K) {
        return this.properties[property].trigger;
    }

    beginEdit() {
        this.editing += 1;
    }

    endEdit(owner: PropertySupplier<P>) {
        if (this.editing === 0)
            return;

        this.editing -= 1;

        if (this.editing === 0) {
            for (let key in this.pendingEvents)
                this.firePropertyChangedEvent(owner, key as keyof P & string);

            this.pendingEvents = { };
        }
    }

    firePropertyChangedEvent<K extends (keyof P & string)>(owner: PropertySupplier<P>, property: K) {
        if (this.editing > 0)
            this.pendingEvents[property] = true;
        else {
            let eventName = this.getTrigger(property) as string;
            let emitter = owner as EventEmitter;
            emitter.emit(eventName);
        }
    }
}

export class PropertySupplier<P extends CtrlDef, E extends { } = EventHandlers<P>> extends EventEmitter<E> {
    public params: Partial<P>;
    private propertyBag: PropertyBag<P>;
    public properties: Partial<{ [K in keyof P]: IProperties<P[K]> }>;

    constructor(properties: Partial<P>) {
        super();

        this.params = properties;
        this.propertyBag = new PropertyBag<P>();
        this.properties = this.propertyBag.properties;

        this.registerProperties(properties);
    }

    protected registerProperties(properties: Partial<P>) {
        this.propertyBag.reset();
        if (properties  !== undefined && properties !== null) {
            if (typeof properties !== 'object' || Array.isArray(properties) === true)
                throw 'Properties can only be an object.';
            else {
                for (let key in properties) {
                    let value = properties[key];
                    this.registerSimpleProperty(key, value, null, true);
                }
            }
        }
    }

    protected registerComplexProperty<K extends (keyof P & string)>(name: K, getter: () => P[K], setter: (value: P[K]) => void, externalTrigger: string) {
        this.propertyBag.registerComplexProperty(name, getter, setter, externalTrigger);
    }

    public registerSimpleProperty<K extends keyof P>(name: K, initialValue: P[K], filter: IPropertyFilter<P[K]>=null, defined=false) {
        this.propertyBag.registerSimpleProperty(name, initialValue, filter, defined);
    }

    protected isValueDataBound(value: any) {
        return this.propertyBag.isValueDataBound(value);
    }

    public getPropertyValue<K extends keyof P>(property: K): P[K] {
        return this.propertyBag.getPropertyValue(this, property);
    }

    public setPropertyValue<K extends (keyof P & string)>(property: K, value: P[K]) {
        if (this.propertyBag.setPropertyValue(this, property, value)) {
            if (this.onPropertyChanged)
                this.onPropertyChanged(property);
        }
    }

    protected onPropertyChanged<K extends keyof P>(property: K) {

    }

    public isPropertyDefined<K extends keyof P>(propertyName: K) {
        return this.propertyBag.isPropertyDefined(propertyName);
    }

    public hasProperty<K extends keyof P>(property: K) {
        return this.propertyBag.hasProperty(property);
    }

    public getTrigger<K extends keyof P>(property: K) {
        return this.propertyBag.getTrigger(property);
    }

    public runInEditScope(fn: () => void) {
        this.beginPropertyEdit();
        try {
            fn();
        } finally {
            this.endPropertyEdit();
        }
    }

    public beginPropertyEdit() {
        this.propertyBag.beginEdit();
    }

    public endPropertyEdit() {
        this.propertyBag.endEdit(this);
    }

    protected firePropertyChangedEvent<K extends (keyof P & string)>(property: K) {
        this.propertyBag.firePropertyChangedEvent(this, property);
    }
}

export default PropertySupplier;
