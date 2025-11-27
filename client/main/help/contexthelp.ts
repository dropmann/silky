
import { HTMLElementCreator as HTML } from '../../common/htmlelementcreator';
import { Analysis } from '../analyses';


export default class ContextHelp extends HTMLElement {
    shadow: ShadowRoot;

    constructor() {
        super();

        this.shadow = this.attachShadow({ mode: "open" });

        const style = document.createElement("style");
        style.textContent = this.css();
        this.shadow.appendChild(style);

        this.shadow.append(HTML.parse(`
            <div id="contents">
                <h1></h1>
                <details open>
                    <summary>Description</summary>
                    <p>The Analysis of Variance (ANOVA) is used to explore the relationship between a continuous dependent variable, and one or more categorical explanatory variables.\n\n
ANOVA assumes that the residuals are normally distributed, and that the variances of all groups are equal. If one is unwilling to assume that the variances are equal, then a Welch's test can be used instead (However, the Welch's test does not support more than one explanatory factor). Alternatively, if one is unwilling to assume that the data is normally distributed, a non-parametric approach (such as Kruskal-Wallis) can be used.</p>
                </details>
                <!--<details id="analysis-help-results">
                    <summary>Results</summary>
                    <div></div>
                </details>-->
                <details id="analysis-help-options" open>
                    <summary>Options</summary>
                    <dl>
                    </dl>
                </details>
            </div>`));
    }

    css() {
        return `

            :host {
                position: absolute;
                bottom: 0px;
                top: 0%;
                left: 0px;
                right: 0%;
                background-color: #ffffff;
                transition: 0.2s all;
                padding: 0 20px;
                visibility: visible;
                overflow: auto;
                z-index: 1000;
            }

            :host(.hidden) {
                top: 100%;
                visibility: hidden;
            }


            #contents {
                margin: 10px 10px;
            }

            #contents details summary {
                font-size: 120%;
                font-weight: bold;
            }

            p { 
                line-height: 1.5;
            }

            h1 {
                color: #3E6DA9;
                font-size: 140%;
            }

            details {
                padding: 10px;
            }

            details > div {
                margin-top: 0.8em;
            }

            dl {
                margin: 0;
            }

            dt {
                font-weight: 600;
                color: #3e6da9;
                margin-top: 1.5em;
                margin-bottom: 0.5em;
            }

            dd {
                margin: 0.2em 0 1.5em 1.2em;
                color: #333;
                line-height: 1.4;
            }

            .option-desc:not(:first-of-type) {
                border-top: 1px solid rgba(62, 109, 169, 0.1);
                /*padding-top: 1.5em;*/
            }

            .result-item-desc:not(:first-of-type) {
                border-top: 1px solid rgba(62, 109, 169, 0.1);
                /*padding-top: 1.5em;*/
            }

            
        `;
    }

    getItem(obj: any) {
        let r = '';
        let type = obj.type;

        let typeLabel = '';
        switch (type) {
            case 'table':
                typeLabel = 'Table';
                break;
            case 'image':
                typeLabel = 'Image';
                break;
            case 'notice':
                typeLabel = 'Notice';
                break;
            case 'outputs':
                typeLabel = 'Output Variable';
                break;
            default:
                typeLabel = 'Item';
                break;
        }

        let data = obj[type];
        let title = obj.title;

        if (type === 'group' || type === 'array') {
            let c = '';
            for (let child of Object.values(data.elements)) {
                if (child.visible === 0)
                    c += this.getItem(child);
            }
            if (c !== '') {
                r = `<details>
                        <summary>${title}</summary>
                        <div>This is the description of ${title}</div>
                        <dl>
                        ${c}
                        </dl>
                    </details>`;
            }
        }
        else {
            r = `
            <div class="result-item-desc" data-name="${obj.name}" role="presentation">
                <dt>${typeLabel} - ${title}</dt>
                <dd>This is the description of  item ${title}</dd>
            </div>`
        }

        return r;
    }

    updateContents(analysis: Analysis) {
        this.shadow.querySelector('h1').innerText = analysis.results.title;

        /*let rhtml = '';
        if (analysis.results !== null) {
            rhtml = this.getItem(analysis.results);
        }
        this.shadow.querySelector('#analysis-help-results > div').innerHTML = rhtml;*/

        let html = '';
        if (analysis.options !== null) {
            for (let option of analysis.options) {
                let template = option._template;
                if (template.description && template.description.ui) {
                    html += `
                    <div class="option-desc" data-name="${template.name}" role="presentation">
                        <dt>${template.title}</dt>
                        <dd>${template.description.ui}</dd>
                    </div>`;
                }
            }
        }

        this.shadow.querySelector('#analysis-help-options > dl').innerHTML = html;

    }

    hide() {
        this.classList.add('hidden');
    }

    show(analysis: Analysis) {
        this.updateContents(analysis);
        this.classList.remove('hidden');
        this.scrollTop = 0;
    }
}

customElements.define('jmv-contexthelp', ContextHelp);