// vertical-icon-toolbar.ts

const template = document.createElement('template');
import css from "./sidebar.css?raw";
import assistantSVG from "../../assets/sidebar-assistant.svg?raw";
import tocSVG from "../../assets/sidebar-toc.svg?raw";
import summarySVG from "../../assets/sidebar-summary.svg?raw";

const svgIcons = new Map<string, string>();
svgIcons.set('assistant', assistantSVG);
svgIcons.set('toc', tocSVG);
svgIcons.set('summary', summarySVG);

template.innerHTML = `
  <style>
    ${css}
  </style>

  <div class="sidebar" role="toolbar" aria-orientation="vertical" tabindex="0"></div>
`;

type ToolbarItem = {
  id: string; // optional identifier
  label: string; // required accessible label
  iconSVG?: string; // raw SVG string (e.g. '<svg ...>...</svg>')
  selected?: boolean; // optional initial selection
};

export class VerticalIconToolbar extends HTMLElement {
  private root: ShadowRoot;
  private toolbarEl!: HTMLElement;
  private items: ToolbarItem[] = [];
  private buttons: HTMLButtonElement[] = [];

  static get observedAttributes() {
    return []; // extend later if you want attributes like 'compact'
  }

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.root.appendChild(template.content.cloneNode(true));
    this.toolbarEl = this.root.querySelector('.sidebar') as HTMLElement;

    // Keyboard support on the toolbar container (Arrow navigation)
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  connectedCallback() {
    this.toolbarEl.addEventListener('keydown', this.onKeyDown);
    this.toolbarEl.addEventListener('click', this.onClick);
    // Make toolbar focusable as a whole for group keyboard handling
    if (!this.hasAttribute('tabindex')) {
      this.toolbarEl.tabIndex = 0;
    }
    // build any preconfigured items (optional)
    // (none by default)
  }

  disconnectedCallback() {
    this.toolbarEl.removeEventListener('keydown', this.onKeyDown);
    this.toolbarEl.removeEventListener('click', this.onClick);
  }

  /** Public API: add an item to the end of the toolbar */
  addItem(item: ToolbarItem) {
    const index = this.items.length;
    this.items.push(item);
    const btn = this.createButton(item, index);
    this.buttons.push(btn);
    this.toolbarEl.appendChild(btn);
    return btn;
  }

  /** Public API: insert item at index */
  insertItem(index: number, item: ToolbarItem) {
    if (index < 0 || index > this.items.length) index = this.items.length;
    this.items.splice(index, 0, item);
    const btn = this.createButton(item, index);
    this.buttons.splice(index, 0, btn);

    // insert into DOM at the right place
    if (index >= this.toolbarEl.children.length) {
      this.toolbarEl.appendChild(btn);
    } else {
      this.toolbarEl.insertBefore(btn, this.toolbarEl.children.item(index));
    }
    this.reindexButtons();
    return btn;
  }

  /** Public API: remove item by index */
  removeItem(index: number) {
    if (index < 0 || index >= this.items.length) return;
    this.items.splice(index, 1);
    const btn = this.buttons.splice(index, 1)[0];
    btn.remove();
    this.reindexButtons();
  }

  /** Public API: clear all items */
  clear() {
    this.items = [];
    this.buttons.forEach(b => b.remove());
    this.buttons = [];
  }

  /** Programmatically select an item by index (fires event) */
  select(index: number) {
    if (index < 0 || index >= this.buttons.length) return;
    this.buttons.forEach((b, i) => {
      if (i === index) b.setAttribute('selected', 'true');
      else b.removeAttribute('selected');
    });
    const detail = { index, item: this.items[index] };
    this.dispatchEvent(new CustomEvent('toolbar-select', { detail, bubbles: true, composed: true }));
  }

  /** Create a button element for an item */
  private createButton(item: ToolbarItem, index: number) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item';
    btn.setAttribute('aria-label', item.label);
    btn.setAttribute('data-index', String(index));
    btn.setAttribute('data-label', item.label)
    btn.title = item.label;
    btn.tabIndex = -1; // let toolbar container manage focus; buttons become focusable when focused programmatically

    // insert icon via innerHTML (iconSVG expected to be safe SVG markup)
    // NOTE: If you accept user-supplied SVGs from untrusted sources, sanitize them!
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.setAttribute('aria-hidden', 'true');
    let svg = svgIcons.get(item.id);
    if (svg)
        wrapper.innerHTML = svg;
    // append visually hidden label for assistive tech (redundant because of aria-label but harmless)
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = item.label;

    btn.appendChild(wrapper);
    btn.appendChild(sr);

    if (item.selected) {
      btn.setAttribute('selected', 'true');
    }

    // Ensure click triggers selection (handled by toolbar click listener too)
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const idx = Number(btn.getAttribute('data-index'));
      this.select(idx);
      // move keyboard focus to the button
      btn.focus();
    });

    return btn;
  }

  /** update the data-index attributes after insert/remove */
  private reindexButtons() {
    this.buttons.forEach((b, i) => b.setAttribute('data-index', String(i)));
  }

  /** Click handler on toolbar - delegate so outside code can click container */
  private onClick(e: Event) {
    const target = e.target as HTMLElement | null;
    const btn = target?.closest && (target.closest('.item') as HTMLButtonElement | null);
    if (!btn) return;
    const index = Number(btn.getAttribute('data-index'));
    if (Number.isFinite(index)) {
      this.select(index);
    }
  }

  /** Keyboard navigation: ArrowUp, ArrowDown, Home, End, Enter, Space */
  private onKeyDown(e: KeyboardEvent) {
    const key = e.key;
    const focused = this.root.activeElement as HTMLElement | null;
    // find current focused button index (or -1)
    let currentIndex = -1;
    for (let i = 0; i < this.buttons.length; i++) {
      if (this.buttons[i] === focused) { currentIndex = i; break; }
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      const next = (currentIndex === -1) ? 0 : (currentIndex + 1) % this.buttons.length;
      this.focusButton(next);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      const prev = (currentIndex === -1) ? this.buttons.length - 1 : (currentIndex - 1 + this.buttons.length) % this.buttons.length;
      this.focusButton(prev);
    } else if (key === 'Home') {
      e.preventDefault();
      this.focusButton(0);
    } else if (key === 'End') {
      e.preventDefault();
      this.focusButton(this.buttons.length - 1);
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      // If focus is on a button, activate it; otherwise if toolbar container is focused, focus first
      if (currentIndex >= 0) {
        this.select(currentIndex);
      } else if (this.buttons.length > 0) {
        this.focusButton(0);
      }
    }
  }

  /** Focus the button at index and ensure it is keyboard-focusable */
  private focusButton(index: number) {
    if (index < 0 || index >= this.buttons.length) return;
    // set tabindex on all buttons to -1, then 0 on target, then focus
    this.buttons.forEach(b => b.tabIndex = -1);
    const btn = this.buttons[index];
    btn.tabIndex = 0;
    btn.focus();
  }
}

// Define the element once
if (!customElements.get('vertical-icon-toolbar')) {
  customElements.define('vertical-icon-toolbar', VerticalIconToolbar);
}
