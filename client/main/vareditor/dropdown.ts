'use strict';

import interactionManager, { type FocusLoop } from '../../common/interactionmanager';
import type { IFocusLoopDeactivateEvent } from '../../common/interactionmanager/focustype';

export interface DropdownContent extends HTMLElement {
    isScrollTarget: (target: EventTarget | null) => boolean;
}

interface ShowOptions {
    data: {
        dropdown: Dropdown;
        check: boolean;
    };
}

class Dropdown extends HTMLElement {
    private _inTools: boolean = false;
    private _shown: boolean = false;
    private _waiting: boolean = false;
    private _resolve: (() => void) | null = null;
    private _promise: Promise<void> | null = null;
    private $formula: HTMLElement | null = null;
    // what the dropdown is positioned against; the formula unless show() is given another
    private $anchor: HTMLElement | null = null;
    private $content: DropdownContent | null = null;
    private $contents: HTMLDivElement;
    private _boundHide: (() => void) | null = null;
    private loop: FocusLoop;

    constructor() {
        super();

        this.classList.add('jmv-dropdown-widget', 'dropdown-hidden', 'dropdown-remove');
        this.tabIndex = -1;

        this.$contents = document.createElement('div');
        this.$contents.className = 'jmv-dropdown-contents';
        this.append(this.$contents);

        this.loop = interactionManager.registerLoop(this, {
            level: 1,
            hoverFocus: false,
            exitKeys: ['Escape']
        });
        this.loop.on('deactivate', (event: IFocusLoopDeactivateEvent) => {
            // focus moving back into the dropdown's own formula (the formula
            // toolbar does this after inserting a function or variable) keeps
            // the dropdown open, so that something else can be chosen. The
            // deactivation is cancelled rather than let through: a loop that
            // deactivated would be re-activated by the next click into the
            // dropdown without the formula as its exit, and would pull focus
            // back out of the formula after that insert. Escape (programmatic),
            // and focus going anywhere else, still close it.
            if (event?.reason === 'focus-transfer' && event.canCancel && this._shown && this.$formula?.contains(document.activeElement)) {
                event.cancel = true;
                return;
            }
            this.hide({ data: { dropdown: this, check: false } });
        });

        window.addEventListener('resize', () => this._findPosition());
        window.addEventListener('scroll', this._onScroll, true);
        document.addEventListener('mousedown', this._onDocumentMouseDown);
        this.addEventListener('focusout', this._onFocusOut);
    }

    private _onScroll = (event: Event) => {
        if (this._shown && !this._waiting && this.$content?.isScrollTarget(event.target) === false) {
            this.hide({ data: { dropdown: this, check: false } });
        }
    };

    private _onDocumentMouseDown = (event: MouseEvent) => {
        const inTool = this._elementContainsPoint(this, event);
        const inFormula = this.$anchor ? this._elementContainsPoint(this.$anchor, event) : false;

        this._inTools = inTool;

        if (!inTool && !inFormula) {
            this.hide({ data: { dropdown: this, check: false } });
        }
    };

    // Escape from the formula closes the dropdown. The focus loop's own Escape
    // handling only applies while focus is inside the dropdown, and focus is
    // back in the formula after something has been inserted from it.
    private _onFormulaKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this._shown) {
            event.preventDefault();
            event.stopPropagation();
            this.hide({ data: { dropdown: this, check: false } });
        }
    };

    // $formula can be a container of formulas (the transform editor passes
    // its formula grid), so focus moving to anything inside it stays
    private _onFocusOut = (event: FocusEvent) => {
        const to = event.relatedTarget as Node | null;
        if (!this.contains(to) && !(to && this.$formula?.contains(to))) {
            this.hide({ data: { dropdown: this, check: false } });
        }
    };

    private _elementContainsPoint(element: HTMLElement, event: MouseEvent): boolean {
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right &&
               event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    // A loop has to be one level above any loop it sits inside: the loop
    // around it treats the next level up as a child loop to skip over, and
    // the dropdown's own navigation skips anything inside a loop one level
    // above it, which would be all of it. The transform editor hosts the
    // dropdown inside its own (level 2) loop, so its level follows its host.
    private _setLevel(host: HTMLElement) {
        const $parentLoop = host.closest('.menu-level');
        const parentLevel = $parentLoop ? parseInt($parentLoop.getAttribute('fl-level') ?? '0') : 0;
        const level = (isNaN(parentLevel) ? 0 : parentLevel) + 1;
        this.loop.level = level;
        this.setAttribute('fl-level', level.toString());
    }

    private _findPosition() {
        if (!this.$anchor || !this._shown) return;

        this.classList.remove('dropdown-remove');

        setTimeout(() => {
            this.classList.remove('dropdown-hidden');
            this.addEventListener('transitionend', () => {
                this._waiting = false;
            }, { once: true });
        }, 0);

        const rect = this.$anchor.getBoundingClientRect();
        const isBodyHosted = this.parentElement === document.body;
        const top = rect.top + rect.height + 1 + (isBodyHosted ? window.scrollY : 0);
        const left = rect.left + (isBodyHosted ? window.scrollX : 0);

        this.style.position = isBodyHosted ? 'absolute' : 'fixed';
        this.style.top = `${top}px`;
        this.style.left = `${left}px`;
        this.style.minWidth = `${this.$anchor.offsetWidth}px`;
    }

    public show($formula: HTMLElement, content: DropdownContent, wait: boolean = false, host: HTMLElement = document.body, anchor: HTMLElement = $formula): Promise<void> {
        const formulaEl = $formula;

        if (this.parentElement !== host) {
            host.append(this);
            this._setLevel(host);
        }

        if (content !== this.$content) {
            if (this.$content) {
                this.$content.remove();
                this.$content.removeEventListener('hide-dropdown', this._boundHide!);
            }

            if (this._resolve) {
                this._resolve();
                this._resolve = null;
            }

            this.$content = content;
            this._boundHide = () => this.hide({ data: { dropdown: this, check: false } });
            this.$content.addEventListener('hide-dropdown', this._boundHide);
            this.$contents.append(this.$content);
        }

        if (!this._resolve) {
            this._promise = new Promise<void>((resolve) => {
                this._resolve = resolve;
            });
        }

        setTimeout(() => {
            // The dropdown may already have been closed again by the time this
            // fires (e.g. a quick open-then-pick) - activating a closed loop
            // would trap focus in a hidden container.
            // Leaving returns focus to the formula being edited, which is
            // inside formulaEl when that is a container of formulas.
            if (this._shown && this.$formula === formulaEl) {
                const $focused = document.activeElement as HTMLElement | null;
                const exit = $focused && $focused !== formulaEl && formulaEl.contains($focused) ? $focused : formulaEl;
                this.loop.activate({ withMouse: false, exitSelector: exit });
            }
        }, 200);

        if (this._shown && formulaEl === this.$formula) {
            return this._promise!;
        }

        this._shown = true;
        this._waiting = wait;

        if (this.$formula) {
            this.$formula.setAttribute('aria-expanded', 'false');
            this.$formula.removeEventListener('focusout', this._onFocusOut);
            this.$formula.removeEventListener('keydown', this._onFormulaKeyDown);
        }

        this.$formula = formulaEl;
        this.$anchor = anchor;

        if (this.$formula) {
            this.$formula.setAttribute('aria-expanded', 'true');
            this.$formula.addEventListener('focusout', this._onFocusOut);
            this.$formula.addEventListener('keydown', this._onFormulaKeyDown);
        }

        if (!wait) {
            this._findPosition();
        }

        return this._promise!;
    }

    public hide(event: ShowOptions) {
        const { dropdown: self, check } = event.data;

        if ((!check || !self._inTools) && self._shown) {
            self.classList.add('dropdown-hidden', 'dropdown-remove');
            self.$content?.removeEventListener('hide-dropdown', this._boundHide!);
            self.$formula?.dispatchEvent(new CustomEvent('editor:closing'));
            self.$formula?.setAttribute('aria-expanded', 'false');
            self.$formula?.removeEventListener('keydown', self._onFormulaKeyDown);

            self.$formula = null;
            self.$anchor = null;
            self._shown = false;
            self._waiting = false;

            if (this._resolve) {
                this._resolve();
                this._resolve = null;
            }

            // hide() can be triggered without the loop deactivating itself first
            // (selecting an item, clicking outside, scrolling away) as well as
            // after it (Escape, focus moving outside). Deactivating here only
            // when still active keeps the interactionManager's bookkeeping in
            // sync in the first case, and is a no-op (guarded by loop state) in
            // the second, avoiding recursion through the 'deactivate' listener
            // below. 'programmatic' also lets focus pass back to the exit
            // selector (the control that opened the dropdown).
            if (self.loop.state === 'active')
                self.loop.deactivate({ source: 'programmatic' });
        }

        self._inTools = false;
    }

    get formula() {
        return this.$formula;
    }

    get inTools() {
        return this._inTools;
    }

    get isVisible() {
        return this._shown;
    }

    get content() {
        return this.$content;
    }

    public enter() {
        this.loop.activate({ withMouse: false, exitSelector: this.$formula! });
    }

    public hasFocus(relatedTarget: Element | null = document.activeElement): boolean {
        return !!relatedTarget && (this.contains(relatedTarget) || this === relatedTarget);
    }
}

customElements.define('jmv-dropdown', Dropdown);

const dropdownInstance = new Dropdown();

document.body.append(dropdownInstance);

export default {
    init: () => {},
    show: (formula: HTMLElement, content: DropdownContent, wait = false, host?: HTMLElement, anchor?: HTMLElement) => dropdownInstance.show(formula, content, wait, host, anchor),
    hide: () => dropdownInstance.hide({ data: { dropdown: dropdownInstance, check: false } }),
    updatePosition: () => dropdownInstance['_findPosition'](),
    focusedOn: () => dropdownInstance.formula,
    clicked: () => dropdownInstance.inTools,
    isVisible: () => dropdownInstance.isVisible,
    content: () => dropdownInstance.content,
    enter: () => dropdownInstance.enter(),
    hasFocus: (relatedTarget?: Element | null) => dropdownInstance.hasFocus(relatedTarget ?? null)
};
