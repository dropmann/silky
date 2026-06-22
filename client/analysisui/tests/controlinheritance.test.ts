import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';

import ControlBase, { ControlBaseProperties, Margin } from '../controlbase';
import I18nSupport from '../i18nsupport';
import PropertySupplier from '../propertysupplier';

vi.mock('jquery', () => ({
    default: (element) => ({ 0: element, length: element ? 1 : 0 }),
}));

vi.mock('../../common/interactionmanager', () => ({
    default: {
        nextAriaId: vi.fn((prefix: string) => `${prefix}-test-id`),
    },
}));

class TestPropertySupplier extends PropertySupplier<any> {
    changed: string[] = [];

    protected override registerProperties(properties) {
        super.registerProperties(properties);

        this.registerSimpleProperty('label', 'default');
        this.registerSimpleProperty('count', 0);
        this.registerSimpleProperty('computed', function() {
            return `computed:${this.getPropertyValue('label')}`;
        });
    }

    protected override onPropertyChanged(property) {
        this.changed.push(property.toString());
    }
}

class TestI18nSupport extends I18nSupport<any> {
    changed = 0;

    onI18nChanged() {
        this.changed += 1;
    }
}

class TestControlBase extends ControlBase<ControlBaseProperties & { label?: string; _templateInfo?: any }> {
    children: TestControlBase[] = [];

    constructor(params: Partial<ControlBaseProperties & { label?: string; _templateInfo?: any }> = {}, parent = null) {
        super(params as ControlBaseProperties & { label?: string; _templateInfo?: any }, parent);
    }

    protected override registerProperties(properties) {
        super.registerProperties(properties);

        this.registerSimpleProperty('label' as any, 'label' as any);
    }

    override getControls() {
        return this.children;
    }
}

class FakeClassList {
    private values = new Set<string>();

    add(...values: string[]): void {
        for (const value of values)
            this.values.add(value);
    }

    remove(...values: string[]): void {
        for (const value of values)
            this.values.delete(value);
    }

    contains(value: string): boolean {
        return this.values.has(value);
    }
}

class FakeHTMLElement {
    style: Record<string, any> = {};
    classList = new FakeClassList();
    attributes = new Map<string, string>();
    children: FakeHTMLElement[] = [];
    parentElement: FakeHTMLElement = null;
    listeners = new Map<string, Function[]>();
    scrollLeft = 0;
    scrollTop = 0;
    scrollHeight = 10;
    offsetTop = 0;
    offsetLeft = 0;
    offsetWidth = 10;
    offsetHeight = 10;
    innerHTML = '';

    append(child: FakeHTMLElement): FakeHTMLElement {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    remove(): void {
        if (!this.parentElement)
            return;

        this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        this.parentElement = null;
    }

    contains(element: FakeHTMLElement | null): boolean {
        if (!element)
            return false;
        if (element === this)
            return true;
        return this.children.some(child => child.contains(element));
    }

    setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
    }

    getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null;
    }

    hasAttribute(name: string): boolean {
        return this.attributes.has(name);
    }

    addEventListener(name: string, listener: Function): void {
        const listeners = this.listeners.get(name) ?? [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
    }

    removeEventListener(name: string, listener: Function): void {
        this.listeners.set(name, (this.listeners.get(name) ?? []).filter(value => value !== listener));
    }

    dispatchEvent(event: Event): boolean {
        for (const listener of this.listeners.get(event.type) ?? [])
            listener(event);
        return true;
    }

    querySelectorAll(): FakeHTMLElement[] {
        return [];
    }
}

function installFakeDom() {
    globalThis.HTMLElement = FakeHTMLElement as unknown as typeof HTMLElement;
    globalThis.Element = FakeHTMLElement as unknown as typeof Element;
    globalThis.customElements = {
        define: vi.fn(),
        get: vi.fn(),
    } as unknown as CustomElementRegistry;

    if (!globalThis.CustomEvent) {
        globalThis.CustomEvent = class TestCustomEvent<T = any> extends Event {
            detail: T;

            constructor(type: string, init?: CustomEventInit<T>) {
                super(type, init);
                this.detail = init?.detail;
            }
        } as typeof CustomEvent;
    }

    globalThis.getComputedStyle = vi.fn(() => ({
        marginLeft: '0',
        marginRight: '0',
        marginTop: '0',
        marginBottom: '0',
        visibility: 'visible',
    })) as unknown as typeof getComputedStyle;
}

function createFakeOption(initialValue: any, properties: Record<string, any> = {}) {
    const source = new EventEmitter();
    let value = initialValue;
    let editDepth = 0;

    return {
        source,
        setProperty: vi.fn(),
        getProperties: vi.fn(() => properties),
        runInEditScope: vi.fn((fn: () => void) => {
            editDepth += 1;
            try {
                fn();
            }
            finally {
                editDepth -= 1;
            }
        }),
        getValue: vi.fn((key = []) => {
            let current = value;
            for (const item of key ?? [])
                current = current?.[item];
            return current;
        }),
        setValue: vi.fn((nextValue, key = []) => {
            value = nextValue;
            source.emit('valuechanged', key, null);
            return true;
        }),
        insertValueAt: vi.fn(),
        removeAt: vi.fn(),
        get editDepth() {
            return editDepth;
        },
    };
}

describe('PropertySupplier contract', () => {
    it('keeps generated params when subclasses register defaults', () => {
        const supplier = new TestPropertySupplier({ label: 'generated' });

        expect(supplier.getPropertyValue('label')).toBe('generated');
        expect(supplier.isPropertyDefined('label')).toBe(true);
        expect(supplier.getPropertyValue('count')).toBe(0);
    });

    it('stores parenthesized strings as data bindings', () => {
        const supplier = new TestPropertySupplier({ label: '(enabled)' });

        expect(supplier.getPropertyValue('label')).toBeNull();
        expect(supplier.properties.label.binding).toBe('(enabled)');
    });

    it('coalesces property events while in an edit scope', () => {
        const supplier = new TestPropertySupplier({ count: 0 });
        const listener = vi.fn();
        supplier.on('count_changed', listener);

        supplier.runInEditScope(() => {
            supplier.setPropertyValue('count', 1);
            supplier.setPropertyValue('count', 2);
        });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(supplier.changed).toEqual(['count', 'count']);
    });

    it('keeps name and type immutable through setPropertyValue', () => {
        const supplier = new TestPropertySupplier({ name: 'original', type: 'kind' });

        expect(() => supplier.setPropertyValue('name', 'next')).toThrow("Cannot change the 'name' property");
        expect(() => supplier.setPropertyValue('type', 'next')).toThrow("Cannot change the 'type' property");
    });

    it('evaluates function-valued property values with the supplier as this', () => {
        const supplier = new TestPropertySupplier({ label: 'abc' });

        expect(supplier.getPropertyValue('computed')).toBe('computed:abc');
    });
});

describe('I18nSupport contract', () => {
    it('falls back to original keys before an i18n source is set', () => {
        const support = new TestI18nSupport({});

        expect(support.translate('Hello')).toBe('Hello');
        expect(support.translateN('item', 'items', 2)).toBe('item');
    });

    it('delegates translate and translateN calls to the active source', () => {
        const support = new TestI18nSupport({});
        const formats = { name: 'A' };
        const options = { prefix: '[', postfix: ']' };
        const pluralFormats = { n: 3 };
        const source = {
            translate: vi.fn((key, receivedFormats, receivedOptions) => `${receivedOptions.prefix}${key}:${receivedFormats.name}${receivedOptions.postfix}`),
            translateN: vi.fn((key, plural, count, receivedFormats) => `${plural}:${count}:${receivedFormats.n}`),
        };

        support.setI18nSource(source);

        expect(support.translate('Hello', formats, options)).toBe('[Hello:A]');
        expect(support.translateN('item', 'items', 3, pluralFormats)).toBe('items:3:3');
        expect(source.translate).toHaveBeenCalledWith('Hello', formats, options);
        expect(source.translateN).toHaveBeenCalledWith('item', 'items', 3, pluralFormats);
    });

    it('calls onI18nChanged when the source changes', () => {
        const support = new TestI18nSupport({});

        support.setI18nSource({
            translate: key => key,
            translateN: key => key,
        });
        support.setI18nSource({
            translate: key => `next:${key}`,
            translateN: key => `next:${key}`,
        });

        expect(support.changed).toBe(2);
        expect(support.translate('value')).toBe('next:value');
    });
});

describe('ControlBase contract', () => {
    it('disposes once and then disposes child controls', () => {
        const parent = new TestControlBase();
        const child = new TestControlBase({}, parent);
        const order: string[] = [];
        parent.children.push(child);
        parent.on('disposing', () => order.push('parent'));
        child.on('disposing', () => order.push('child'));

        parent.dispose();
        parent.dispose();

        expect(parent.isDisposed).toBe(true);
        expect(child.isDisposed).toBe(true);
        expect(order).toEqual(['parent', 'child']);
    });

    it('uses local template info before asking the parent', () => {
        const parentTemplate = { templateName: 'parent' };
        const localTemplate = { templateName: 'local' };
        const parent = new TestControlBase({ _templateInfo: parentTemplate } as any);
        const child = new TestControlBase({ _templateInfo: localTemplate } as any, parent);
        const inherited = new TestControlBase({}, parent);

        expect(child.getTemplateInfo()).toBe(localTemplate);
        expect(inherited.getTemplateInfo()).toBe(parentTemplate);
    });

    it('translates only string-like properties', () => {
        const ctrl = new TestControlBase({ label: 'Hello' } as any);
        ctrl.setI18nSource({
            translate: value => `translated:${value}`,
            translateN: value => value,
        });

        expect(ctrl.getTranslatedProperty('label' as any)).toBe('translated:Hello');
        expect(ctrl.getTranslatedProperty('margin' as any)).toBe('translated:normal');
        expect(() => ctrl.getTranslatedProperty('stage' as any)).toThrow('Not a valid property to translate');
    });
});

describe('GridControl contract', () => {
    it('renders root-element controls as one grid cell', async () => {
        installFakeDom();
        const { default: GridControl } = await import('../gridcontrol');
        const { default: LayoutGrid } = await import('../layoutgrid');

        class SingleCellControl extends GridControl<any> {
            constructor() {
                super({}, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const grid = new LayoutGrid();
        const ctrl = new SingleCellControl();

        const result = ctrl.renderToGrid(grid, 0, 0, null);

        expect(result).toMatchObject({ height: 1, width: 1 });
        expect(result.cell.content).toBe(ctrl.el);
        expect(grid._cells).toHaveLength(1);
        expect(ctrl.$el.length).toBe(1);
    });

    it('wraps multi-cell renderers when useSingleCell is true', async () => {
        installFakeDom();
        const { default: GridControl } = await import('../gridcontrol');
        const { default: LayoutGrid } = await import('../layoutgrid');

        class MultiCellControl extends GridControl<any> {
            merged = false;

            constructor() {
                super({ useSingleCell: true }, null);
            }

            override componentItemsMerged() {
                this.merged = true;
            }

            override onRenderToGrid(grid) {
                grid.addCell(0, 0, new HTMLElement());
                return { height: 1, width: 1 };
            }
        }

        const outerGrid = new LayoutGrid();
        const ctrl = new MultiCellControl();

        const result = ctrl.renderToGrid(outerGrid, 0, 0, null);

        expect(result).toMatchObject({ height: 1, width: 1 });
        expect(ctrl.merged).toBe(true);
        expect(ctrl.el).toBeInstanceOf(LayoutGrid);
        expect(outerGrid._cells).toHaveLength(1);
    });
});

describe('OptionControlBase contract', () => {
    it('replaces option subscriptions when a new option is assigned', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({}, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const firstOption = createFakeOption('first');
        const secondOption = createFakeOption('second');
        const ctrl = new TestOptionControl();
        const listener = vi.fn();
        ctrl.on('optionValueChanged', listener);

        ctrl.setOption(firstOption as any);
        listener.mockClear();
        ctrl.setOption(secondOption as any);
        listener.mockClear();

        firstOption.source.emit('valuechanged', [], null);
        secondOption.source.emit('valuechanged', [], null);

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('filters option value events by valueKey and disconnects on dispose', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({ valueKey: ['rows', 1] }, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const option = createFakeOption({ rows: [null, { value: 1 }, { value: 2 }] });
        const ctrl = new TestOptionControl();
        const listener = vi.fn();
        ctrl.on('optionValueChanged', listener);

        ctrl.setOption(option as any);
        listener.mockClear();

        option.source.emit('valuechanged', ['rows', 2, 'value'], null);
        option.source.emit('valuechanged', ['rows', 1, 'value'], null);

        expect(listener).toHaveBeenCalledTimes(1);

        ctrl.dispose();
        listener.mockClear();
        option.source.emit('valuechanged', ['rows', 1, 'value'], null);

        expect(listener).not.toHaveBeenCalled();
    });

    it('clears option subscriptions with setOption(null) without emitting an initial value change', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({}, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const option = createFakeOption('value');
        const ctrl = new TestOptionControl();
        const listener = vi.fn();
        ctrl.on('optionValueChanged', listener);

        ctrl.setOption(option as any);
        listener.mockClear();
        ctrl.setOption(null);
        option.source.emit('valuechanged', [], null);

        expect(ctrl.option).toBeNull();
        expect(listener).not.toHaveBeenCalled();
    });

    it('derives full value keys for template item controls', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor(params = {}, parent = null) {
                super(params, parent);
                this.setRootElement(new HTMLElement());
            }
        }

        const parent = new TestOptionControl({ valueKey: ['items'] });
        const child = new TestOptionControl({
            _templateInfo: { templateName: 'row' },
            itemKey: [2],
            valueKey: ['name'],
        }, parent);

        expect(child.getValueKey()).toEqual(['items', 2, 'name']);
        expect(child.getFullKey(['label'])).toEqual(['items', 2, 'name', 'label']);
        expect(child.getRelativeKey(['items', 2, 'name', 'label'])).toEqual(['label']);
    });

    it('treats root option changes as affecting controls with nested value keys', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({ valueKey: ['rows', 1] }, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const ctrl = new TestOptionControl();

        expect(ctrl._isKeyAffecting([])).toBe(true);
    });

    it('treats controls with empty value keys as affected by nested changes', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({ valueKey: [] }, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const ctrl = new TestOptionControl();

        expect(ctrl._isKeyAffecting(['rows', 1])).toBe(true);
        expect(ctrl.getRelativeKey(['rows', 1])).toEqual(['rows', 1]);
    });

    it('handles numeric sibling keys, string sibling keys, and type mismatches', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor(valueKey) {
                super({ valueKey }, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const numeric = new TestOptionControl(['rows', 1]);
        const stringKey = new TestOptionControl(['rows', 'name']);

        expect(numeric._isKeyAffecting(['rows', 1, 'value'])).toBe(true);
        expect(numeric._isKeyAffecting(['rows', 2, 'value'])).toBe(false);
        expect(numeric._isKeyAffecting(['rows', '1', 'value'])).toBe(true);
        expect(stringKey._isKeyAffecting(['rows', 'name', 'value'])).toBe(true);
        expect(stringKey._isKeyAffecting(['rows', 'label', 'value'])).toBe(false);
        expect(stringKey._keyDifference(['rows', 'name'], ['rows', 'name'])).toEqual([0, 0]);
        expect(numeric._keyDifference(['rows', 2], ['rows', 1])).toEqual([0, -1]);
    });

    it('returns empty relative keys when full key equals valueKey', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({ valueKey: ['rows', 1] }, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const ctrl = new TestOptionControl();

        expect(ctrl.getRelativeKey(['rows', 1])).toEqual([]);
        expect(ctrl.getFullKey()).toEqual(['rows', 1]);
        expect(ctrl.getFullKey(null)).toEqual(['rows', 1]);
        expect(ctrl.getFullKey([])).toEqual(['rows', 1]);
    });

    it('lets changing cancel source writes', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({}, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const option = createFakeOption('old');
        const ctrl = new TestOptionControl();
        ctrl.on('changing', event => {
            event.cancel = true;
        });
        ctrl.setOption(option as any);

        ctrl.setValue('new');

        expect(option.runInEditScope).not.toHaveBeenCalled();
        expect(option.setValue).not.toHaveBeenCalled();
        expect(ctrl.getValue()).toBe('old');
    });

    it('routes inserted and removed option events only for affected child keys', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({ valueKey: ['rows', 1] }, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const option = createFakeOption({ rows: [null, { value: 1 }, { value: 2 }] });
        const ctrl = new TestOptionControl();
        const inserting = vi.fn();
        const inserted = vi.fn();
        const removing = vi.fn();
        const removed = vi.fn();
        ctrl.on('optionValueInserting', inserting);
        ctrl.on('optionValueInserted', inserted);
        ctrl.on('optionValueRemoving', removing);
        ctrl.on('optionValueRemoved', removed);

        ctrl.setOption(option as any);

        option.source.emit('valueinserted', ['rows', 2, 'value'], null);
        option.source.emit('valueremoved', ['rows', 2, 'value'], null);
        option.source.emit('valueinserted', ['rows', 1, 'value'], null);
        option.source.emit('valueremoved', ['rows', 1, 'value'], null);

        expect(inserting).toHaveBeenCalledTimes(1);
        expect(inserted).toHaveBeenCalledTimes(1);
        expect(removing).toHaveBeenCalledTimes(1);
        expect(removed).toHaveBeenCalledTimes(1);
        expect(inserting).toHaveBeenCalledWith(expect.objectContaining({ key: ['value'], cancel: false }));
        expect(inserted).toHaveBeenCalledWith(expect.objectContaining({ key: ['value'] }));
        expect(removing).toHaveBeenCalledWith(expect.objectContaining({ key: ['value'], cancel: false }));
        expect(removed).toHaveBeenCalledWith(expect.objectContaining({ key: ['value'] }));
    });

    it('fires value notifications when valueKey changes', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({ valueKey: ['a'] }, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const ctrl = new TestOptionControl();
        const changing = vi.fn();
        const changed = vi.fn();
        const valueChanged = vi.fn();
        ctrl.on('optionValueChanging', changing);
        ctrl.on('optionValueChanged', changed);
        ctrl.on('value_changed', valueChanged);

        ctrl.setPropertyValue('valueKey', ['b']);

        expect(changing).toHaveBeenCalledWith(expect.objectContaining({ key: [], cancel: false }));
        expect(changed).toHaveBeenCalledWith(expect.objectContaining({ key: [] }));
        expect(valueChanged).toHaveBeenCalledTimes(1);
    });

    it('writes source values inside option and property edit scopes', async () => {
        installFakeDom();
        const { default: OptionControlBase } = await import('../optioncontrolbase');

        class TestOptionControl extends OptionControlBase<any, any, any> {
            constructor() {
                super({}, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const option = createFakeOption('old');
        const ctrl = new TestOptionControl();
        const changing = vi.fn();
        ctrl.on('changing', changing);
        ctrl.setOption(option as any);

        ctrl.setValue('new');

        expect(changing).toHaveBeenCalledWith(expect.objectContaining({ value: 'new', cancel: false }));
        expect(option.runInEditScope).toHaveBeenCalledTimes(1);
        expect(option.setValue).toHaveBeenCalledWith('new', []);
        expect(ctrl.getValue()).toBe('new');
    });
});

describe('OptionControl contract', () => {
    it('falls back to option metadata for label and defaultValue', async () => {
        installFakeDom();
        const { default: OptionControl } = await import('../optioncontrol');

        class TestOptionControl extends OptionControl<any> {
            constructor() {
                super({}, null);
                this.setRootElement(new HTMLElement());
            }
        }

        const option = createFakeOption('value', { title: 'Option title', default: 'Default value' });
        const ctrl = new TestOptionControl();

        ctrl.setOption(option as any);

        expect(ctrl.getPropertyValue('label')).toBe('Option title');
        expect(ctrl.getPropertyValue('defaultValue')).toBe('Default value');
    });

    it('pushes local-push option properties back to option metadata', async () => {
        installFakeDom();
        const { default: OptionControl } = await import('../optioncontrol');

        class TestOptionControl extends OptionControl<any> {
            constructor() {
                super({}, null);
                this.setRootElement(new HTMLElement());
                this.registerOptionProperty('custom');
            }
        }

        const option = createFakeOption('value', {});
        const ctrl = new TestOptionControl();

        ctrl.setOption(option as any);
        option.setProperty.mockClear();

        ctrl.setPropertyValue('custom', 'next');

        expect(option.setProperty).toHaveBeenCalledWith('custom', 'next', [], null);
    });
});
