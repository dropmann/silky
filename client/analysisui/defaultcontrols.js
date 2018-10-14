'use strict';

const LayoutCollapseView = require('./layoutcollapseview');
const LayoutGroupView = require('./layoutgroupview');
const LayoutSupplierView = require('./layoutsupplierview');
const OutputVariableSupplier = require('./outputvariablesupplier');
const LayoutVariablesView = require('./layoutvariablesview');
const GridCheckbox = require('./gridcheckbox');
const GridRadioButton = require('./gridradiobutton');
const GridTextbox = require('./gridtextbox');
const GridCombobox = require('./gridcombobox');
const GridOptionListControl = require('./gridoptionlistcontrol');
const ControlContainer = require('./controlcontainer').container;
const RMAnovaFactorsControl = require('./rmanovafactorscontrol');
const VariableLabel = require('./variablelabel');
const TermLabel = require('./termlabel');
const GridTargetContainer = require('./gridtargetcontrol');
const VariablesListBox = require('./variableslistbox');
const LevelSelector = require('./levelselector');

const DefaultControls = {

    RMAnovaFactorsBox: RMAnovaFactorsControl,
    CheckBox: GridCheckbox,
    RadioButton: GridRadioButton,
    ComboBox: GridCombobox,
    TextBox: GridTextbox,
    ListBox: GridOptionListControl,
    TargetLayoutBox: GridTargetContainer,
    VariablesListBox: VariablesListBox,
    TargetListBox: function() { return "TargetListBox is no longer used."; },
    VariableTargetListBox: function() { return "VariableTargetListBox is no longer used."; },
    Supplier: LayoutSupplierView,
    VariableSupplier: LayoutVariablesView,
    OutputSupplier: OutputVariableSupplier,
    CollapseBox: LayoutCollapseView,
    Label: LayoutGroupView,
    LayoutBox: ControlContainer,
    VariableLabel: VariableLabel,
    TermLabel: TermLabel,
    LevelSelector: LevelSelector,

    ListItem: {//Not to be used, no longer supported
        TextBox: GridTextbox, //Not to be used, no longer supported
        ComboBox: GridCombobox, //Not to be used, no longer supported
        TermLabel: TermLabel, //Not to be used, no longer supported
        VariableLabel:VariableLabel, //Not to be used, no longer supported
        Label: LayoutGroupView //Not to be used, no longer supported
    }
};

module.exports = DefaultControls;
