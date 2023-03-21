
'use strict';

const $ = require('jquery');
const Backbone = require('backbone');
Backbone.$ = $;

const Action = Backbone.Model.extend({
    defaults: {
        name: null,
        enabled: true,
        value: null
    },
    do(source) {
        if (this._direct) {
            for (let call of this._direct) {
                call(this);
            }
        }
        this.trigger('request', this, source);
    },
    isEnabled() {
        return this.attributes.enabled;
    },
    isDisabled() {
        return ! this.attributes.enabled;
    },
    value() {
        return this.attributes.value;
    },
    name() {
        return this.attributes.name;
    },
    direct(call, context) {
        if (this._direct === undefined)
            this._direct = [];
        this._direct.push(call.bind(context));
    },
});

class ActionHub {

    constructor() {
        this._actions = {};
    }

    get(actionName, defaultValues) {
        let action = this._actions[actionName];
        if (action === undefined) {
            action = new Action({ name: actionName, ...defaultValues });
            this._actions[actionName] = action;
        }
        return action;
    }
}

module.exports = new ActionHub();
