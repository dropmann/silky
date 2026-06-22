# Control Inheritance Contracts

This document captures the current contracts of the `PropertySupplier`-based
control hierarchy. It is a baseline for behavior-preserving refactors: change
the internals only when these externally visible contracts still hold, or update
this document and callers deliberately.

## Current Tree

```text
EventEmitter
`- PropertySupplier<P>
   `- I18nSupport<P>
      `- ControlBase<P>
         `- GridControl<P>
            |- CustomControl
            |- LayoutCollapseView
            |- GridTargetContainer
            |- MultiContainer
            `- TitledGridControl<P>
               |- ControlContainer<P>
               |  `- LayoutSupplierView<P>
               |     `- LayoutVariablesView
               |        `- OutputSupplier
               |- LabelControl
               `- OptionControlBase<T, V, P>
                  `- OptionControl<P, V, T>
                     |- ContentSelector
                     |- GridActionButton
                     |- GridCheckbox
                     |- GridCombobox
                     |- GridRadioButton
                     |- GridTextbox
                     |- LevelSelector
                     |- OptionLabelControl
                     |- OutputControl
                     |- RMAnovaFactorsControl
                     |- TermLabel
                     |- VariableLabel
                     `- OptionListControl<P>
                        `- SelectableOptionListControl<P>
                           `- VariablesListBox
```

The layout element hierarchy is separate from the control class hierarchy:

```text
HTMLElement
|- LayoutGrid
|  |- BorderLayoutGrid
|  |  |- SelectableLayoutGrid
|  |  `- SupplierLayoutGrid
|  `- rmafcItem
`- LayoutCell
```

## PropertySupplier

`PropertySupplier` is the base property and event contract for controls.
Its public API is intentionally still on the control instance, but the internal
storage and edit batching now live in an internal `PropertyBag`.

Provided surface:

- Stores the original generated/control params on `params`.
- Stores registered properties in `properties`.
- Extends `EventEmitter`.
- Registers generated input params as simple properties during construction.
- Supports `registerSimpleProperty()`, `registerComplexProperty()`,
  `getPropertyValue()`, `setPropertyValue()`, `hasProperty()`,
  `isPropertyDefined()`, and `getTrigger()`.
- Supports edit batching with `beginPropertyEdit()`, `endPropertyEdit()`, and
  `runInEditScope()`.
- Emits property change events named `<property>_changed` unless the property is
  complex and has an external trigger.
- Calls `onPropertyChanged(property)` after a successful `setPropertyValue()`.
- Detects string data bindings when a string value trims to a parenthesized
  expression such as `(foo)`; the binding is stored on the property and the
  runtime value becomes `null`.

Important invariants:

- Generated params override later defaults. `registerSimpleProperty()` must not
  replace a property that is already registered with `isDefined`.
- `name` and `type` are immutable through `setPropertyValue()`.
- Missing properties throw when read or written.
- Function-valued property getters are called when `getPropertyValue()` returns
  a function.
- Batched property edits coalesce pending property change events by property
  name.

Refactor note:

`PropertySupplier` is now the first compatibility facade in this hierarchy.
Direct access to `properties` and `params` still exists and must be preserved
until callers are migrated.

## I18nSupport

`I18nSupport` adds translation to any property-backed control.
Its public API remains on the control instance, while the active source and
translation fallback behavior are delegated to an internal `I18nController`.

Provided surface:

- Stores an i18n source via `setI18nSource()`.
- Calls optional `onI18nChanged()` when the source changes.
- Provides `translate()` and `translateN()`.
- Falls back to the original key when no i18n source is set.

Important invariants:

- Controls can be constructed before i18n is available.
- Reassigning i18n should let controls refresh rendered text through
  `onI18nChanged()`.

Refactor note:

This is now a compatibility facade over `I18nController`. `_i18nSource` remains
mirrored on the instance for compatibility.

## ControlBase

`ControlBase` adds control identity, lifecycle, parent lookup, stage, and margin
support.

Provided surface:

- Implements the shared `Control<P>` shape used by `OptionsView`.
- Stores `_parentControl`.
- Exposes `isDisposed`.
- Registers `stage` and `margin`.
- Provides `dispose()`, `onDisposed()`, `getTemplateInfo()`, and
  `getTranslatedProperty()`.
- Emits `disposing` from `onDisposed()`.
- Recursively disposes children returned by `getControls()`.

Important invariants:

- `dispose()` is idempotent.
- `getTemplateInfo()` checks a local `_templateInfo` property first, then asks
  the parent control.
- `getTranslatedProperty()` only accepts string or nullish values.
- Child controls are disposed after the current control emits its disposal
  lifecycle.

## GridControl

`GridControl` adds DOM root and grid rendering behavior.

Provided surface:

- Exposes `el` and deprecated `$el`.
- Uses `setRootElement()` to set both the DOM root and jQuery compatibility
  wrapper.
- Registers grid/layout properties: `stretchFactor`, alignment, min/max sizes,
  `cell`, `useSingleCell`, and `contentLink`.
- Provides `renderToGrid()`, `getSpans()`, `usesSingleCell()`, and hooks:
  `createItem()`, `addedContentToCell()`, `componentItemsMerged()`, and optional
  `onRenderToGrid()`.
- Applies cell alignment, stretch, dimensions, and content visibility to
  `LayoutCell`.

Important invariants:

- A control with `el` and no `onRenderToGrid()` renders as a single cell.
- `useSingleCell` can wrap a multi-cell renderer in a single wrapper grid.
- `contentLink` drives the visibility of the associated layout cell after
  render.
- `$el` remains for old module/control code even though `el` is preferred.
- Explicit `cell` definitions span two columns.

Refactor note:

Grid rendering can be extracted behind the same `renderToGrid()` and `el`
surface, but controls and layout containers currently call these methods
directly.

## TitledGridControl

`TitledGridControl` is a small grid specialization for controls that may occupy
label/content columns.

Provided surface:

- Keeps `labelId` and `_subel`.
- Overrides `getSpans()` to return two columns unless `useSingleCell` is true.
- Provides `getLabelId()`.

Important invariants:

- Controls using normal titled layout occupy two grid columns.
- `getLabelId()` returns `null` when no label id has been assigned.

## OptionControlBase

`OptionControlBase` connects controls to an option value.
Its public API remains on the control instance, while option subscription and
option source event routing are delegated to an internal `OptionBinding`.

Provided surface:

- Registers complex `value` backed by `getSourceValue()` and
  `setSourceValue()`.
- Registers `name`, `isVirtual`, and `valueKey`.
- Provides `getValue()`, `value()`, `setValue()`, `getSourceValue()`,
  `setSourceValue()`, `getOption()`, `setOption()`, `getValueKey()`,
  `getFullKey()`, `getRelativeKey()`, and `getValueId()`.
- Listens to option source events: `valuechanged`, `valueinserted`, and
  `valueremoved`.
- Emits cancellable or notification events: `changing`,
  `optionValueChanging`, `optionValueChanged`, `optionValueInserting`,
  `optionValueInserted`, `optionValueRemoving`, and `optionValueRemoved`.
- Wraps source writes in both option edit batching and property edit batching.
- Supports template item keys by deriving full keys from parent option controls.

Important invariants:

- Changing `valueKey` or `itemKey` triggers option value change notifications
  for the control.
- `setOption()` unsubscribes from the previous option before subscribing to the
  new option.
- `setOption(null)` is valid during disposal.
- Option events only update the control when the event key affects this
  control's `valueKey`.
- `getOption()` can fall back to the parent template control; otherwise it
  throws when the control is not connected to an option.
- `setSourceValue()` emits `changing` before writing and respects
  `event.cancel`.
- Disposal clears rendered HTML when `el` exists and disconnects option
  listeners.

Refactor note:

This is now partly extracted into `OptionBinding`. Keep the direct methods on
controls while migrating further internals, because generated events and custom
controls use them.

## OptionControl

`OptionControl` adds option metadata overrides and common option-control
properties.

Provided surface:

- Registers `optionName`, `enable`, `label`, `defaultValue`, `style`, and
  `optionPart`.
- Supports `registerOptionProperty()` to map a control property to an option
  metadata property.
- Supports local override and local push behavior for option metadata.
- Provides `setEnabled()`.
- When an option is assigned, initializes option metadata overrides and detects
  data-bound option metadata values.

Important invariants:

- `label` maps to option metadata `title`.
- `defaultValue` maps to option metadata `default`.
- If no mode is supplied to `registerOptionProperty()`, matching names use
  local push and different names use local override.
- `getPropertyValue()` can fall back to option metadata when the local override
  value is `null`.
- Local-push option properties update option metadata when the local property
  changes.

## Container Branch

`ControlContainer` inherits from `TitledGridControl`, not `OptionControlBase`.
It is a layout/control creation branch.

Provided surface:

- Registers `style`, `name`, `labelSource`, and container `margin`.
- Creates child controls through `IControlProvider.createControl()`.
- Recursively renders children with `deepRenderToGrid()`.
- Keeps child controls in `controls`.
- Can label the container from a child control through `labelSource`.

Important invariants:

- Container children participate in disposal through `ControlBase.getControls()`.
- Named controls are registered as action resources by `OptionsView`.
- Inline and list layout styles drive row/column advancement.

## Runtime Mixins and Helpers

Some files create runtime variants rather than simple class descendants:

- `HiddenScrollBarSupport(Base)` returns a class extending `Base`.
- `ChildLayoutSupport(Base)` returns a class extending `Base`.
- `LayoutControl(Base, Grid)` returns a class extending `Base` with a specific
  layout grid root.
- `TemplateItemControl(obj)` augments a control instance/object with template
  item behavior.

Refactor note:

These helpers assume base classes expose the same methods as the static tree.
Any composition refactor must keep those methods available on the final control
instance.

## Generated-Code Contracts

Generated analysis UI definitions and older module code may call or depend on:

- `getPropertyValue()`, `setPropertyValue()`, `hasProperty()`,
  `isPropertyDefined()`, `runInEditScope()`, and event emitter methods.
- `translate()`, `translateN()`, and `setI18nSource()`.
- `dispose()`, `isDisposed`, `getTemplateInfo()`, and `getControls()`.
- `el`, deprecated `$el`, `renderToGrid()`, `getSpans()`, and `getLabelId()`.
- `value()`, `getValue()`, `setValue()`, `setOption()`, `getOption()`,
  `getValueKey()`, `getFullKey()`, and `getRelativeKey()`.
- Option/control events named in generated definitions.
- Stable control names in `defaultcontrols.ts`.

These are compatibility boundaries. Prefer preserving them while changing
internals.

## Phase 2 Test Targets

Before extracting internals, add focused tests around:

- Generated params overriding class defaults in `PropertySupplier`.
- Data-bound property detection and binding storage.
- Property edit batching and event coalescing.
- Immutable `name` and `type` properties.
- `ControlBase.dispose()` idempotence and child disposal.
- `GridControl.renderToGrid()` single-cell and `useSingleCell` behavior.
- `OptionControlBase.setOption()` subscription replacement and cleanup.
- `valueKey` / template-key behavior in `getFullKey()` and event filtering.
- `OptionControl` local override and local push metadata behavior.

## Phase 3 Extraction Notes

The first extractions are complete for `PropertySupplier`, `I18nSupport`, and
part of `OptionControlBase`:

- `PropertyBag` owns registered property storage, data-binding detection, value
  access, setter dispatch, trigger lookup, and edit batching.
- `PropertySupplier` keeps the old public methods and delegates to
  `PropertyBag`.
- `params` remains on `PropertySupplier`.
- `properties` remains publicly reachable on `PropertySupplier` and points to
  the `PropertyBag` property map.
- `I18nController` owns the current i18n source, translation delegation, and
  fallback behavior.
- `I18nSupport` keeps `setI18nSource()`, `translate()`, `translateN()`,
  `onI18nChanged()`, and mirrored `_i18nSource`.
- `OptionBinding` owns option source subscription replacement, subscription
  clearing, routing of `valuechanged`, `valueinserted`, and `valueremoved`
  events, value-key composition, relative-key calculation, key-difference
  calculation, and event filtering.
- `OptionControlBase` keeps `option`, `setOption()`, event hook methods, source
  writes, and compatibility wrappers for the old `_valueChanged`,
  `_valueInserted`, `_valueRemoved`, `_isKeyAffecting`, `_keyDifference`,
  `getValueKey`, `getFullKey`, and `getRelativeKey` methods.

Next extraction candidates:

- Move source write/edit-scope behavior from `OptionControlBase` into
  `OptionBinding`, after adding tests for insert writes and nested key writes.
