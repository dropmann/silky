'use strict';

export function I18nSupport(Base) {
    return class extends Base {
        constructor(...args: any[]) {
            super(args[0])

            this._i18nSource = null;
        }

        setI18nSource(supplier) {
            this._i18nSource = supplier;
            if (this.onI18nChanged)
                this.onI18nChanged();
        }

        translate(key) {
            if (this._i18nSource === null)
                return key;

            return this._i18nSource.translate(key);
        }
    }
}

export default I18nSupport;
