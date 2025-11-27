import Instance from "../instance";
import { HTMLElementCreator as HTML } from '../../common/htmlelementcreator';

export default class TOCPanel extends HTMLElement {
    shadow: ShadowRoot;

    constructor(private model: Instance) {
        super();

        this.shadow = this.attachShadow({ mode: "open" });

        const style = document.createElement("style");
        style.textContent = this.css();
        this.shadow.appendChild(style);

        const analyses = this.model.analyses();
        analyses.on('analysisCreated', this.updateAnalysesList, this);
        analyses.on('analysisDeleted', this.updateAnalysesList, this);

        model.on('change:selectedAnalysis', this._selectedChanged, this);

        this.shadow.append(HTML.parse(`
            <div id="contents">
            <nav id="currentanalyses" class="toc"></nav>
            </div>`
        ));
    }

    updateAnalysesList() {
        let currentAnalyses = this.shadow.querySelector('#currentanalyses');
        let list = '';
        const analyses = this.model.analyses();
        for (let analysis of analyses) {
            if (analysis.name !== 'empty') {
                let rhtml = '';
                if (analysis.results !== null) {
                    rhtml = this.getItem(analysis.results);
                }
                list += rhtml;
            }
        }
        this.shadow.querySelector('#currentanalyses').innerHTML = list;
    }

    _selectedChanged() {
        let selected = this.model.get('selectedAnalysis')
        this.updateAnalysesList();
    }

    getItem(obj: any, level: number = 0) {
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
                    c += this.getItem(child, level+1);
            }
            if (c !== '') {
                r = `<details open data-level="${level}">
                        <summary>${title}</summary>
                        ${c}
                    </details>`;
            }
        }
        else {
            if (obj.name !== 'syntax')
                r = `<a href="#topic-${obj.name}">${typeLabel} - ${title || obj.name}</a><br>`
        }

        if (level === 0)
            r = `<div class="top-item">${r}</div>`;

        return r;
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

            .top-item {
  background: var(--toc-bg, #f8f9fa);
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  padding: 1em 2em 1em 1em;
  right: 0;
  position: relative;
  margin-bottom: 20px;
            }

.toc {
  font-family: system-ui, sans-serif;

  line-height: 1.7;
}

.toc details[data-level='0'] > summary {
  font-size: 120%;
  font-weight: bold;
}

.toc details {
  padding: 0.4em 0;
  padding-left: 0.5em;
}

.toc summary {
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  position: relative;
  padding-left: 1.2em;
}

.toc summary::marker {
  display: none; /* hide default marker */
}

.toc summary::before {
  content: "▸";
  position: absolute;
  left: 0;
  transition: transform 0.2s ease;
}

.toc details[open] > summary::before {
  transform: rotate(90deg);
}

.toc a {
  color: var(--toc-link, #0366d6);
  text-decoration: none;
  margin-inline-start: 15px;
}

.toc a:hover {
  text-decoration: underline;
}

.toc details details {
  margin-left: 1em; /* nested indentation */
  border-left: 1px solid #ddd;
  padding-left: 0.7em;
}

        
        `;
    }
}

customElements.define('jmv-tocpanel', TOCPanel);