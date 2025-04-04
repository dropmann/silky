import './refs';
import b64 from '../../../common/utils/b64';
import focusLoop from '../../../common/focusloop';
import { AnalysisContext, ItemContext, Selectable, Locked }  from '../editorcontext';
import { ReferenceNumbers } from './refs';

export abstract class AnalysisElement extends ItemContext {
    __data: any;
    __errorMsgId: string;
    errorPlacement: HTMLElement;
    addIndex: number;
    refs: ReferenceNumbers;
    ready: Promise<void>;
    _context: AnalysisContext;
    _contents: HTMLElement;

    constructor(data: any, nodeKey: string) {
        super(nodeKey);

        this.render = this.render.bind(this);

        this.addFeatures(new Selectable(this));
        this.addFeatures(new Locked(this));

        this.__data = data;

        this.innerHTML = `<style>${this._css()}</style>`;
        this._root.innerHTML = `<style>${this._css()}</style><div class="contents"></div>`;
        this._contents = this._root.querySelector('.contents');

        this.classList.add('jmv-results-item');
        this.__errorMsgId = focusLoop.getNextAriaElementId('errormsg');
        this.setAttribute('aria-errormessage', this.__errorMsgId);
        this.setAttribute('data-name', b64.enc(this.__data.name));

        this.errorPlacement = document.createElement('div');
        this.errorPlacement.setAttribute('id', this.__errorMsgId);
        this.errorPlacement.classList.add('jmv-results-error-placement');
        this.append(this.errorPlacement);
        this.addIndex = 1;

        this.refs = document.createElement('jmv-reference-numbers') as ReferenceNumbers;
        this.refs.inert = true;
        this.appendChild(this.refs);

        this.ready = Promise.resolve();

        
    }

    public abstract get type();

    protected onConnected(): void {

        if (this.parent instanceof AnalysisContext)
            this._context = this.parent;
        else
            throw 'Must be child of AnalysisContext';

        super.onConnected();  //must be called after this._context is assigned

        this.refs.setTable(this._context.refTable);
        this.refs.setRefs(this.__data.refs);

        this.render();
    }

    append(child) {
        this._contents.append(child);
    }

    appendChild(child) {
        return this._contents.appendChild(child);
    }

    abstract _css(): string;

    render() {
        let error = this.__data.error;
        if (error !== null) {
            if (this.classList.contains('jmv-results-error')) {
                let msgElement = this.errorPlacement.querySelector('.jmv-results-error-message');
                if (msgElement)
                    msgElement.textContent = error.message;
            }
            else {
                this.classList.add('jmv-results-error');

                let errorBox = document.createElement('div');
                errorBox.classList.add('error-box');

                let icon = document.createElement('div');
                icon.classList.add('icon');
                errorBox.append(icon);

                let msg = document.createElement('div');
                msg.classList.add('jmv-results-error-message');
                msg.textContent = error.message;
                errorBox.append(msg);

                this.append(errorBox);
            }
            this.setAttribute('aria-invalid', 'true');
        }
        else {
            this.classList.remove('jmv-results-error');
            this.errorPlacement.innerHTML = '';
            this.removeAttribute('aria-invalid');
        }
    }
}