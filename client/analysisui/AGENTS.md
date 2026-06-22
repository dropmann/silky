# Analysis UI Agent Instructions

Before changing `client/analysisui`, read `README.md` in this directory. It is
the local architecture reference for the iframe lifecycle, option model, layout
engine, action wiring, and compatibility constraints. Before changing
`PropertySupplier` or the control inheritance stack, also read
`CONTROL_INHERITANCE.md`.

## Module Shape

- `main.ts` is the iframe boundary. Be careful with frame API method names and
  payload shapes because they are called by the parent frame.
- `options.ts` and `option.ts` own option state, nested values, property
  overrides, and server-change batching.
- `optionsview.ts` creates controls, connects options, registers action
  resources, and manages data-initialization lifecycle.
- `actions.ts`, `layoutactionmanager.ts`, and `layoutaction.ts` own module view
  events, generated actions, and property bindings.
- `controlbase.ts`, `gridcontrol.ts`, `optioncontrolbase.ts`, and
  `propertysupplier.ts` are shared control infrastructure. Changes here affect
  most controls. Preserve the contracts documented in
  `CONTROL_INHERITANCE.md`.
- `controlcontainer.ts`, `layoutgrid.ts`, and `layoutcell.ts` are the layout
  engine. Changes here affect all generated analysis layouts.
- `defaultcontrols.ts` is the generated-name to control-class registry. Update it
  when adding or renaming generated control types.

## Compatibility Rules

- Preserve support for generated module code and older module APIs unless the
  task explicitly removes that compatibility.
- Do not remove `window._`, `window.n_`, `window.s_`, `window.jamoviVersion`,
  `View.extend`, `$el`, or magic event wiring without checking all callers.
- Dynamic evaluation through `new Function()` is part of the current trusted
  generated-code boundary. Do not partially harden it in a way that breaks
  existing generated modules; redesign the boundary deliberately if needed.
- Keep `DefaultControls` names stable. They are referenced by compiled module UI
  definitions, not just local TypeScript imports.
- Preserve option batching with `beginEdit()`, `endEdit()`, and
  `runInEditScope()` around grouped UI/action changes.

## Editing Notes

- Prefer small, behavior-preserving refactors first. This directory has many
  implicit contracts between generated definitions and runtime classes.
- Keep paired CSS and TypeScript changes together for concrete controls.
- When touching control base classes, check representative concrete controls
  such as `gridcheckbox.ts`, `gridtextbox.ts`, `gridtargetcontrol.ts`, and
  `optionlistcontrol.ts`.
- When touching layout behavior, check both simple controls and variable
  supplier/target-list controls because they rely heavily on grid cells, spans,
  visibility, and drag/drop behavior.
- When changing option or action behavior, check that parent-frame messages from
  `main.ts` still contain `values` and `properties` in the expected shape.
- Keep accessibility behavior in place: roles, labels, generated aria ids,
  focus-loop registration, text direction, and keyboard interaction should not
  be incidental casualties of visual cleanup.

## Verification

From `client`, use:

```sh
npm run build
node ./node_modules/vitest/vitest.mjs run
```

There is currently no dedicated `analysisui` test suite. For non-trivial changes,
also manually exercise at least one analysis options panel with variable
suppliers, target controls, option updates, and panel hide/show behavior.

## Documentation

- Update `README.md` when changing the architecture, lifecycle, public frame API,
  option-change flow, generated-control registry, or major refactoring guidance.
- Keep this file focused on workflow and guardrails for future agents.
