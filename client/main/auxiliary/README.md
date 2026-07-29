# Auxiliary Panel

The auxiliary panel is the secondary panel system used by the main client UI. It is made from three layers:

- `shell.ts`, `panel.ts`, and `toolbar.ts` manage placement, panel visibility, toolbar buttons, docking/overlay state, resizing, and focus behavior.
- `types.ts` defines the shared contracts: `AuxView`, `AuxViewId`, `AuxEntry`, and `AuxEntryContext`.
- `registry.ts` lists the available entries, controls their order, and creates the runtime `AuxView[]` used by the shell.

Shared aux panel styling lives in `style.css`. Entry-specific styling should live with the entry, not in `style.css` or `jamovi.css`.

## Aux Views

Every aux page extends `AuxView` from `types.ts`.

An `AuxView` owns:

- `id`: the stable `AuxViewId` used for toolbar state and selection.
- `getTitle()`: the toolbar and panel label.
- `getIconSvg()`: the toolbar icon markup.
- `getBody()`: creates the entry body.
- `update()`: refreshes an already-created body.
- `onMount()`: runs once after the body is inserted.
- `onShow()` / `onHide()`: runs when the view becomes visible or hidden.

`AuxView.createPanelElement()` wraps the body in the standard panel container and registers the focus loop. Entry code should usually build only the body content returned by `getBody()`.

## Entry Registry

`registry.ts` is the source of truth for which aux entries exist and the order they appear in the toolbar.

Entries are sorted by `order` before being created:

```ts
export const auxEntries: AuxEntry[] = [
    createEntry('assistant', 10, ({ t }) => new AssistantAuxView(t)),
    modulesEntry,
];
```

Use gaps between order values so new entries can be inserted without renumbering everything.

The `AuxEntryContext` passed to every entry contains:

- `t`: translation helper.
- `instance`: the main client `Instance`.

Only use the parts of the context that the entry needs.

## Bundled Entries

New substantial entries should be contained bundles under `entries/<entry-id>/`.

Recommended layout:

```text
entries/
  example/
    index.ts
    view.ts
    style.css
```

`index.ts` exports the entry descriptor and imports any entry-local CSS:

```ts
import type { AuxEntry } from '../../types';
import ExampleAuxView from './view';
import './style.css';

const entry: AuxEntry = {
    id: 'example',
    order: 145,
    create: ({ t, instance }) => new ExampleAuxView(t, instance),
};

export default entry;
```

`view.ts` exports the `AuxView` implementation. Its imports should be relative to the bundle location. For example, from `entries/example/view.ts`, shared aux types are imported from `../../types`.

`style.css` should contain only selectors for that entry. Prefix entry classes with the entry name, such as `.aux-example-*`, to avoid leaking styles into other entries.

## Adding An Entry

1. Add the new id to `AuxViewId` in `types.ts`.
2. Create `entries/<entry-id>/index.ts`.
3. Create `entries/<entry-id>/view.ts` and extend `AuxView`.
4. Add `entries/<entry-id>/style.css` if the entry needs custom styles.
5. Import the entry descriptor in `registry.ts`.
6. Add it to `auxEntries` with an `order` value.
7. Run the client build to catch import, type, and CSS bundling issues.

For a small placeholder or simple internal view, a single `auxiliary/<entry-id>.ts` file can still be registered directly in `registry.ts`. Prefer a bundled entry once the view has its own CSS, non-trivial state, or external dependencies.

## Removing An Entry

1. Remove the entry from `auxEntries` in `registry.ts`.
2. Remove its import from `registry.ts`.
3. Remove the id from `AuxViewId` in `types.ts` if no code still references it.
4. Delete the entry folder or view file.
5. Search for stale references to the id and any entry-specific CSS prefix.

## CSS Rules

- Put shared shell/panel/toolbar/list styling in `style.css`.
- Put entry-specific CSS in `entries/<entry-id>/style.css`.
- Do not add aux CSS to `jamovi.css`.
- Keep selectors entry-scoped unless they intentionally target shared aux structure.
- Prefer stable dimensions for toolbar buttons, cards, icons, filters, and controls to prevent layout shifts.

## Validation

The main validation command for aux client changes is:

```powershell
cd client
node ./node_modules/vite/bin/vite.js build
```

This catches broken imports, missing CSS declarations, and invalid asset paths in bundled entry CSS.
