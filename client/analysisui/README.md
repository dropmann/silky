# Analysis UI Reference

`client/analysisui` renders the jamovi analysis options panel. It runs inside
the `analysisui.html` iframe, receives compiled analysis UI definitions from the
parent frame, builds an option model and layout tree, and sends option changes
back to the parent frame for the engine/server side of the analysis.

This directory is mostly a framework for module-generated UI. Individual
analysis modules provide compiled definitions; this code turns those definitions
into controls, option state, layout, events, and data requests.

## Entry Points

- `../analysisui.html` is the iframe document. It loads `analysisui/main.css`
  and `analysisui/main.ts`, and provides the shell around the options panel.
- `main.ts` owns iframe communication through `framesg`, analysis loading,
  initial option setup, title updates, focus-loop registration, high-contrast
  support, and parent-frame mouse forwarding.
- `defaultcontrols.ts` maps generated control names such as `CheckBox`,
  `ComboBox`, `VariablesListBox`, and `Supplier` to concrete control classes.
- `main.css` contains shared analysis UI styling. Many controls also have a
  matching `.css` file next to their `.ts` implementation.

The client build is configured in `../vite.config.mts`; `analysisui.html` is one
of the Rollup/Vite inputs.

## Runtime Flow

1. `main.ts` creates a `Framesg` connection to the parent window and exposes the
   frame API: `setOptionsDefinition`, `initialiseOptions`, `updateOptions`,
   `dataChanged`, `setTitle`, and `updateSettings`.
2. The parent calls `setOptionsDefinition`, which runs `loadAnalysis()`.
3. `loadAnalysis()` initializes app and module i18n, configures document
   direction, registers the top-level options focus loop, requests column data,
   and constructs an `Analysis`.
4. `Analysis` evaluates the compiled module UI definition with access to `ui`,
   `DefaultControls`, `FormatDef`, `Format`, `View`, and `utils`.
5. The compiled definition provides option definitions and a layout definition.
   `Analysis` creates:
   - `Options`, the option-state collection.
   - A module `View` instance from `actions.ts`, containing event handlers and
     helper methods.
   - `LayoutActionManager`, which wires generated events and bindings.
   - `OptionsView`, which turns the layout definition into DOM controls.
6. `OptionsView.render()` creates a top-level `ControlContainer`, recursively
   creates controls, registers controls as action resources, fires creation
   events, appends the rendered layout, and then initializes actions after a
   timer tick.
7. Option changes are queued by `Options` and emitted as
   `options.valuesForServer`; `main.ts` compiles those changes and sends
   `onOptionsChanged` to the parent frame.

## Core Concepts

### Options

`options.ts` defines `Options`, a collection of `Opt` instances from
`option.ts`. `Options` is responsible for:

- Building option objects from generated option definitions.
- Translating string defaults through the module translator.
- Finding options by name.
- Applying value, insert, remove, and property updates.
- Batching edits with `beginEdit()`, `endEdit()`, and `runInEditScope()`.
- Queuing server-facing changes so several related edits can be sent together.

`option.ts` defines `Opt<T>`, the value holder for one option. It supports
nested values through key arrays, object/array insertion and removal,
default-value fallback, property overrides, and value events such as
`valuechanged`, `valueinserted`, and `valueremoved`.

### Controls

Most visible UI pieces are controls. The common inheritance path is:

- `PropertySupplier` registers typed properties, supports data-bound property
  strings, and emits property change events.
- `I18nSupport` adds translation support.
- `ControlBase` adds lifecycle, disposal, stage gating, margins, and parent
  lookup.
- `GridControl` adds grid rendering, cell properties, sizing, alignment, and
  stretch behavior.
- `OptionControlBase` connects a control to a `ControlOption`, listens to option
  value events, and exposes `value()` / `setValue()` style APIs.

Controls are created by `OptionsView.createControl()`. A generated control
definition either names a `type` directly or is resolved through
`DefaultControls`. Controls with `name` or `optionName` are connected to real
options unless they are marked virtual.

### Layout

The layout system is based on custom elements and CSS grid:

- `layoutgrid.ts` defines `jmv-layoutgrid`, a grid container that tracks cells,
  rows, columns, spans, and stretch factors.
- `layoutcell.ts` defines `jmv-layoutcell`, the wrapper around a rendered
  control. Cells own visibility, alignment, selection, collapse/expand
  animation, and grid positioning.
- `controlcontainer.ts` recursively renders generated child controls into a
  layout grid. It supports list and inline layouts and delegates nested content
  rendering through `deepRenderToGrid()`.
- `layoutgridbordersupport.ts`, `selectablelayoutgrid.ts`, and related files add
  specialized grid behavior used by suppliers, target lists, and editable
  layouts.

### Actions and Bindings

`actions.ts` defines the module `View` base class and `utils` used by compiled
module code. The view stores per-analysis workspace state, custom variables,
base lifecycle events, and backward-compatibility helpers for older modules.

`layoutactionmanager.ts` and `layoutaction.ts` connect generated events to
controls and the view. Resources are registered by name or generated control id.
Actions can listen to control changes or named events, and property bindings are
converted into actions during initialization.

Binding strings are parsed by `LayoutActionManager`. Simple bindings reference
named resources, while code bindings are evaluated with `new Function()`. This
is intentional for generated trusted module code, but it is a refactoring hazard:
do not treat layout definitions as untrusted input without redesigning this
boundary.

### Data Requests

Controls and views can request data through the data source set by `main.ts`.
Column metadata is cached in `dataResources` after the initial remote request.
`requestLocalColumnData()` serves property requests from cached columns and
custom variables when possible; otherwise requests are forwarded to the parent
frame.

Dataset changes enter through the frame API `dataChanged`. Column changes
refresh cached column metadata before notifying `OptionsView` and the module
view.

### Internationalization, Focus, and Accessibility

`main.ts` initializes app and module i18n, sets `window._`, `window.n_`, and
`window.s_`, and applies text direction from the active language. Controls that
extend `I18nSupport` should translate user-visible strings through the provided
i18n source rather than hard-coding localized text.

The top-level options block is registered with `InteractionManager` from
`../common/interactionmanager`. Focus-mode changes come from the parent frame,
and the options panel uses a focus loop so keyboard navigation stays scoped to
the panel while active.

## File Map

- `main.ts`: iframe API, analysis lifecycle, i18n, focus, parent-frame events.
- `options.ts`, `option.ts`: option model and server-change batching.
- `optionsview.ts`: layout rendering, control creation, option wrapping,
  data-initialization lifecycle.
- `actions.ts`: module view base class and generated-code utility helpers.
- `layoutactionmanager.ts`, `layoutaction.ts`: generated event and binding
  wiring.
- `propertysupplier.ts`: property registration, data-bound properties, change
  events.
- `controlbase.ts`, `gridcontrol.ts`, `optioncontrolbase.ts`,
  `titledgridcontrol.ts`: shared control base classes.
- `controlcontainer.ts`, `layoutgrid.ts`, `layoutcell.ts`: recursive grid layout
  engine.
- `defaultcontrols.ts`: generated control-name registry.
- `format.ts`, `formatdef.ts`: formatted values for variables, terms, numbers,
  and related analysis values.
- `dragndrop.ts`, `gridtargetcontrol.ts`, `variableslistbox.ts`,
  `layoutsupplierview.ts`, `layoutvariablesview.ts`: variable supplier and
  target-list behavior.
- `applymagicevents.ts`: compatibility wiring for generated handler names.
- `layoutupdatecheck.ts`: validation/compatibility checks for generated layout
  definitions.

## Development Commands

From `client`:

```sh
npm run build
node ./node_modules/vitest/vitest.mjs run
node ./node_modules/vite/bin/vite.js
```

There is no dedicated `analysisui` test suite at the time of writing. For risky
changes, run the client build and manually exercise an analysis options panel in
the app or Vite/electron workflow that normally hosts this iframe.

## Refactoring Notes

- Preserve the frame API names in `main.ts`; the parent frame calls those names
  directly.
- Use `CONTROL_INHERITANCE.md` as the baseline contract for refactoring the
  `PropertySupplier` control hierarchy.
- Preserve backwards compatibility paths in `Analysis` and `View`. Older modules
  may still rely on `View.extend`, `window.module`, `window._`, `window.n_`,
  jQuery-style `$el`, and magic handler names.
- Keep option edits batched when a UI action changes more than one value.
  Unbatched edits can send intermediate states to the parent frame.
- Treat generated definitions as trusted code under the current design. Moving
  toward untrusted definitions would require replacing the dynamic `new
  Function()` paths and binding-code evaluation.
- Keep layout, option state, action wiring, and concrete controls separated.
  Most bugs are easier to isolate when those layers stay explicit.
