'use strict';

import { h }  from '../../common/htmlelementcreator';

/*
 The box a formula is edited in: a prefix ('=', 'and', 'if $source', ...),
 the formula itself, and whatever buttons follow it, side by side in one
 bordered row (.formula-field). Being in the flow, rather than overlaid on a
 formula indented to make room for it, keeps the formula's text, its wrapped
 lines and its caret clear of the prefix.

   .formula-field
     .equal            the prefix
     .formula-text     holds the formula, and anything overlaid on its start
       .formula        contenteditable, kept as a single text node
     ...               buttons, appended by the editor

 Formulas are code and read left to right whatever the language; in a right
 to left layout the field keeps its order (the prefix comes first, at the
 right), and the formula, still left to right inside, sits against it.

 The editors style the field itself (border, padding, font, line height).
*/

// the number of characters of el's text before (node, offset)
export function charOffset(el: HTMLElement, node: Node, offset: number): number {
    let range = document.createRange();
    range.selectNodeContents(el);
    range.setEnd(node, offset);
    return range.toString().length;
}

export function placeCaret(el: HTMLElement, offset: number) {
    let text = el.firstChild;
    if (text && text.nodeType === Node.TEXT_NODE)
        window.getSelection()?.setBaseAndExtent(text, offset, text, offset);
    else
        window.getSelection()?.setBaseAndExtent(el, 0, el, 0);
}

// collapses el's contents to a single text node (or nothing, when empty, so
// :empty and the placeholder apply), keeping the caret where it was
export function flattenText(el: HTMLElement) {
    let first = el.firstChild;
    if (el.childNodes.length === 0 || (el.childNodes.length === 1 && first?.nodeType === Node.TEXT_NODE && first.textContent !== ''))
        return;

    let sel = window.getSelection();
    let caret = sel && sel.rangeCount > 0 && el.contains(sel.anchorNode) ? charOffset(el, sel.anchorNode!, sel.anchorOffset) : null;
    el.textContent = el.textContent;
    if (caret !== null)
        placeCaret(el, Math.min(caret, el.textContent.length));
}

// the prefix, with a '$' (as in '$source') dimmed
function prefixChildren(prefix: string): Array<string | Node> {
    let i = prefix.indexOf('$');
    if (i === -1)
        return [prefix];
    return [prefix.slice(0, i), h('span', { class: 'dollar' }, '$'), prefix.slice(i + 1)];
}

// The formula toolbar inserts at the selection recorded on a formula as
// sel-start and sel-end, counted in characters from the start of the formula.
// One listener records it for every formula field.
let tracking = false;
function trackSelection() {
    if (tracking)
        return;
    tracking = true;
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if ( ! sel || sel.rangeCount === 0 || ! sel.anchorNode)
            return;
        const $anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement;
        const $formula = $anchor?.closest<HTMLElement>('.formula-field .formula');
        if ( ! $formula)
            return;
        const range = sel.getRangeAt(0);
        $formula.setAttribute('sel-start', charOffset($formula, range.startContainer, range.startOffset).toString());
        $formula.setAttribute('sel-end', charOffset($formula, range.endContainer, range.endOffset).toString());
    });
}

export interface FormulaFieldOptions {
    prefix?: string;
    // text the prefix is made at least as wide as (in the current language),
    // so that the formulas of fields with different prefixes line up
    sizer?: string;
    placeholder?: string;
    label?: string;
    className?: string;
}

export class FormulaField {

    readonly el: HTMLElement;
    readonly $prefix: HTMLElement;
    readonly $text: HTMLElement;
    readonly $formula: HTMLDivElement;
    private $prefixText: HTMLElement;
    private _prefix: string | undefined;

    constructor(options: FormulaFieldOptions = { }) {
        trackSelection();

        this.$prefixText = h('span');
        this.$prefix = h('div', { class: 'equal', 'aria-hidden': 'true' }, this.$prefixText);
        if (options.sizer)
            this.$prefix.append(h('span', { class: 'equal-sizer' }, options.sizer));

        this.$formula = h('div', { class: 'formula', role: 'textbox', 'aria-label': options.label ?? _('Formula'), dir: 'ltr',
            spellcheck: 'false', autocapitalize: 'off', contenteditable: 'true', tabindex: '0' }) as HTMLDivElement;
        if (options.placeholder)
            this.$formula.setAttribute('placeholder', options.placeholder);

        this.$text = h('div', { class: 'formula-text' }, this.$formula);
        this.el = h('div', { class: 'formula-field' + (options.className ? ' ' + options.className : '') }, this.$prefix, this.$text);

        this.prefix = options.prefix ?? '';

        // clicks on the prefix or the space around the formula edit it
        this.el.addEventListener('mousedown', (event) => {
            let target = event.target as Element;
            if (target !== this.el && target !== this.$text && ! this.$prefix.contains(target))
                return;
            event.preventDefault();
            this.$formula.focus();
            placeCaret(this.$formula, this.$formula.textContent.length);
        });

        // keep the formula a single text node: pastes come in as plain text on
        // one line, and anything the browser adds while editing (such as the
        // <br> left after deleting everything) is flattened back to text.
        // Registered first, so the editor's own input handlers see the result.
        this.$formula.addEventListener('paste', (event) => {
            event.preventDefault();
            let text = (event.clipboardData?.getData('text/plain') ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
            // insertText keeps the browser's undo history; insert by hand where it's unavailable
            if ( ! document.execCommand('insertText', false, text)) {
                let sel = window.getSelection();
                if ( ! sel || sel.rangeCount === 0)
                    return;
                let range = sel.getRangeAt(0);
                range.deleteContents();
                let node = document.createTextNode(text);
                range.insertNode(node);
                range.setStartAfter(node);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                flattenText(this.$formula);
                this.$formula.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        this.$formula.addEventListener('input', () => flattenText(this.$formula));
        this.$formula.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.shiftKey)  // a formula is one line
                event.preventDefault();
        });
    }

    get prefix(): string {
        return this._prefix ?? '';
    }

    set prefix(text: string) {
        if (text === this._prefix)
            return;
        this._prefix = text;
        this.$prefixText.replaceChildren(...prefixChildren(text));
        this.$prefix.classList.toggle('empty', text === '');
    }

    get value(): string {
        return this.$formula.textContent ?? '';
    }

    set value(text: string) {
        if (text !== this.$formula.textContent)
            this.$formula.textContent = text;
    }
}

export default FormulaField;
