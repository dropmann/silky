
'use strict';

import formulaToolbar from './formulatoolbar';
import dropdown from './dropdown';
import FormulaField from './formulafield';
import Notify from '../notification';
import { h }  from '../../common/htmlelementcreator';
import DataSetViewModel, { Column, ColumnType } from '../dataset';
import { NotifData } from '../ribbon/notifs';

const EXAMPLE_FORMULAS = [
    "gender == 'female'",
    "score == 10",
    "consent == 'yes'",
    "Q1 != 'don\'t know'",
    "ROW() <= 100",
    "ROW() % 2",
    "-1.5 < Z(score) < 1.5",
    "ROW() != 33 and ROW() != 37",
    "score > 0.5"
];

function randomExample() {
    return EXAMPLE_FORMULAS[Math.floor(Math.random() * EXAMPLE_FORMULAS.length)];
}

/*
 The widget is a view of the leading filter columns of the data set. Filter
 columns sharing a filterNo form one filter (the first is its root, the rest
 its nested 'and' formulas). Rather than patching the DOM for each column
 event, every event calls _sync(), which works out the filters from the model
 and reconciles them against the FilterGroup/FormulaBox elements it holds,
 keyed by filterNo and column id.
*/

class FormulaBox {

    readonly el: HTMLElement;
    readonly $formula: HTMLElement;
    columnId: number;

    private widget: FilterWidget;
    private group: FilterGroup;
    private isFirst: boolean | undefined;
    private shownFormula: string | undefined;
    private shownMessage: string | undefined;
    private field: FormulaField;
    private $nested: HTMLButtonElement;
    private $nestedIcon: HTMLElement;
    private $showEditor: HTMLButtonElement;
    private $field: HTMLElement;
    private $message: HTMLElement;

    constructor(widget: FilterWidget, group: FilterGroup, column: Column) {
        this.widget = widget;
        this.group = group;
        this.columnId = column.id;

        // the prefix ('=' or 'and') is sized to fit 'and' in the current
        // language, so that the formulas of a filter line up
        this.field = new FormulaField({ sizer: _('and'), placeholder: 'e.g. ' + randomExample() });
        this.$formula = this.field.$formula;
        this.$field = this.field.el;
        this.$nestedIcon = h('span');
        this.$nested = h('button', { }, this.$nestedIcon) as HTMLButtonElement;
        this.$field.append(this.$nested);
        this.$showEditor = h('button', { 'aria-controls': widget.formulaSetup.id, class: 'show-editor', 'aria-label': _('Show formula editor') },
            h('div', { class: 'down-arrow' })) as HTMLButtonElement;
        this.$message = h('div', { class: 'formulaMessage' });

        this.el = h('div', { class: 'formula-box filter-hidden' },
            this.$showEditor,
            h('div', { class: 'formula-pair' },
                this.$field,
                h('div', { class: 'formulaMessageBox' }, this.$message)));

        this.$nested.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            if (this.isFirst)
                widget._addNested(group);
            else
                widget._removeNested(this.columnId);
        });

        this.$showEditor.addEventListener('mousedown', () => {
            widget._wasEditingFormula = dropdown.focusedOn();
            widget._editorClicked = true;
        });

        this.$showEditor.addEventListener('click', (event) => {
            if (widget._wasEditingFormula !== this.$formula) {
                let expanding = this.el.getAttribute('data-expanding') === 'true' || group.el.getAttribute('data-expanding') === 'true';
                dropdown.show(this.$formula, widget.formulaSetup, expanding, undefined, this.$field);
                widget.formulaSetup.show(this.$formula as HTMLDivElement, null);
                this.$showEditor.classList.add('is-active');
            }
            event.stopPropagation();
            event.preventDefault();
        });

        this.$formula.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                if (dropdown.isVisible()) {
                    dropdown.enter();
                    event.stopPropagation();
                }
                event.preventDefault();
            }
        });

        this.$formula.addEventListener('input', () => dropdown.updatePosition());

        this.$formula.addEventListener('editor:closing', () => {
            this.$showEditor.classList.remove('is-active');
        });

        widget._addEditEvents(group, this.$formula, () => this.columnId, 'formula');
    }

    update(column: Column, isFirst: boolean) {
        this.columnId = column.id;

        if (isFirst !== this.isFirst) {
            this.isFirst = isFirst;
            this.field.prefix = isFirst ? '=' : _('and');
            this.$nested.className = isFirst ? 'add-nested' : 'remove-nested';
            this.$nested.setAttribute('aria-label', isFirst ? _('Add another nested filter') : _('Remove nested filter'));
            this.$nestedIcon.className = isFirst ? 'mif-plus' : 'mif-cross';
        }

        // only touch the text when the model's value has changed, so that
        // unrelated updates don't overwrite what the user is typing
        if (column.formula !== this.shownFormula) {
            this.shownFormula = column.formula;
            this.$formula.textContent = column.formula;
        }
        if (column.formulaMessage !== this.shownMessage) {
            this.shownMessage = column.formulaMessage;
            this.$message.textContent = column.formulaMessage;
            this.$formula.classList.toggle('in-errror', column.formulaMessage !== '');
        }
    }
}

class FilterGroup {

    readonly el: HTMLElement;
    readonly filterNo: number;
    readonly $titleBox: HTMLElement;
    $splitter: HTMLElement | null = null;
    columns: Column[] = [];
    boxes = new Map<number, FormulaBox>();

    private widget: FilterWidget;
    private shownDescription: string | undefined;
    private $label: HTMLElement;
    private $active: HTMLElement;
    private $status: HTMLElement;
    private $formulaList: HTMLElement;
    private $description: HTMLElement;

    constructor(widget: FilterWidget, filterNo: number) {
        this.widget = widget;
        this.filterNo = filterNo;

        this.$label = h('div', { class: 'label' });
        this.$active = h('div', { class: 'active' }, h('div', { class: 'switch' }));
        this.$status = h('div', { class: 'status' });
        let $statusBox = h('div', { class: 'status-box', tabindex: '0' }, this.$active, this.$status);
        let $removeButton = h('button', { class: 'remove-filter-btn', 'aria-label': _('Remove filter') },
            h('span', { class: 'mif-cross' }));

        this.$titleBox = h('div', { class: 'title-box' },
            h('div', { class: 'label-parent' }, this.$label),
            h('div', { class: 'middle-box' }, $statusBox),
            h('div', { class: 'header-splitter' }),
            $removeButton);

        this.$formulaList = h('div', { class: 'formula-list' });
        this.$description = h('div', { class: 'description', type: 'text', spellcheck: 'true', placeholder: _('Description'), tabindex: '0', contenteditable: 'true' });

        this.el = h('div', { class: 'jmv-filter-options filter-hidden' },
            this.$titleBox,
            this.$formulaList,
            this.$description);

        $removeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            widget._removeFilter(this);
        });

        this.el.addEventListener('click', () => {
            if ( ! this.el.classList.contains('remove'))
                widget._editColumn(this.rootId);
        });

        let toggleActive = (event: Event) => {
            event.stopPropagation();
            event.preventDefault();
            let active = this.columns[0].active;
            widget._setColumnProperties(this, this.columns.map(column => ({ id: column.id, values: { active: ! active } })));
        };
        $statusBox.addEventListener('click', toggleActive);
        $statusBox.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ')
                toggleActive(event);
        });

        widget._addEditEvents(this, this.$description, () => this.rootId, 'description');
    }

    get rootId() {
        return this.columns[0].id;
    }

    // returns the boxes created by this sync, so the widget can reveal them
    sync(columns: Column[], index: number) {
        this.columns = columns;

        let ids = new Set(columns.map(column => column.id));
        for (let [id, box] of this.boxes) {
            if ( ! ids.has(id)) {
                this.boxes.delete(id);
                this.widget._removeElement(box.el);
            }
        }

        let created: FormulaBox[] = [];
        let order = columns.map((column, i) => {
            let box = this.boxes.get(column.id);
            if (box === undefined) {
                box = new FormulaBox(this.widget, this, column);
                this.boxes.set(column.id, box);
                created.push(box);
            }
            box.update(column, i === 0);
            return box.el;
        });
        this.widget._arrange(this.$formulaList, order);

        let root = columns[0];
        this.$label.textContent = root.name || _('Filter {i}', { i: index + 1 });
        this._setActive(root.active);

        if (root.description !== this.shownDescription) {
            this.shownDescription = root.description;
            this.$description.textContent = root.description;
        }

        return created;
    }

    private _setActive(active: boolean) {
        this.$status.textContent = active ? _('active') : _('inactive');
        this.$active.classList.toggle('filter-disabled', ! active);
        this.$active.setAttribute('title', active ? _('Filter is active') : _('Filter is inactive'));
    }
}

class FilterWidget extends HTMLElement {

    model: DataSetViewModel;
    attached: boolean = false;
    formulaSetup: formulaToolbar;
    _wasEditingFormula: HTMLElement | null = null;
    _editorClicked = false;

    private _editNote: Notify = new Notify({ duration: 3000 });
    private _groups = new Map<number, FilterGroup>();
    private _focusNewFormula = false;
    private _removingFilter = false;
    private _stickyBottomCount = 0;
    private _stickyBottomHeight = 0;

    private $filterList: HTMLElement;
    private $showFilter: HTMLButtonElement;

    constructor(model: DataSetViewModel) {
        super();

        this.model = model;

        dropdown.init();
        this.formulaSetup = new formulaToolbar(this.model);

        this.classList.add('jmv-filter-widget', 'FilterWidget');

        let $addFilter = h('button', { class: 'filter-button filter-button-tooltip add-filter', 'aria-label': _('Add new filter') });
        $addFilter.addEventListener('click', () => this._addFilter());

        let filtersVisible = this.model.get('filtersVisible');
        this.$showFilter = h('button', { class: `filter-button filter-button-tooltip ${(filtersVisible ? 'show-filter-columns' : 'hide-filter-columns')}`, 'aria-label': _('Show filter columns') }) as HTMLButtonElement;
        this.$showFilter.addEventListener('click', () => this.model.toggleFilterVisibility());

        this.$filterList = h('div', { class: 'jmv-filter-list-box' });

        this.append(
            h('div', { class: 'jmv-filter-list-buttons' }, $addFilter, this.$showFilter),
            this.$filterList);

        this.model.on('dataSetLoaded', this._dataSetLoaded, this);
        this.model.on('columnsDeleted', this._sync, this);
        this.model.on('columnsInserted', this._sync, this);
        this.model.on('columnsActiveChanged', this._sync, this);
        this.model.on('columnsChanged', this._sync, this);
        this.model.on('change:filtersVisible', this._updateEyeButton, this);

    }

    /* ---- reconciling the DOM with the model ---- */

    _dataSetLoaded() {
        this._groups.clear();
        this.$filterList.textContent = '';
        this._sync();
    }

    _sync() {
        let wanted = new Map<number, Column[]>();
        for (let column of this.model.attributes.columns) {
            if (column.columnType !== ColumnType.FILTER)
                break;
            let columns = wanted.get(column.filterNo);
            if (columns === undefined)
                wanted.set(column.filterNo, columns = []);
            columns.push(column);
        }

        for (let [filterNo, group] of this._groups) {
            if ( ! wanted.has(filterNo)) {
                this._groups.delete(filterNo);
                this._removeElement(group.el);
                if (group.$splitter)
                    this._removeElement(group.$splitter);
            }
        }

        let order: HTMLElement[] = [];
        let newGroups: FilterGroup[] = [];
        let newBoxes: FormulaBox[] = [];
        let index = 0;
        for (let [filterNo, columns] of wanted) {
            let group = this._groups.get(filterNo);
            if (group === undefined) {
                group = new FilterGroup(this, filterNo);
                this._groups.set(filterNo, group);
                newGroups.push(group);
            }

            if (index > 0 && group.$splitter === null)
                group.$splitter = h('div', { class: 'jmv-filter-splitter' });
            else if (index === 0 && group.$splitter !== null) {
                this._removeElement(group.$splitter);
                group.$splitter = null;
            }

            if (group.$splitter)
                order.push(group.$splitter);
            order.push(group.el);

            newBoxes.push(...group.sync(columns, index));
            index++;
        }

        this._arrange(this.$filterList, order);
        this._reveal(newGroups, newBoxes);
    }

    // puts the live children of $parent in the given order, leaving any
    // that are animating out (.remove) where they are
    _arrange($parent: HTMLElement, order: HTMLElement[]) {
        let nextLive = (el: Element | null) => {
            while (el && el.classList.contains('remove'))
                el = el.nextElementSibling;
            return el;
        };
        let $ref = nextLive($parent.firstElementChild);
        for (let el of order) {
            if (el === $ref)
                $ref = nextLive($ref.nextElementSibling);
            else
                $parent.insertBefore(el, $ref);
        }
    }

    private _reveal(groups: FilterGroup[], boxes: FormulaBox[]) {
        if (groups.length === 0 && boxes.length === 0)
            return;

        let $focus = this._focusNewFormula && boxes.length > 0 ? boxes[boxes.length - 1].$formula : null;
        if ($focus)
            this._focusNewFormula = false;

        setTimeout(() => {
            for (let group of groups) {
                if (this.attached)
                    this._expandSection(group.el, '100px');
                group.el.classList.remove('filter-hidden');
            }
            for (let box of boxes) {
                if (this.attached)
                    this._expandSection(box.el);
                box.el.classList.remove('filter-hidden');
            }
            if (groups.length > 0)
                this._stickyBottom(this.$filterList);
            if ($focus)
                setTimeout(() => $focus.focus(), 0);
        }, 10);
    }

    _removeElement(el: HTMLElement) {
        if ( ! this.attached) {
            el.remove();
            return;
        }

        let done = (e: TransitionEvent) => {
            if (e.target !== el)
                return;
            el.removeEventListener('transitionend', done);
            el.remove();
        };
        el.addEventListener('transitionend', done);
        el.classList.add('remove');
        this._collapseSection(el);
    }

    /* ---- actions ---- */

    async _addFilter() {
        let columns = this.model.attributes.columns;
        let index = 0;
        while (index < columns.length && columns[index].columnType === ColumnType.FILTER)
            index++;

        this._focusNewFormula = true;
        try {
            await this.model.insertColumn({ index, columnType: ColumnType.FILTER, hidden: this.model.get('filtersVisible') === false } as Column);
            this._editColumn(this.model.getColumn(index).id);
        }
        catch (error) {
            this._focusNewFormula = false;
            this._notifyEditProblem(error);
        }
    }

    async _addNested(group: FilterGroup) {
        let last = group.columns[group.columns.length - 1];
        let index = last.index + 1;

        this._focusNewFormula = true;
        try {
            await this.model.insertColumn({
                index,
                columnType: ColumnType.FILTER,
                filterNo: group.filterNo,
                hidden: this.model.get('filtersVisible') === false,
                active: group.columns[0].active
            } as Column);
            this._editColumn(this.model.getColumn(index).id);
        }
        catch (error) {
            this._focusNewFormula = false;
            this._notifyEditProblem(error);
        }
    }

    async _removeNested(columnId: number) {
        await this._deleteColumns([columnId]);
    }

    async _removeFilter(group: FilterGroup) {
        await this._deleteColumns(group.columns.map(column => column.id));
    }

    private async _deleteColumns(ids: number[]) {
        if (this._removingFilter || ids.length === 0)
            return;

        this._removingFilter = true;
        try {
            await this.model.deleteColumns(ids);
        }
        catch (error) {
            this._notifyEditProblem(error);
        }
        finally {
            this._removingFilter = false;
        }
    }

    async _setColumnProperties(group: FilterGroup, pairs: { id: number; values: Partial<Column> }[]) {
        if (pairs.length === 0)
            return;

        let timeoutId = setTimeout(() => group.$titleBox.classList.add('think'), 400);
        try {
            await this.model.changeColumns(pairs);
        }
        catch (error) {
            this._notifyEditProblem(error);
        }
        finally {
            clearTimeout(timeoutId);
            group.$titleBox.classList.remove('think');
        }
    }

    // makes the column the one being edited. The model compares editingVar by
    // reference, so setting an equal array still fires a change, and the
    // variable editor responds by re-attaching the editor panel, which closes
    // any open dropdown (such as the formula editor after inserting a function)
    _editColumn(id: number) {
        let current = this.model.get('editingVar');
        if (current && current.length === 1 && current[0] === id)
            return;
        this.model.set('editingVar', [id]);
    }

    // focus/blur/enter handling shared by the formulas and the description;
    // the column is looked up when needed, as a group's root can change
    _addEditEvents(group: FilterGroup, $element: HTMLElement, getColumnId: () => number, property: 'formula' | 'description') {

        $element.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
        });

        $element.addEventListener('focus', () => {
            if (this._removingFilter) {
                $element.blur();
                return;
            }
            setTimeout(() => { //so that the focusloop handler can process the focus mode before editingVar is set. Otherwise the spreadsheet gets the focus.
                this._editColumn(getColumnId());
            }, 0);
        });

        $element.addEventListener('blur', () => {
            if (dropdown.clicked() || this._editorClicked) {
                this._editorClicked = false;
                return;
            }

            let column = this.model.getColumnById(getColumnId());
            if (column !== undefined && $element.textContent !== column[property])
                this._setColumnProperties(group, [{ id: column.id, values: { [property]: $element.textContent } }]);

            window.clearTextSelection();
        });

        $element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && ! event.shiftKey) {
                dropdown.hide();
                $element.blur();
            }
        });
    }

    private _notifyEditProblem(error: any) {
        let details: Partial<NotifData> = { title: error.message, message: error.cause, type: 'error' };
        this._editNote.set(details);
        this.dispatchEvent(new CustomEvent('notification', { detail: this._editNote }));
    }

    /* ---- presentation ---- */

    private _updateEyeButton() {
        let visible = this.model.get('filtersVisible');
        this.$showFilter.classList.toggle('hide-filter-columns', visible);
        this.$showFilter.classList.toggle('show-filter-columns', ! visible);
        this.$showFilter.setAttribute('title', visible ? _('Hide filter columns') : _('Show filter columns'));
    }

    private _collapseSection(element: HTMLElement) {
        let sectionHeight = element.scrollHeight;

        let elementTransition = element.style.transition;
        element.style.transition = '';

        requestAnimationFrame(() => {
            element.style.height = sectionHeight + 'px';
            element.style.transition = elementTransition;
            requestAnimationFrame(() => {
                element.style.height = 0 + 'px';
            });
        });
    }

    private _expandSection(element: HTMLElement, value?: string) {
        element.setAttribute('data-expanding', 'true');
        let sectionHeight = element.scrollHeight;

        element.style.height = value === undefined ? `${sectionHeight}px` : value;

        const done = (e: TransitionEvent) => {
            // transitions on child elements bubble up; only react to this element's own
            if (e.target !== element)
                return;
            element.removeEventListener('transitionend', done);
            element.style.height = null;
            element.setAttribute('data-expanding', 'false');
            dropdown.updatePosition();
        };
        element.addEventListener('transitionend', done);
    }

    // keeps the list scrolled to the bottom while a new filter expands
    private _stickyBottom($element: HTMLElement) {
        if (this._stickyBottomCount < 3) {
            let height = $element.scrollHeight;
            if (height !== this._stickyBottomHeight) {
                this._stickyBottomCount = 0;
                this._stickyBottomHeight = height;
                $element.scrollTop = height;
            }
            else
                this._stickyBottomCount += 1;

            setTimeout(() => this._stickyBottom($element), 10);
        }
        else
            this._stickyBottomCount = 0;
    }

    private _cleanUp() {
        // clean up any removes that exist because the transitionend was not called
        this.$filterList.querySelectorAll('.remove').forEach(el => el.remove());
        this.$filterList.querySelectorAll<HTMLElement>('[data-expanding="true"]').forEach(el => {
            el.style.height = '';
            el.setAttribute('data-expanding', 'false');
        });
    }

    /* ---- called by the editor widget ---- */

    attach() {
        this._cleanUp();
        this.attached = true;
        this.update();
    }

    detach() {
        if ( ! this.attached)
            return;

        this._cleanUp();
        this.attached = false;
    }

    update() {
        this._updateEyeButton();

        let editingIds: number[] = this.model.get('editingVar');
        let $scrollTo: HTMLElement | null = null;
        for (let group of this._groups.values()) {
            let selected = group.columns.some(column => editingIds.includes(column.id));
            group.el.classList.toggle('selected', selected);
            if (selected && $scrollTo === null)
                $scrollTo = group.el;
        }

        if ($scrollTo && this.$filterList.scrollHeight > this.$filterList.clientHeight) {  // don't call scrollIntoView timer if there is no scrollbar
            setTimeout(() => $scrollTo.scrollIntoView(false), 250);
        }
    }
}

customElements.define('jmv-filters-editor', FilterWidget);

export default FilterWidget;
