'use strict';

import TitledGridControl from './titledgridcontrol';
import OptionControl from './optioncontrol';

export class GridOptionControl extends OptionControl(TitledGridControl) {
    constructor(params) {
        super(params);
    }
}

export default GridOptionControl;
