
'use strict';

const $ = require('jquery');

import {LayoutGridClasse} from './layoutgrid';
const EnumPropertyFilter = require('./enumpropertyfilter');
import GridControl from './gridcontrol';
const focusLoop = require('../common/focusloop');

export class LayoutCollapseView extends LayoutGridClasse(GridControl) {
    constructor(params) {
        super(params);

        //LayoutGrid.extendTo(this);

        this._collapsed = this.getPropertyValue('collapsed');

        this._body = null;
    }

    protected registerProperties(properties) {
        super.registerProperties(properties);

        this.registerSimpleProperty("collapsed", false);
        this.registerSimpleProperty("label", null);
        this.registerSimpleProperty("stretchFactor", 1);
    }

    createItem() {
        this.$el.addClass("jmv-collapse-view titled-group top-title silky-layout-container silky-options-group silky-options-group-style-list silky-control-margin-" + this.getPropertyValue("margin"));

        let groupText = this.getPropertyValue('label');
        groupText = this.translate(groupText);
        let t = '<div class="silky-options-collapse-icon" style="display: inline;"> <span class="silky-dropdown-toggle"></span></div>';
        this.labelId = focusLoop.getNextAriaElementId('label');
        this.$header = $(`<button id="${this.labelId}" aria-level="2" class="silky-options-collapse-button silky-control-margin-${this.getPropertyValue("margin")}" style="white-space: nowrap;">${t + groupText }</button>`);

        this.$header.attr('aria-expanded', ! this._collapsed);

        if (this._collapsed) {
            this.$el.addClass('view-colapsed');
            this.$header.addClass('silky-gridlayout-collapsed');
        }

        this._headerCell = this.addCell(0, 0, this.$header);
        this._headerCell.setStretchFactor(1);

        this.$header.on('click', null, this, function(event) {
            let group = event.data;
            group.toggleColapsedState();
        });
    }

    setBody(body) {
        let bodyId = body.$el.attr('id');
        if (!bodyId) {
            bodyId = focusLoop.getNextAriaElementId('body');
            body.$el.attr('id', bodyId);
        }
        body.$el.attr('role', 'region');
        body.$el.attr('aria-labelledby', this.labelId);

        this.$header.attr('aria-controls', bodyId);

        this._body = body;
        body.$el.addClass("silky-control-body");
        let data = body.renderToGrid(this, 1, 0);
        this._bodyCell = data.cell;
        this._bodyCell.setVisibility(this._collapsed === false, true);
        body.$el.attr('aria-hidden', this._collapsed);
        return data.cell;
    }

    collapse() {

        if (this._collapsed)
            return;

        this.$header.addClass("silky-gridlayout-collapsed");
        this.$el.addClass('view-colapsed');
        this._body.$el.attr('aria-hidden', true);

        this.setContentVisibility(false);
        this._collapsed = true;
        this.$header.attr('aria-expanded', false);
    }

    setContentVisibility(visible) {
        this._bodyCell.setVisibility(visible);
    }

    expand() {

        if ( ! this._collapsed)
            return;

        this.$header.removeClass("silky-gridlayout-collapsed");
        this.$el.removeClass('view-colapsed');
        this._body.$el.attr('aria-hidden', false);

        this.setContentVisibility(true);
        this._collapsed = false;
        this.$header.attr('aria-expanded', true);
    }

    toggleColapsedState() {
        if (this._collapsed)
            this.expand();
        else
            this.collapse();
    }
}

export default LayoutCollapseView;
