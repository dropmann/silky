'use strict';

import { translateFunction, translateNFunction } from '../common/i18n';
import { CtrlDef } from './optionsview';
import {  PropertySupplier } from './propertysupplier';

type I18nSource = { translate: translateFunction, translateN: translateNFunction };

class I18nController {
    source: I18nSource = null;

    setSource(source: I18nSource) {
        this.source = source;
    }

    translate(key: string, formats?: string | (string | number)[] | { [key: string]: string | number }, options?: { prefix: string, postfix: string }) : string {
        if (this.source === null)
            return key;

        return this.source.translate(key, formats, options);
    }

    translateN(key: string, plural: string, count: number, formats?: { [key: string]: (string|number), n?: (string|number) }) : string {
        if (this.source === null)
            return key;

        return this.source.translateN(key, plural, count, formats);
    }
}

export class I18nSupport<P extends CtrlDef> extends PropertySupplier<P> {
        
    _i18nSource: I18nSource;
    private i18n: I18nController;
    
    constructor(params: P) {
        super(params)

        this.i18n = new I18nController();
        this._i18nSource = null;
    }

    onI18nChanged?(): void;

    setI18nSource(supplier: I18nSource) {
        this.i18n.setSource(supplier);
        this._i18nSource = supplier;
        if (this.onI18nChanged)
            this.onI18nChanged();
    }

    translate(key: string, formats?: string | (string | number)[] | { [key: string]: string | number }, options?: { prefix: string, postfix: string }) : string {
        return this.i18n.translate(key, formats, options);
    }

    translateN(key: string, plural: string, count: number, formats?: { [key: string]: (string|number), n?: (string|number) }) : string {
        return this.i18n.translateN(key, plural, count, formats);
    }
}

export default I18nSupport;
