import { HTMLElementCreator as HTML } from '../../common/htmlelementcreator';
import { Analysis } from '../analyses';
import Instance from '../instance';
import ContextHelp from './contexthelp';
import TOCPanel from './toc';
export default class HelpPanel extends HTMLElement {
    shadow: ShadowRoot;
    contextHelp: ContextHelp
    contents: HTMLElement;
    dir: string;
    contextHidden: boolean = true;
    hideButton: HTMLButtonElement;
    assitantButton: HTMLButtonElement;
    tocButton: HTMLButtonElement;
    tocPanel: TOCPanel;

    mode: 'toc' | 'assistant' = 'assistant';


    constructor(private model: Instance) {
        super();

        this.hideContextHelp = this.hideContextHelp.bind(this);

        this.dir = window.getComputedStyle(document.body).direction;
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
                <div class="heading"><button class="tab hide"><div></div></button><h1 class="title">Assistant</h1></div>

                <!--<div class="tabs">
                    <button class="tab summary">Summary</button>
                    <button class="tab toc">Table of contents</button>
                    <button class="tab assistant selected">Assistant</button>
                </div>-->
                
                <div class="baseContent">

                <div class="defaultContent assistant panel-item selected">
                <p class="welcome"> Welcome to jamovi assistant. Here you can find the help you need to get you work done quickly and efficently.</p>
                <label>Search <input type="text"></label>

<section aria-labelledby="current-results">
  <h2 id="current-results">Current Results</h2>
  <ul id="currentanalyses">
  </ul>
</section>

<section aria-labelledby="help-topics">
  <h2 id="help-topics">Help Topics</h2>
  <ul>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#data-help">Data Setup</a></li>
    <li><a href="#data-analyses">Performing Analyses</a></li>
    <li><a href="#data-results">Understanding Results</a></li>
    <li><a href="#data-library">Installing/Managing Modules</a></li>
    <li><a href="#troubleshooting">Troubleshooting</a></li>
  </ul>
</section>

<section aria-labelledby="feature-help">
  <h2 id="feature-help">Feature Help</h2>
  <dl>
    <dt>Dark Mode</dt>
    <dd>Switches the interface to a darker color palette for low-light environments.</dd>

    <dt>Auto-Save</dt>
    <dd>Automatically saves your work every 30 seconds to prevent data loss.</dd>

    <dt>Export</dt>
    <dd>Download your project as a CSV, PDF, or JSON file.</dd>
  </dl>
</section>

<section aria-labelledby="setup-guide">
  <h2 id="setup-guide">Setting Up Your Account</h2>
  <ol>
    <li>Click “Sign Up” on the homepage.</li>
    <li>Enter your email and password.</li>
    <li>Check your inbox for the confirmation email.</li>
    <li>Click the confirmation link to activate your account.</li>
  </ol>
</section>

<section aria-labelledby="faq">
  <h2 id="faq">Frequently Asked Questions</h2>

  <details>
    <summary>How do I reset my password?</summary>
    <p>Go to Settings → Account → Reset Password, then follow the instructions in your email.</p>
  </details>

  <details>
    <summary>Why can't I log in?</summary>
    <p>Ensure your caps lock is off and you’re using the correct email. If issues persist, try resetting your password.</p>
  </details>
</section>
</div>
</div>


            </div>`
        ));

        this.contextHelp = new ContextHelp();
        this.contextHelp.id = 'contextHelp';
        this.contextHelp.classList.add('hidden', 'panel-item');
        this.shadow.querySelector('.baseContent').prepend(this.contextHelp);

        this.tocPanel = new TOCPanel(model);
        this.tocPanel.id = 'tocPanel';
        this.tocPanel.classList.add('hidden', 'panel-item', 'toc');
        this.shadow.querySelector('.baseContent').prepend(this.tocPanel);

        this.contents = this.shadow.querySelector('#contents');
        this.contents.dir = this.dir;
        this.contents.addEventListener('click', (e) => { 
            if (e.target !== this.contextHelp)
                this.hideContextHelp();
        });

        this.contextHelp.addEventListener('mouseenter', (e: MouseEvent) => {
            this.contents.classList.add('over-context-help');
        });

        this.contextHelp.addEventListener('mouseleave', (e: MouseEvent) => {
            this.contents.classList.remove('over-context-help');
        });

        this.hideButton = this.shadow.querySelector('.hide');
        this.hideButton.addEventListener('click', (e: MouseEvent) => {
            if (this.contextHidden) {
                this.dispatchEvent(new CustomEvent('assistant-closed', { bubbles: true }));
            }
        });

        /*this.assitantButton = this.shadow.querySelector('.tab.assistant');
        this.assitantButton.addEventListener('click', (e: MouseEvent) => {
            this.selectMode('assistant');
        });

        this.tocButton = this.shadow.querySelector('.tab.toc');
        this.tocButton.addEventListener('click', (e: MouseEvent) => {
            this.selectMode('toc');
        });*/
    }

    public selectMode(mode: 'toc' | 'assistant') {
        if (this.mode !== mode ) {
            this.mode = mode;
            if (mode !== 'assistant')
                this.hideContextHelp();
            /*this.shadow.querySelectorAll('.tab.selected').forEach(el => el.classList.remove('selected'));
            this.shadow.querySelector(`.tab.${mode}`).classList.add('selected');*/
            this.shadow.querySelectorAll('.panel-item.selected').forEach(el => el.classList.remove('selected'));
            this.shadow.querySelector(`.panel-item.${mode}`).classList.add('selected');
            let title: string = mode;
            switch (mode) {
                case 'toc':
                    title = 'Table of Contents';
                    break;
                case 'assistant':
                    title = 'Assistant';
                    break;
            }
            this.shadow.querySelector(`.title`).innerHTML = title;
        }
    }

    hideContextHelp() {
        this.hideButton.classList.remove('selected');
        this.contents.classList.remove('hidden');
        this.contextHelp.hide();
        this.contextHidden = true;
    }

    showContextHelp(analysis: Analysis) {
        this.hideButton.classList.add('selected');
        this.contents.classList.add('hidden');
        this.contextHelp.show(analysis);
        this.contextHidden = false;
    }

    _selectedChanged() {
        let selected = this.model.get('selectedAnalysis')
        if (selected instanceof Analysis && this.mode === 'assistant') {
            this.showContextHelp(selected);
        }
        else
            this.hideContextHelp();
    }

    selectTab(tab: string) {

    }

    updateAnalysesList() {
        let currentAnalyses = this.shadow.querySelector('#currentanalyses');
        let list = '';
        const analyses = this.model.analyses();
        for (let analysis of analyses) {
            if (analysis.name !== 'empty')
                list += `<li><a href="#getting-started">${analysis.name}</a></li>`;
        }
        currentAnalyses.innerHTML = list;
    }

    css() {
        return `

            :host {
            /*transform: rotate(-90deg);*/
            }

            .hide {
                display: flex;
                flex-flow: row nowrap;
                align-items: center;
                /*font-size: 15px;*/
                height: 100%;
                width: 60px;
                box-sizing: border-box;
                padding: 0 !important;
                border: none;
                margin-top: 0px !important;

            }

            .tab.selected {
                background-color: #ffffff;
                z-index: 2000;
                color: #3e6da9;
                
            }

            .tab:not(.selected):hover {
                background-color: #ddd;
            }

            .tab {
                border: none;
                background-color: transparent;
                /*font-size: 15px;*/
                padding: 5px 25px;
                min-height: 35px;
                color: #777;
                margin-bottom: 5px;
                transition: 0.2s all;
            }

            .tab.summary {
                grid-column-start: 1;
                grid-column-end: span 1;
            }

            .tab.toc {
                grid-column-start: 2;
                grid-column-end: span 1;
            }

            .tab.assistant {
                grid-column-start: 3;
                grid-column-end: span 1;
            }

            .tab.hide {
                grid-column-start: 1;
                grid-column-end: span 1;
            }

            #contents[dir="ltr"] .hide > div {
                transform: rotate(180deg);
            }

            .title {
                justify-self: start;
            }

            .heading {
                display: grid;
                grid-template-columns: min-content auto;
                grid-column-start: 1;
                grid-column-end: span 3;
                grid-row-start: 1;
                background-color: #f0f0f0;;
            }

            .tabs {
                display: grid;
                grid-template-columns: auto auto auto 1fr auto;
                grid-column-start: 1;
                grid-column-end: span 3;
                grid-row-start: 3;
                background-color: #e6e6e6;
                padding-inline-start: 5px;
            }

            .hide > div {
                flex: 1;
                mask: url('../../assets/action-back.svg') 0 0/25px 25px no-repeat;
                -webkit-mask: url('../../assets/action-back.svg');
                -webkit-mask-repeat: no-repeat;
                -webkit-mask-position: center;
                -webkit-mask-size: 25px;
                min-width: 25px;
                height: 25px;
                background-color: #777;
                transition: 0.2s all;
            }

            :host {
                bottom: 0px;
                top: 0px;
                left: 0px;
                right: 0px;
                position:absolute;
            }

            #contents {
                bottom: 0px;
                top: 0px;
                left: 0px;
                right: 0px;
                position: absolute;
                display: grid;
                grid-template-rows:  auto 1fr auto;
                grid-template-columns: auto 1fr auto;
                background-color: #e0e0e0;
                transition: 0.2s all;
                overflow: hidden;
                align-items: center;
            }

            #contents.hidden:not(.over-context-help):hover {
                background-color: #d7d7d7
            }

            #contents.hidden:not(.over-context-help):hover  > .tabs > h1 {
                color: #6a6a6a;
            }

            #contents.hidden {
                background-color: #e0e0e0;
            }

            #contents[dir="ltr"].hidden .hide > div {
                background-color: #888888 ;
                transform: rotate(270deg);
            }

            #contents.hidden .hide > div {
                background-color: #888888 ;
                transform: rotate(-90deg);
            }

            #contents.hidden > .tabs > h1 {
                color: #ACACAC;
            }

            p { 
                line-height: 1.5;
            }

            p.welcome { 
                margin-top: 0px;
            }

            h1 {
                color: #3E6DA9;
                margin-left: 20px;
                margin-right: 20px;
                font-size: 140%;
                transition: 0.2s color;
            }

            .baseContent {
                position: relative;
                justify-self: stretch;
                grid-column-start: 1;
                grid-column-end: span 3;
                align-self: stretch;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                background-color: #ffffff;
                padding-top: 20px;
                grid-row-start: 2;
            }

            .panel-item {
                margin-top: 20px;
                padding: 0 20px;
                
            }

            .panel-item:not(#contextHelp) {
                visibility: hidden;
                opacity: 0;
            }

            .defaultContent {
                transition: 0.2s all;
                padding: 0px 20px;
                overflow: auto;
                position: absolute;
                top: 0px;
                bottom: 0px;
            }

            .panel-item:not(#contextHelp).selected {
                visibility: visible;
                opacity: 1;
            }
            
        `;
    }
}

customElements.define('jmv-help-panel', HelpPanel);