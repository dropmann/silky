'use strict';

const $ = require('jquery');
import { GridControl } from './gridcontrol';
const RequestDataSupport = require('./requestdatasupport');

export class CustomControl extends GridControl {
    constructor(params) {
        super(params);

        RequestDataSupport.extendTo(this);

        this.$el = $('<div class="silky-custom-control silky-control-margin-' + this.getPropertyValue("margin") + '"></div>');
        this.timeoutId = null;
    }

    update() {
        this.trigger('update');
    }

    onDisposed() {
        if (this.observer)
            this.observer.disconnect();
    }

    onLoaded() {
        this.observer = new MutationObserver( (mutations) => {
            if (this.timeoutId === null) {
                this.timeoutId = setTimeout(() => {
                    this.timeoutId = null;
                    this.$el.trigger("contentchanged");
                }, 0);
            }
        } );

        this.observer.observe(this.$el[0], { attributes: true, childList: true, attributeOldValue: true });
    }

    onDataChanged(data) {
        if (data.dataType !== 'columns')
            return;

        if (data.dataInfo.nameChanged || data.dataInfo.measureTypeChanged || data.dataInfo.dataTypeChanged || data.dataInfo.countChanged)
            this.update();
    }
}

export default CustomControl;
