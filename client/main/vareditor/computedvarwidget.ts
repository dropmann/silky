
'use strict';


import formulaToolbar from './formulatoolbar';
import dropdown from './dropdown';
import FormulaField from './formulafield';
import { h }  from '../../common/htmlelementcreator';
import VariableModel from './variablemodel';

class ComputedVarWidget extends HTMLElement{

    attached: boolean = false;
    model: VariableModel;
    _exampleFormulas: string[] = [
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
    formulasetup: formulaToolbar;

    $formula: HTMLInputElement;
    $showEditor: HTMLElement;
    $field!: HTMLElement;
    $formulaMessage: HTMLElement;
    _$wasEditingFormula: HTMLElement;

    _editorClicked: boolean;

    constructor(model) {
        super();

        this.model = model;
        this.classList.add('ComputedVarWidget', 'jmv-variable-computed-widget')

        dropdown.init();
        this.formulasetup = new formulaToolbar(this.model.dataset);

        let $methods = h('div', { class: 'jmv-variable-computed-methods' });
        this.append($methods);

        let $top = h('div', { class: 'top' });
        $methods.append($top);
        $top.append(h('div', { class: 'item' }, _('Formula')));

        $methods.append(h('div', { class: 'separator' }));

        let $bottom = h('div', { class: 'bottom' });
        $methods.append($bottom);

        let $options = h('div', { class: 'jmv-variable-computed-options' });
        this.append($options);
        this._createFormulaBox($options);

        this.model.on('columnChanging', () => {
            if (document.activeElement === this.$formula && this.model.attributes.formula !== this.$formula.textContent)
                this.$formula.blur();
        });

        this.$formula.addEventListener('blur', (event) => {
            if ( ! dropdown.clicked() && ! this._editorClicked) {
                this.model.set('formula', this.$formula.textContent);
                window.clearTextSelection();
            }
        });

       /* this.$formula.on('focusout', (event) => {
            if (dropdown.isVisible() && dropdown.hasFocus(event.relatedTarget) === false)
                dropdown.hide();
        });*/

        this.$formula.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.keyCode === 13 && event.shiftKey === false) {    //enter
                this._editorClicked = false;
                dropdown.hide();
                this.$formula.blur();
                event.preventDefault();
                event.stopPropagation();
            }

            if (event.keyCode === 9) {    //tab
                if (dropdown.isVisible()) {
                    dropdown.enter();
                    event.stopPropagation();
                }
                event.preventDefault();
            }
        });

        this.$formula.addEventListener('editor:closing', () => {
            this.$showEditor.classList.remove('is-active');
        });

        this.model.on('change:formula', (event) => this._setFormula(event.changed.formula));
        this.model.on('change:formulaMessage', (event) => this._setFormulaMessage(event.changed.formulaMessage));

    }

    _createFormulaBox($parent: HTMLElement) {
        let $formulaBox = h('div', { class: 'formula-box' });
        $parent.append($formulaBox);

        this.$showEditor = h('button', { class: 'show-editor', 'aria-label': _('Show formula editor'), 'aria-controls': this.formulasetup.id },
            h('div', { class: 'down-arrow' }));
        $formulaBox.append(this.$showEditor);

        this.$showEditor.addEventListener('click', (event) => {
            if (this._$wasEditingFormula !== this.$formula) {
                this.formulasetup.show(this.$formula, this.model.get('name'));
                dropdown.show(this.$formula, this.formulasetup, false, undefined, this.$field).then(() => {
                    this._editorClicked = false;
                });
                //this.$formula.focus();
                this.$showEditor.classList.add('is-active');
            }
        });

        this.$showEditor.addEventListener('mousedown', (event: MouseEvent) => {
            this._$wasEditingFormula = dropdown.focusedOn();
            this._editorClicked = true;
        });

        let $formulaPair = h('div', { class: 'formula-pair' });
        $formulaBox.append($formulaPair);

        let _example = this._exampleFormulas[Math.floor(Math.random() * this._exampleFormulas.length)];
        let field = new FormulaField({ prefix: '=', placeholder: 'eg: ' + _example });
        this.$formula = field.$formula as HTMLInputElement;
        this.$field = field.el;
        $formulaPair.append(field.el);

        this.$formula.addEventListener('input', (event) => {
            dropdown.updatePosition();
        });

        let $formulaMessageBox = h('div', { class: 'formulaMessageBox' });
        $formulaPair.append($formulaMessageBox);
        this.$formulaMessage = h('div', { class: 'formulaMessage' });
        $formulaMessageBox.append(this.$formulaMessage);
    }

    _setFormula(formula: string) {
        if ( ! this.attached)
            return;
        this.$formula.textContent = formula;
    }

    _setFormulaMessage(formulaMessage: string) {
        if ( ! this.attached)
            return;
        this.$formulaMessage.innerText = formulaMessage;
    }

    detach() {
        if ( ! this.attached)
            return;

        this.$formula.setAttribute('contenteditable', 'false');
        this.attached = false;
    }

    attach() {
        this.attached = true;

        this._setFormula(this.model.attributes.formula);
        this._setFormulaMessage(this.model.attributes.formulaMessage);
        this.$formula.setAttribute('contenteditable', 'true');
    }
}

customElements.define('jmv-computed-var-editor', ComputedVarWidget);

export default ComputedVarWidget;
