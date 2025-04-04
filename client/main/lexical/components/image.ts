
import { AnalysisElement } from './element';
import focusLoop from '../../../common/focusloop';
import { EditorContext }  from '../editorcontext';


export class Image extends AnalysisElement {
    __image: HTMLElement;
    __title: HTMLElement;
    __status: HTMLElement;

    constructor(data: any, nodeKey: string) {
        super(data, nodeKey);

        this.classList.add('jmv-results-image');

        let imageId = focusLoop.getNextAriaElementId('image');
        this.setAttribute('role', 'img');
        this.setAttribute('aria-labelledby', imageId);

        let statusElement = document.createElement('div');
        statusElement.classList.add(`jmv-results-image-status-indicator`);
        this.appendChild(statusElement);
        this.__status = statusElement;

        let titleElement = document.createElement(`h3`);
        titleElement.setAttribute('id', imageId);
        titleElement.classList.add(`jmv-results-image-title`);
        this.appendChild(titleElement);
        this.__title = titleElement;

        let imageElement = document.createElement('div');
        imageElement.classList.add(`jmv-results-image-image`);
        this.appendChild(imageElement);
        this.__image = imageElement;

        //this.render();
    }

    public get type() {
        return 'image';
    }

    _css() {
        return `
          .jmv-results-image {
            position: relative ;
        }

        .jmv-results-image-status-indicator {
            position: absolute ;
            left: 50% ;
            top: 50% ;
            margin-left: -20px ;
            margin-top: -20px ;
            width: 40px ;
            height: 40px ;
            background-image: url('../assets/indicator-running.svg');
            background-size: 100% ;
            display: none ;
        }

        .jmv-results-image[data-status="inited"] .jmv-results-image-status-indicator,
        .jmv-results-image[data-status="running"] .jmv-results-image-status-indicator {
            display: block ;
        }

        .jmv-results-array > .jmv-results-array-container > .jmv-results-image {
            margin-top: 0 ;
        }`;
    }

    render() {
        super.render();

        if (this.__title) {
            if (this.__data.title) {
                this.__title.innerText = this.__data.title;
                this.__title.classList.remove('hidded');
            }
            else {
                this.__title.innerHTML = '';
                this.__title.classList.add('hidded');
            }
        }

        if (this.__data.status === 1)
            this.setAttribute('data-status', 'inited');
        else if (this.__data.status === 2)
            this.setAttribute('data-status', 'running');
        else if (this.__data.status === 5)
            this.setAttribute('data-status', 'running');
        else
            this.removeAttribute('data-status');

        let image = this.__data.image;

        let backgroundImage = 'none';
        if (image.path) {
            let url = 'res/' + image.path;
            url = url.replace(/\"/g, '&quot;');
            backgroundImage = "url('" + url + "')";
        }

        this.__image.style.backgroundImage = backgroundImage;
        this.__image.style.width = image.width + 'px';
        this.__image.style.height = image.height + 'px',
        this.__image.style.backgroundSize = image.width + 'px'
    }

}

customElements.define('analysis-image', Image);