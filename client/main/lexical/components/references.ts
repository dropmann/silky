
'use strict';
import { ResultsContext } from '../editorcontext';
import focusLoop from '../../../common/focusloop';

export interface RefDef {
    name: string,
    type: string,
    authors: any,
    year: number,
    title: string,
    publisher: string,
    url: string,
    pages?: string,
    volume?: string,
    issue?: string,
    year2?: number,
    extra?: string
}

export interface ResolvedRefDef {
    addresses: Array<{ module: string, name: string }>,
    text: string,
    url: string,
}

export interface NsRefDef {
    ns: string,
    references: Array<RefDef>
}

export class References extends HTMLElement {
    _root: ShadowRoot;
    _modules: Set<string>;
    _refs: Array<ResolvedRefDef>;
    _body: HTMLElement;
    _numbers: { [index: string]: { [index: string]: number } };
    _context: ResultsContext;

    constructor() {
        super();

        this._refs = [];
        this._modules = new Set<string>();
        this._numbers = null;

        this._root = this.attachShadow({ mode: 'open' });

        let labelId = focusLoop.getNextAriaElementId('label');

        let style = document.createElement('style');
        style.textContent = this._css();
        this._root.appendChild(style);

        this._root.host.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.altKey && event.code === 'ArrowDown') {
                focusLoop.enterFocusLoop(this._body, { withMouse: false });
            }
        });

        let heading = document.createElement('h1');
        heading.textContent = _('References');
        heading.setAttribute('id', labelId);

        this._body = document.createElement('div');
        this._body.className += ' body';
        this._body.setAttribute('role', 'list');
        this._body.setAttribute('aria-labelledby', labelId);

        this._root.appendChild(heading);
        this._root.appendChild(this._body);

        focusLoop.addFocusLoop(this._body, { level: 1 });
    }

    getAllNumbers(): { [index: string]: { [index: string]: number } } {
        if (!this._numbers) {
            let numbers: { [index: string]: { [index: string]: number } } = { jmv: {}, R: {} };
            for (let module of this._modules)
                numbers[module] = {};
            for (let i = 0; i < this._refs.length; i++) {
                let ref = this._refs[i];
                for (let address of ref.addresses)
                    numbers[address.module][address.name] = (i + 1);
            }
            this._numbers = numbers;
        }

        return this._numbers;
    }

    getNumbers(ns: string): { [index: string]: number } {
        let numbers = this.getAllNumbers();
        let nums = numbers[ns];
        if (nums === undefined)
            return {};
        else
            return nums;
    }

    setRootContext(context: ResultsContext) {
        this._context = context;

        this._context.addEventListener('analysesChanged', () => {
            this._checkForChanges();
        });
        this._checkForChanges();
    }

    _checkForChanges() {
        let oldNumbers = this.getAllNumbers();
        const analysisNodes = this._context.getAllAnalysisNodes();

        this._update(analysisNodes);
        let newNumbers = this.getAllNumbers();

        let modulesWithRefChanges = [];
        for (let name in oldNumbers) {
            if ( ! this.deepCompare(newNumbers[name], oldNumbers[name]))
                modulesWithRefChanges.push(name);
        }

        if (modulesWithRefChanges.length > 0) {
            const event = new CustomEvent("refChanged", { detail: modulesWithRefChanges });
            this.dispatchEvent(event);
        }
    }

    deepCompare(obj1: any, obj2: any): boolean {
        // If objects are not the same type, return false
        if (typeof obj1 !== typeof obj2) {
            return false;
        }
        // If objects are both null or undefined, return true
        if (obj1 === null && obj2 === null) {
            return true;
        }
        // If objects are both primitive types, compare them directly
        if (typeof obj1 !== 'object') {
            return obj1 === obj2;
        }
        // If objects are arrays, compare their elements recursively
        if (Array.isArray(obj1) && Array.isArray(obj2)) {
            if (obj1.length !== obj2.length) {
                return false;
            }
            for (let i = 0; i < obj1.length; i++) {
                if (!this.deepCompare(obj1[i], obj2[i])) {
                    return false;
                }
            }
            return true;
        }
        // If objects are both objects, compare their properties recursively
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        if (keys1.length !== keys2.length) {
            return false;
        }
        for (let key of keys1) {
            if (!obj2.hasOwnProperty(key) || !this.deepCompare(obj1[key], obj2[key])) {
                return false;
            }
        }
        return true;
    }

    n() {
        return this._refs.length;
    }

    activate() {
        this._root.host.classList.add('activated');
    }

    deactivate() {
        this._root.host.classList.remove('activated');
    }

    select() {
        this._body.classList.add('selected');
    }

    deselect() {
        this._body.classList.remove('selected');
        this.clearSelection();
    }

    nSelected() {
        let refElems = [...this._body.querySelectorAll('jmv-reference')] as Array<Reference>;
        let n = refElems.reduce((count, elem) => count + (elem.selected ? 1 : 0), 0);
        return n;
    }

    selectAll() {
        let refElems = this._body.querySelectorAll('jmv-reference') as NodeListOf<Reference>;
        for (let elem of refElems)
            elem.select();
    }

    clearSelection() {
        let refElems = this._body.querySelectorAll('jmv-reference') as NodeListOf<Reference>;
        for (let elem of refElems)
            elem.unselect();
    }

    asHTML() {
        let noneSelected = (this.nSelected() === 0);
        let pieces = [];
        let refElems = this._body.querySelectorAll('jmv-reference') as NodeListOf<Reference>;
        for (let elem of refElems) {
            if (noneSelected || elem.selected)
                pieces.push(elem.asHTML());
        }
        return `<p>${pieces.join('</p><p>')}</p>`;
    }

    asText() {
        let noneSelected = (this.nSelected() === 0);
        let pieces = [];
        let refElems = this._body.querySelectorAll('jmv-reference') as NodeListOf<Reference>;
        for (let elem of refElems) {
            if (noneSelected || elem.selected)
                pieces.push(elem.asText());
        }
        return pieces.join('\n');
    }

    private _update(analyses: Array<NsRefDef>) {

        let refs: Array<ResolvedRefDef> = [];
        let modules = new Set<string>();

        refs.push(this.resolve('jmv', {
            name: 'jamovi',
            type: 'software',
            authors: { complete: 'The jamovi project' },
            year: 2024,
            title: 'jamovi',
            publisher: '(Version 2.6) [Computer Software]. Retrieved from https://www.jamovi.org',
            url: 'https://www.jamovi.org'
        }));

        const R: RefDef = {
            name: 'R',
            type: 'software',
            authors: { complete: 'R Core Team' },
            year: 2024,
            title: 'R: A Language and environment for statistical computing',
            publisher: '(Version 4.4) [Computer software]. Retrieved from https://cran.r-project.org',
            url: 'https://cran.r-project.org',
            extra: 'R packages retrieved from CRAN snapshot 2024-08-07'
        };

        refs.push(this.resolve('R', R));

        for (let analysis of analyses) {
            modules.add(analysis.ns);
            for (let ref of analysis.references) {
                if (ref.name === 'R')
                    // keep all R refs in sync
                    refs.push(this.resolve(analysis.ns, R));
                else
                    refs.push(this.resolve(analysis.ns, ref));
            }
        }

        for (let i = 0; i < refs.length - 1; i++) {
            let r1 = refs[i];
            if (r1 === null)
                continue;
            for (let j = i + 1; j < refs.length; j++) {
                let r2 = refs[j];
                if (r2 === null)
                    continue;
                if (r1.text === r2.text) {
                    r1.addresses.push(...r2.addresses);
                    refs[j] = null;
                }
            }
            r1.addresses = [...new Set(r1.addresses)];
        }

        refs = refs.filter((x) => x !== null);

        let refElemets = this._body.querySelectorAll('jmv-reference') as NodeListOf<Reference>;
        refElemets.forEach((refElement) => {
            refElement.removeEventListener('keydown', this.refKeyDown);
        });

        this._body.innerHTML = '';

        let firstRef = null;
        for (let i = 0; i < refs.length; i++) {
            let ref = refs[i];
            let el = document.createElement('jmv-reference') as Reference;
            el.setup(i + 1, ref.text);
            el.setAttribute('role', 'listitem');
            el.setAttribute('tabindex', '0');
            el.addEventListener('keydown', this.refKeyDown);
            if (!firstRef)
                firstRef = el;
            this._body.appendChild(el);
        }

        this._refs = refs;
        this._modules = modules;
        this._numbers = null;
    }

    refKeyDown(event) {
        if (event.code === 'Space')
            event.target.setSelected(!event.target.selected);
    }

    resolve(moduleName: string, ref: RefDef): ResolvedRefDef {

        // the proto addresses changed
        if (ref.authors === null || typeof (ref.authors) !== 'object')
            return {
                addresses: [{ module: moduleName, name: ref.name }],
                text: '',
                url: ref.url,
            };

        let pub = ref.publisher;
        if (pub.endsWith(ref.url)) {
            let noUrl = pub.substring(0, pub.length - ref.url.length);
            pub = `${noUrl}<a href="${ref.url}" target="_blank">${ref.url}</a>`;
        }
        else if (ref.url) {
            pub = `${pub}. <a href="${ref.url}" target="_blank">link</a>`;
        }

        let text;

        let year = ref.year2;
        if (!year)
            year = ref.year;

        if (ref.type === 'article') {
            let volume = '';
            let pages = '';
            let issue = '';
            if (ref.volume)
                volume = `, ${ref.volume}`;
            if (ref.issue)
                issue = `(${ref.issue})`;
            if (ref.pages)
                pages = `, ${ref.pages}`;

            text = `${ref.authors.complete} (${year}). ${ref.title}. <em>${pub}${volume}</em>${issue}${pages}.`;
        }
        else {
            text = `${ref.authors.complete} (${year}). <em>${ref.title}</em>. ${pub}.`;
        }

        if (ref.extra)
            text += ` (${ref.extra}).`;

        return {
            addresses: [{ module: moduleName, name: ref.name }],
            text: text,
            url: ref.url,
        };
    }

    _css() {
        return `
            :host {
                display: block ;
                padding: 8px 12px ;
            }

            :host[data-selected] {
                background-color: red ;
            }

            .body jmv-reference {
                --checkbox-opacity: 0 ;
            }

            .body.selected jmv-reference {
                --checkbox-opacity: 1 ;
            }

            div > * {
                margin-top: 4px ;
            }

            h1 {
                font-size: 160%;
                color: #3E6DA9;
                white-space: nowrap;
                font-weight: bold ;
            }
        `;
    }
}

export class Reference extends HTMLElement {
    _root: ShadowRoot;
    selected: boolean;
    _cont: HTMLElement;
    _checkbox: HTMLInputElement;
    _text: HTMLElement;
    _number: HTMLElement;

    constructor() {
        super();

        this.selected = false;

        this._root = this.attachShadow({ mode: 'open' });

        this._root.innerHTML = `
            <style>
                :host {
                    display: block ;
                }

                .body {
                    padding: 2px ;
                    border: 2px solid transparent ;
                    display: grid ;
                    grid-template-columns: auto auto 1fr ;
                }

                .body[data-checked='1'] {
                    background-color: #B5CAEF ;
                    border: 2px solid #8BA4D6;
                }

                input {
                    margin-right: 6px ;
                    opacity: var(--checkbox-opacity, 1);
                    transition: opacity .3s ;
                }

                span.num {
                    font-weight: bold ;
                    margin-right: 6px ;
                    line-height: 150% ;
                }

                span.ref {
                    line-height: 150% ;
                }
            </style>
            <p class="body">
                <input type="checkbox">
                <span class="num"></span>
                <span class="ref"></span>
            </p>
        `;

        this._cont = this._root.querySelector('.body');
        this._checkbox = this._root.querySelector('input');
        this._text = this._root.querySelector('span.ref');
        this._number = this._root.querySelector('span.num');

        this._checkbox.addEventListener('change', () => {
            this.setSelected(this._checkbox.checked);
        });
    }

    setup(number, text) {
        this._number.textContent = `[${number}]`;
        this._text.textContent = text;
        text = this._text.innerHTML;
        text = text.replace(/&lt;em&gt;/g, '<em>');
        text = text.replace(/&lt;\/em&gt;/g, '</em>');
        text = text.replace(/&lt;a (.*)&gt;(.*)&lt;\/a&gt;/g, '<a $1>$2</a>');
        this._text.innerHTML = text;
    }

    asHTML() {
        return this._text.innerHTML;
    }

    asText() {
        return this._text.textContent;
    }

    select() {
        this.setSelected(true);
    }

    unselect() {
        this.setSelected(false);
    }

    setSelected(selected) {
        this.selected = selected;
        this._checkbox.checked = selected;
        this._cont.dataset.checked = (selected ? '1' : '0');
    }
}

customElements.define('jmv-references', References);
customElements.define('jmv-reference', Reference);
