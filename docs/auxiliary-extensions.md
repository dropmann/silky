# Auxiliary Extensions

This document describes a proposed architecture for adding third-party auxiliary panel extensions to jamovi.

Auxiliary extensions are separate from jamovi analysis modules. Modules provide analyses, options, R code, and results. Auxiliary extensions provide side-panel tools: workflow helpers, teaching aids, review tools, data diagnostics, integrations, navigation aids, and other contextual UI.

The auxiliary panel should become an extension host. Built-in auxiliary views can continue to exist, but the long-term model should allow built-in and externally installed auxiliary extensions to register into the same panel surface.

## Goals

- Allow external contributors to add auxiliary panel tools without modifying jamovi core.
- Keep extensions isolated from jamovi internals.
- Provide a small, stable, versioned API for interacting with the current jamovi document.
- Make access to data, analyses, settings, file operations, network, and mutation explicit through permissions.
- Keep the current auxiliary panel responsible for shell behavior, focus, accessibility, docking, sizing, and toolbar state.
- Keep auxiliary extensions independent from analysis modules and installable through their own extension mechanism.

## Non-Goals

- Auxiliary extensions are not analysis modules.
- Auxiliary extensions should not receive direct access to `Instance`, `Modules`, `Settings`, `Coms`, or internal Backbone-style models.
- External extensions should not share the main DOM context.
- The v1 API should not expose unrestricted raw data access, arbitrary file access, or module installation to external extensions.

## Relationship To Existing Auxiliary Views

The current auxiliary panel is built around:

- `client/main/auxiliary/panel.ts`: panel shell and active view state.
- `client/main/auxiliary/types.ts`: `AuxView`, `AuxEntry`, and shared contracts.
- `client/main/auxiliary/registry.ts`: built-in view registration.
- `client/main/auxiliary/entries/*`: substantial bundled auxiliary views.

The proposed extension architecture should preserve this structure, but introduce a second kind of view:

- **Trusted built-in views**: current TypeScript `AuxView` classes, allowed to use internal APIs where needed.
- **Sandboxed extension views**: external packages rendered inside an isolated host, communicating with jamovi through a typed message API.

The Module Library can become the first built-in privileged auxiliary extension. It should use the same registration shape where practical, but it remains jamovi-owned and may have permissions that are not available to ordinary external extensions.

## Package Structure

Auxiliary extensions should use their own package type and manifest.

Example:

```json
{
  "type": "jamovi-aux-extension",
  "id": "org.example.dataset-audit",
  "name": "Dataset Audit",
  "version": "1.0.0",
  "apiVersion": "jamovi.aux.v1",
  "entrypoint": "index.html",
  "description": "Checks a dataset for common quality issues.",
  "permissions": [
    "read:appContext",
    "read:datasetSummary",
    "read:variables",
    "read:selectedAnalysis",
    "ui:notifications",
    "ui:persistentStorage"
  ],
  "network": {
    "hosts": []
  }
}
```

Suggested package layout:

```text
dataset-audit.jax/
  manifest.json
  index.html
  extension.js
  extension.css
  assets/
```

The package extension name is only illustrative. The important part is that auxiliary extensions are packaged and installed independently from analysis modules.

## Runtime Architecture

The auxiliary extension host has five main pieces:

1. **Extension registry**
   Discovers installed auxiliary extensions, validates manifests, checks compatibility, and exposes entries to the auxiliary panel.

2. **Auxiliary panel adapter**
   Converts an extension manifest into an aux panel entry: id, title, icon, order, enabled state, and body host.

3. **Sandbox host**
   Creates an isolated iframe or equivalent container for the extension entrypoint. The host owns panel integration; the extension owns only its own rendered content.

4. **Message bridge**
   Provides a typed request/response and event channel between the extension and jamovi. All jamovi API calls cross this bridge.

5. **Permission gate**
   Checks every API request against the extension manifest, user grants, and any runtime policy.

High-level flow:

```text
Installed extension package
  -> manifest validation
  -> extension registry
  -> aux entry adapter
  -> aux panel toolbar button
  -> sandboxed view
  -> message bridge
  -> permissioned jamovi API
```

## Isolation Model

External extensions should run outside the main jamovi DOM context. An iframe is the preferred initial boundary because it gives a familiar browser security model and aligns with existing focus/message concepts in the client.

The iframe should:

- Load only the extension entrypoint.
- Communicate with jamovi through `postMessage` or an equivalent typed bridge.
- Avoid direct access to the parent DOM.
- Avoid direct access to jamovi internals.
- Receive theme, language, and sizing context from the host.
- Delegate privileged actions to the host.

The host should own:

- Toolbar button.
- Panel title.
- Active/hidden state.
- Focus loop registration.
- Accessibility announcements.
- Permission prompts.
- Dialogs and notifications.
- Persistent extension storage.

The extension should own:

- Its internal UI.
- Its own event handlers.
- Calls to the exposed auxiliary API.
- Extension-local state.

## Permission Model

Permissions should be understandable to users and precise enough for enforcement. They should be grouped by capability rather than internal implementation detail.

### Read Permissions

```text
read:appContext
```

Read basic jamovi context: app version, platform, language, theme, document title, and whether a dataset is present.

```text
read:datasetSummary
```

Read dataset dimensions and summary metadata: row count, column count, active filters, missingness summaries, and broad state. This does not include raw cell data.

```text
read:variables
```

Read variable metadata: names, labels, measure types, data types, levels, descriptions, and missing counts.

```text
read:selectedVariable
```

Read the currently selected or active variable context.

```text
read:analyses
```

Read the list of analyses in the document: id, module namespace, analysis name, title, and status.

```text
read:selectedAnalysis
```

Read the currently selected analysis and a safe summary of its options and status.

```text
read:analysisResults
```

Read structured result summaries or result metadata. This should be separate from `read:selectedAnalysis` because results may contain user data.

```text
read:modules
```

Read installed modules, available analyses, and module visibility state.

### Data Permissions

```text
read:dataPreview
```

Read a small capped preview of visible rows.

```text
read:dataColumns
```

Read full data columns. This is sensitive and should not be part of the default v1 extension permission set.

```text
read:computedSummaries
```

Ask jamovi to compute summaries without exposing raw rows. This should be preferred over raw data access where possible.

### Action Permissions

```text
action:createAnalysis
```

Create a new analysis using an installed module.

```text
action:updateAnalysisOptions
```

Modify options on an existing analysis.

```text
action:selectAnalysis
```

Navigate the user to an analysis.

```text
action:selectVariable
```

Change the current variable selection or focus.

```text
action:createTransform
```

Create computed or transformed variables.

```text
action:editDataset
```

Modify cell data, variable metadata, filters, or dataset structure. This should be deferred until the extension model is mature.

```text
action:installModule
```

Install, update, remove, or change visibility for statistical modules. This should initially be restricted to built-in privileged extensions such as the Module Library.

### UI Permissions

```text
ui:notifications
```

Show jamovi notifications.

```text
ui:dialogs
```

Ask the host to show confirmation, alert, or input dialogs.

```text
ui:openExternalUrl
```

Open external browser links.

```text
ui:clipboard
```

Write user-visible text to the clipboard.

```text
ui:persistentStorage
```

Store extension-local settings.

### Network Permissions

Network access should be explicit.

```json
{
  "network": {
    "hosts": [
      "https://api.example.edu"
    ]
  }
}
```

Suggested policies:

- No network access by default.
- Declared hosts only for ordinary extensions.
- Broad network access only for trusted or administrator-approved extensions.

## Suggested V1 Permission Set

The initial external extension API should be useful but conservative.

Recommended v1 permissions:

```text
read:appContext
read:datasetSummary
read:variables
read:selectedVariable
read:analyses
read:selectedAnalysis
read:computedSummaries
action:createAnalysis
action:selectAnalysis
ui:notifications
ui:dialogs
ui:persistentStorage
ui:openExternalUrl
```

Permissions to defer:

```text
read:dataColumns
action:updateAnalysisOptions
action:editDataset
action:createTransform
action:installModule
action:openFile
action:saveFile
network:any
```

## API Shape

The extension API should be async, versioned, typed, and namespaced by capability.

Extension entrypoint:

```ts
const jamovi = await window.jamoviAux.connect({
    apiVersion: 'jamovi.aux.v1'
});
```

Context:

```ts
const context = await jamovi.context.get();
```

Dataset:

```ts
const summary = await jamovi.dataset.summary();

const computed = await jamovi.dataset.summarise({
    variables: ['age', 'score'],
    statistics: ['mean', 'sd', 'missing', 'min', 'max']
});
```

Variables:

```ts
const variables = await jamovi.variables.list();
const variable = await jamovi.variables.get('age');
const selected = await jamovi.variables.getSelected();
```

Analyses:

```ts
const analyses = await jamovi.analyses.list();
const selected = await jamovi.analyses.getSelected();

await jamovi.analyses.create({
    ns: 'jmv',
    name: 'ttestIS',
    title: 'Independent Samples T-Test',
    options: {
        deps: ['score'],
        group: 'condition'
    }
});

await jamovi.analyses.select({
    id: 12
});
```

UI:

```ts
await jamovi.ui.setTitle('Dataset Audit');
await jamovi.ui.setBadge({ text: '3', tone: 'warning' });

await jamovi.ui.notify({
    title: 'Possible issue',
    message: 'Two variables have high missingness.',
    type: 'warning'
});

const confirmed = await jamovi.ui.confirm({
    title: 'Create analysis?',
    message: 'Add a missing-values summary analysis to the results?'
});
```

Storage:

```ts
await jamovi.storage.set('showPassedChecks', true);
const showPassedChecks = await jamovi.storage.get('showPassedChecks');
```

Events:

```ts
jamovi.on('contextChanged', event => {});
jamovi.on('datasetChanged', event => {});
jamovi.on('variablesChanged', event => {});
jamovi.on('selectedVariableChanged', event => {});
jamovi.on('analysesChanged', event => {});
jamovi.on('selectedAnalysisChanged', event => {});
jamovi.on('themeChanged', event => {});
jamovi.on('visibilityChanged', event => {});
```

## API Principles

The API should expose user-level concepts, not jamovi implementation objects.

Do not expose:

```ts
jamovi.instance
jamovi.modules()
jamovi.settings()
jamovi.coms
window.parent.document
```

Expose:

```ts
jamovi.context.get()
jamovi.dataset.summary()
jamovi.variables.list()
jamovi.analyses.create()
jamovi.ui.notify()
```

This keeps the extension contract stable even if jamovi internals change.

## Lifecycle

Suggested extension lifecycle:

1. **Installed**
   Extension package is present on disk and has a valid manifest.

2. **Registered**
   Extension is accepted by the registry and appears as an available aux entry.

3. **Loaded**
   The panel creates the sandbox host and loads the extension entrypoint.

4. **Connected**
   Extension calls `jamoviAux.connect()` and receives its granted API.

5. **Shown**
   User opens the extension view.

6. **Hidden**
   User switches away or closes the aux panel.

7. **Disposed**
   Extension iframe is removed, listeners are released, and pending requests are cancelled.

Lifecycle events:

```ts
jamovi.on('ready', event => {});
jamovi.on('shown', event => {});
jamovi.on('hidden', event => {});
jamovi.on('dispose', event => {});
```

## Error Handling

API calls should fail predictably.

Example error shape:

```ts
type JamoviAuxError = {
    code:
        | 'permission-denied'
        | 'unsupported-api-version'
        | 'invalid-request'
        | 'not-found'
        | 'cancelled'
        | 'internal-error';
    message: string;
};
```

Permission failures should identify the missing permission:

```json
{
  "code": "permission-denied",
  "message": "Missing permission: read:variables"
}
```

## Installation And Management

Auxiliary extensions should have their own management surface. This could eventually be an **Aux Extension Library**, separate from the existing Module Library.

Management should support:

- Install.
- Update.
- Remove.
- Enable or disable.
- View permissions.
- Review source, publisher, and version.
- Reset extension-local storage.

The Module Library can remain an aux panel view, but it manages statistical modules, not auxiliary extensions.

## Built-In Privileged Extensions

Some jamovi-owned auxiliary entries may use the same extension-host structure while receiving privileged capabilities.

Examples:

- Module Library.
- Official help.
- Official assistant.
- System diagnostics.

These should be marked as built-in or trusted and should not define the baseline permission level for external extensions.

## Open Questions

- Should external extensions be allowed in cloud/browser deployments, desktop deployments, or both?
- Should network access be mediated by the host rather than the iframe directly?
- Should raw data access exist at all in v1?
- Should permissions be granted at install time, first use, or both?
- Should an organization or administrator be able to pre-approve extensions?
- Should extension packages be signed?
- Should extension UI be allowed to request custom toolbar icons, badges, or secondary actions?
- How should keyboard focus move into and out of extension iframes?
- How much of the existing `interactionManager` message bridge can be reused?

## Proposed First Step

Implement the host-side architecture without accepting third-party packages yet:

1. Add an internal `AuxExtensionManifest` type.
2. Add an extension-backed `AuxView` adapter.
3. Load a built-in sample extension through the sandbox host.
4. Implement `jamovi.aux.v1` with read-only context, dataset summary, variables, selected analysis, notifications, and storage.
5. Move one simple built-in auxiliary view onto the extension path.
6. Later, move the Module Library to the privileged built-in extension path once the host is proven.

