// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from 'vitest';

let FormulaField: any;
let charOffset: any;

beforeAll(async () => {
    (globalThis as any)._ = (s: string) => s;
    const module = await import('../formulafield');
    FormulaField = module.default;
    charOffset = module.charOffset;
});

describe('FormulaField', () => {

    it('lays out the prefix, the formula and what follows it in one row', () => {
        let field = new FormulaField({ prefix: '=' });
        field.el.append(document.createElement('button'));
        expect(field.el.className).toBe('formula-field');
        expect(Array.from(field.el.children).map((el: any) => el.className || el.tagName)).toEqual(['equal', 'formula-text', 'BUTTON']);
        expect(field.$text.firstElementChild).toBe(field.$formula);
    });

    it('dims the $ of a prefix', () => {
        let field = new FormulaField({ prefix: 'when $source' });
        let $text = field.$prefix.firstElementChild!;
        expect($text.textContent).toBe('when $source');
        expect($text.querySelector('.dollar')!.textContent).toBe('$');
    });

    it('sizes the prefix with an invisible copy of the sizer text', () => {
        let field = new FormulaField({ prefix: '=', sizer: 'und' });
        expect(field.$prefix.querySelector('.equal-sizer')!.textContent).toBe('und');
        field.prefix = 'und';
        expect(field.$prefix.firstElementChild!.textContent).toBe('und');
    });

    it('hides an empty prefix', () => {
        let field = new FormulaField();
        expect(field.$prefix.classList.contains('empty')).toBe(true);
        field.prefix = '=';
        expect(field.$prefix.classList.contains('empty')).toBe(false);
    });

    it('reads left to right whatever the page direction', () => {
        let field = new FormulaField({ prefix: '=' });
        expect(field.$formula.getAttribute('dir')).toBe('ltr');
        expect(field.$formula.getAttribute('contenteditable')).toBe('true');
    });

    it('keeps the formula a single text node while editing', () => {
        let field = new FormulaField();
        document.body.append(field.el);
        field.$formula.innerHTML = '<br>';
        field.$formula.dispatchEvent(new Event('input'));
        expect(field.$formula.childNodes.length).toBe(0);
        field.$formula.innerHTML = 'score<div>&gt; 1</div>';
        field.$formula.dispatchEvent(new Event('input'));
        expect(field.$formula.childNodes.length).toBe(1);
        expect(field.value).toBe('score> 1');
        field.el.remove();
    });

    it('flattens before the editor\'s own input handlers run', () => {
        let field = new FormulaField();
        let seen = -1;
        field.$formula.addEventListener('input', () => seen = field.$formula.childNodes.length);
        field.$formula.innerHTML = 'a<span>b</span>';
        field.$formula.dispatchEvent(new Event('input'));
        expect(seen).toBe(1);
    });

    it('edits the formula when the prefix or the space around it is clicked', () => {
        let field = new FormulaField({ prefix: '=' });
        document.body.append(field.el);
        field.value = 'abc';
        let event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        field.$prefix.firstElementChild!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(field.$formula);
        // but leaves clicks on what follows the formula alone
        let $button = document.createElement('button');
        field.el.append($button);
        event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        $button.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        field.el.remove();
    });

    it('stops Shift+Enter adding a line', () => {
        let field = new FormulaField();
        let event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true });
        field.$formula.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    it('counts selection offsets in characters across text nodes', () => {
        let $el = document.createElement('div');
        $el.append('ab', 'cd');
        expect(charOffset($el, $el.childNodes[1], 1)).toBe(3);
    });
});
