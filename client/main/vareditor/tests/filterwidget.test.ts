// @vitest-environment jsdom

import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../dropdown', () => ({ default: {
    init: () => {}, show: () => {}, hide: () => {}, updatePosition: () => {},
    focusedOn: () => null, clicked: () => false, isVisible: () => false, enter: () => {},
} }));
vi.mock('../formulatoolbar', () => ({ default: class { id = 'tool-1'; show() {} } }));
vi.mock('../../notification', () => ({ default: class { set() {} } }));
vi.mock('../../ribbon/notifs', () => ({}));
vi.mock('../../dataset', () => ({ ColumnType: { FILTER: 'filter', DATA: 'data' }, default: class {} }));

let nextId = 100;
function col(filterNo: number, extra: any = {}) {
    return { id: nextId++, columnType: 'filter', filterNo, name: '', formula: '', formulaMessage: '', description: '', active: true, index: 0, ...extra };
}
function dataCol() { return { id: nextId++, columnType: 'data', name: 'x', index: 0 }; }

class FakeModel {
    attributes: any = { columns: [], editingVar: [], filtersVisible: true };
    handlers: Record<string, Array<[Function, any]>> = {};
    deleteColumns = vi.fn(async (ids: number[]) => { this.setColumns(this.attributes.columns.filter((c: any) => ! ids.includes(c.id))); this.trigger('columnsDeleted'); });
    changeColumns = vi.fn(async () => {});
    insertColumn = vi.fn(async () => {});
    on(name: string, fn: Function, ctx?: any) { (this.handlers[name] ??= []).push([fn, ctx]); }
    trigger(name: string, ...args: any[]) { for (let [fn, ctx] of this.handlers[name] ?? []) fn.call(ctx, ...args); }
    get(name: string) { return this.attributes[name]; }
    set(name: string, value: any) { this.attributes[name] = value; }
    getColumn(i: number) { return this.attributes.columns[i]; }
    getColumnById(id: number) { return this.attributes.columns.find((c: any) => c.id === id); }
    toggleFilterVisibility() {}
    setColumns(columns: any[]) {
        columns.forEach((c, i) => c.index = i);
        // name filters the way the server does
        let seen: number[] = [];
        for (let c of columns) {
            if (c.columnType !== 'filter') break;
            if ( ! seen.includes(c.filterNo)) { seen.push(c.filterNo); c.name = `Filter ${seen.length}`; }
        }
        this.attributes.columns = columns;
    }
}

let FilterWidget: any;

beforeAll(async () => {
    (globalThis as any)._ = (s: string, a?: any) => a ? s.replace(/\{(\w+)\}/g, (_m: string, k: string) => a[k]) : s;
    (window as any).clearTextSelection = () => {};
    FilterWidget = (await import('../filterwidget')).default;
});

function layout(widget: any) {
    let $list = widget.querySelector('.jmv-filter-list-box');
    return Array.from($list.children as HTMLCollection)
        .filter(el => ! el.classList.contains('remove'))
        .map(el => el.classList.contains('jmv-filter-splitter') ? '|' :
            el.querySelector('.label')!.textContent + '[' + Array.from(el.querySelectorAll('.formula-box'))
                .map(b => b.querySelector('.equal > span')!.textContent + (b.querySelector('.add-nested') ? '+' : 'x') + b.querySelector('.formula')!.textContent)
                .join(',') + ']');
}

function setup(columns: any[]) {
    let model = new FakeModel();
    model.setColumns(columns);
    let widget = new FilterWidget(model);
    model.trigger('dataSetLoaded');
    return { model, widget };
}

describe('FilterWidget', () => {

    it('builds groups, splitters and nested formulas from the model', () => {
        let { widget } = setup([col(0, { formula: 'a' }), col(0, { formula: 'b' }), col(1, { formula: 'c' }), dataCol()]);
        expect(layout(widget)).toEqual(['Filter 1[=+a,andxb]', '|', 'Filter 2[=+c]']);
    });

    it('shows the eye button', () => {
        let { widget } = setup([col(0)]);
        expect(widget.querySelector('.jmv-filter-list-buttons')!.children.length).toBe(2);
    });

    it('inserts a filter at the front, keeping existing elements', () => {
        let { model, widget } = setup([col(0, { formula: 'a' }), col(1, { formula: 'c' }), dataCol()]);
        let $before = widget.querySelectorAll('.jmv-filter-options');
        model.setColumns([col(2, { formula: 'n' }), ...model.attributes.columns]);
        model.trigger('columnsInserted');
        expect(layout(widget)).toEqual(['Filter 1[=+n]', '|', 'Filter 2[=+a]', '|', 'Filter 3[=+c]']);
        let $after = widget.querySelectorAll('.jmv-filter-options');
        expect($after[1]).toBe($before[0]);
        expect($after[2]).toBe($before[1]);
    });

    it('promotes the next formula when a root formula is deleted', () => {
        let { model, widget } = setup([col(0, { formula: 'a' }), col(0, { formula: 'b' }), col(0, { formula: 'c' }), dataCol()]);
        model.setColumns(model.attributes.columns.slice(1));
        model.trigger('columnsDeleted');
        expect(layout(widget)).toEqual(['Filter 1[=+b,andxc]']);
    });

    it('drops the splitter of the filter that becomes first', () => {
        let { model, widget } = setup([col(0, { formula: 'a' }), col(1, { formula: 'c' }), col(2, { formula: 'd' }), dataCol()]);
        model.setColumns(model.attributes.columns.slice(1));
        model.trigger('columnsDeleted');
        expect(layout(widget)).toEqual(['Filter 1[=+c]', '|', 'Filter 2[=+d]']);
    });

    it('does not overwrite a formula being typed on unrelated updates', () => {
        let { model, widget } = setup([col(0, { formula: 'a' }), dataCol()]);
        let $formula = widget.querySelector('.formula') as HTMLElement;
        $formula.textContent = 'typing';
        model.trigger('columnsChanged', { changes: [] });
        expect($formula.textContent).toBe('typing');
        model.attributes.columns[0] = { ...model.attributes.columns[0], formula: 'server' };
        model.trigger('columnsChanged', { changes: [] });
        expect($formula.textContent).toBe('server');
    });

    it('removes a whole filter through the remove button', () => {
        let { model, widget } = setup([col(0), col(0), col(1), dataCol()]);
        let ids = model.attributes.columns.slice(0, 2).map((c: any) => c.id);
        (widget.querySelector('.remove-filter-btn') as HTMLElement).click();
        expect(model.deleteColumns).toHaveBeenCalledWith(ids);
    });

    it('keeps removal working after a failed delete', async () => {
        let { model, widget } = setup([col(0), col(0), dataCol()]);
        model.deleteColumns.mockRejectedValueOnce(new Error('nope'));
        let $remove = () => widget.querySelector('.remove-nested') as HTMLElement;
        $remove().click();
        await new Promise(r => setTimeout(r, 0));
        $remove().click();
        await new Promise(r => setTimeout(r, 0));
        expect(model.deleteColumns).toHaveBeenCalledTimes(2);
        expect(layout(widget)).toEqual(['Filter 1[=+]']);
    });

    it('keeps a formula as a single text node while editing', () => {
        let { widget } = setup([col(0, { formula: 'a' }), dataCol()]);
        let $formula = widget.querySelector('.formula') as HTMLElement;
        // what the browser leaves after deleting everything
        $formula.innerHTML = '<br>';
        $formula.dispatchEvent(new Event('input'));
        expect($formula.childNodes.length).toBe(0);
        expect($formula.matches(':empty')).toBe(true);
        // and after a line break is inserted mid formula
        $formula.innerHTML = 'score<div>&gt; 1</div>';
        $formula.dispatchEvent(new Event('input'));
        expect($formula.childNodes.length).toBe(1);
        expect($formula.textContent).toBe('score> 1');
    });

    it('puts the prefix, formula and nested button inside one field', () => {
        let { widget } = setup([col(0), col(0), dataCol()]);
        let $fields = widget.querySelectorAll('.formula-field');
        expect($fields.length).toBe(2);
        expect(Array.from($fields[1].children).map((el: any) => el.className)).toEqual(['equal', 'formula', 'remove-nested']);
    });

    it('does not re-set editingVar when focusing a formula already being edited', async () => {
        let { model, widget } = setup([col(0), dataCol()]);
        let id = model.attributes.columns[0].id;
        let editing = [id];
        model.attributes.editingVar = editing;
        (widget.querySelector('.formula') as HTMLElement).dispatchEvent(new Event('focus'));
        await new Promise(r => setTimeout(r, 0));
        expect(model.get('editingVar')).toBe(editing);
        model.attributes.editingVar = [999];
        (widget.querySelector('.formula') as HTMLElement).dispatchEvent(new Event('focus'));
        await new Promise(r => setTimeout(r, 0));
        expect(model.get('editingVar')).toEqual([id]);
    });

    it('toggles every formula of a filter when its status is clicked', () => {
        let { model, widget } = setup([col(0), col(0), dataCol()]);
        (widget.querySelector('.status-box') as HTMLElement).click();
        expect(model.changeColumns).toHaveBeenCalledWith(model.attributes.columns.slice(0, 2).map((c: any) => ({ id: c.id, values: { active: false } })));
    });
});
