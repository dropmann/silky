import { createAuxExtensionClientScript } from '../extension-client';
import { createSandboxAuxExtensionEntry, type AuxExtensionManifest } from '../extensions';

const manifest: AuxExtensionManifest = {
    type: 'jamovi-aux-extension',
    id: 'dataset-summary-extension',
    name: 'Dataset Summary Extension',
    version: '1.0.0',
    apiVersion: 'jamovi.aux.v1',
    order: 35,
    entrypoint: 'builtin:dataset-summary',
    description: 'Built-in sample extension for proving the auxiliary sandbox host.',
    builtIn: true,
    trusted: false,
    permissions: [
        'read:appContext',
        'read:datasetSummary',
        'read:variables',
        'read:selectedVariable',
        'read:analyses',
        'read:selectedAnalysis',
        'ui:notifications',
    ],
    network: {
        hosts: [],
    },
};

function createDatasetSummaryDocument(): string {
    const clientScript = createAuxExtensionClientScript();
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        :root {
            color-scheme: light;
            font-family: "Segoe UI", system-ui, sans-serif;
            color: #334155;
            background: #f8fafd;
        }

        body {
            margin: 0;
            padding: 14px;
            box-sizing: border-box;
            background: #f8fafd;
        }

        .summary {
            display: grid;
            gap: 12px;
        }

        .title {
            margin: 0;
            font-size: 15px;
            line-height: 1.25;
            color: #1e3a5f;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }

        .stat,
        .selected-variable,
        .selected-analysis,
        .variable-list li {
            border: 1px solid #d7dde5;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.9);
        }

        .stat {
            padding: 9px 10px;
        }

        .stat span {
            display: block;
            font-size: 10px;
            line-height: 1.2;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            color: #64748b;
        }

        .stat strong {
            display: block;
            margin-top: 4px;
            font-size: 17px;
            line-height: 1.1;
            color: #0f172a;
        }

        .state {
            border: 1px dashed #c3cbd5;
            border-radius: 8px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.72);
            font-size: 12px;
            line-height: 1.45;
        }

        .variables {
            display: grid;
            gap: 6px;
        }

        .selected-variable {
            display: grid;
            gap: 3px;
            padding: 8px 10px;
            font-size: 11px;
            line-height: 1.35;
        }

        .selected-variable span,
        .selected-analysis span {
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }

        .selected-variable strong,
        .selected-analysis strong {
            min-width: 0;
            overflow-wrap: anywhere;
            color: #1e293b;
        }

        .selected-analysis {
            display: grid;
            gap: 3px;
            padding: 8px 10px;
            font-size: 11px;
            line-height: 1.35;
        }

        .variables h2 {
            margin: 0;
            font-size: 12px;
            line-height: 1.25;
            color: #334155;
        }

        .variable-list {
            display: grid;
            gap: 4px;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .variable-list li {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            padding: 6px 8px;
            font-size: 11px;
            line-height: 1.3;
        }

        .variable-list span:first-child {
            min-width: 0;
            overflow-wrap: anywhere;
            color: #1e293b;
            font-weight: 600;
        }

        .variable-list span:last-child {
            flex: 0 0 auto;
            color: #64748b;
        }

        button {
            justify-self: start;
            border: 1px solid #d7dde5;
            border-radius: 7px;
            background: rgba(248, 250, 252, 0.98);
            color: #334155;
            padding: 5px 8px;
            font: inherit;
            font-size: 11px;
            cursor: default;
        }

        button:focus {
            outline: 2px solid Highlight;
            outline-offset: 2px;
        }
    </style>
</head>
<body>
    <main class="summary">
        <h1 class="title">Dataset Summary</h1>
        <section class="grid" aria-label="Dataset statistics">
            <div class="stat"><span>Rows</span><strong data-value="rowCount">0</strong></div>
            <div class="stat"><span>Visible rows</span><strong data-value="visibleRowCount">0</strong></div>
            <div class="stat"><span>Columns</span><strong data-value="columnCount">0</strong></div>
            <div class="stat"><span>Active filters</span><strong data-value="activeFilterCount">0</strong></div>
        </section>
        <div class="state" data-role="state">Connecting to jamovi...</div>
        <section class="selected-variable" aria-label="Selected variable">
            <span>Selected variable</span>
            <strong data-role="selected-variable">None</strong>
        </section>
        <section class="selected-analysis" aria-label="Selected analysis">
            <span>Selected analysis</span>
            <strong data-role="selected-analysis">None</strong>
        </section>
        <section class="variables" aria-label="Variable preview">
            <h2 data-role="variable-title">Variables</h2>
            <ul class="variable-list" data-role="variables"></ul>
        </section>
        <button type="button" data-action="notify">Show notification</button>
    </main>
    <script>
${ clientScript }
        (() => {
            const format = value => Number(value || 0).toLocaleString();
            const setValue = (name, value) => {
                const element = document.querySelector('[data-value="' + name + '"]');
                if (element)
                    element.textContent = format(value);
            };

            function renderVariables(variables) {
                const title = document.querySelector('[data-role="variable-title"]');
                const list = document.querySelector('[data-role="variables"]');
                if (! title || ! list)
                    return;

                const displayVariables = variables.filter(variable => variable.isBlank !== true);
                title.textContent = 'Variables (' + format(displayVariables.length) + ')';
                list.replaceChildren();

                for (const variable of displayVariables.slice(0, 5)) {
                    const item = document.createElement('li');
                    const name = document.createElement('span');
                    const meta = document.createElement('span');
                    name.textContent = variable.name;
                    meta.textContent = variable.measureType + ' / ' + variable.dataType;
                    item.append(name, meta);
                    list.append(item);
                }

                if (displayVariables.length > 5) {
                    const item = document.createElement('li');
                    const more = document.createElement('span');
                    more.textContent = '+' + format(displayVariables.length - 5) + ' more';
                    item.append(more, document.createElement('span'));
                    list.append(item);
                }
            }

            async function renderSelectedVariable(jamovi, selection) {
                const element = document.querySelector('[data-role="selected-variable"]');
                if (! element)
                    return;

                const variable = selection && selection.column && selection.column.id !== undefined
                    ? await jamovi.variables.get({ id: selection.column.id })
                    : selection && selection.column;
                const columns = (selection && selection.columns || [])
                    .filter(variable => variable && variable.isBlank !== true);
                if (! variable || variable.isBlank === true) {
                    element.textContent = 'None';
                    return;
                }

                if (columns.length > 1)
                    element.textContent = variable.name + ' - ' + format(columns.length) + ' variables selected';
                else
                    element.textContent = variable.name + ' - row ' + format((selection.row || 0) + 1);
            }

            async function refreshSelectedVariable(jamovi) {
                await renderSelectedVariable(jamovi, await jamovi.variables.getSelected());
                window.jamoviAux.resize();
            }

            function renderSelectedAnalysis(analysis) {
                const element = document.querySelector('[data-role="selected-analysis"]');
                if (! element)
                    return;

                if (! analysis) {
                    element.textContent = 'None';
                    return;
                }

                element.textContent = analysis.title + ' - ' + analysis.ns + '/' + analysis.name;
            }

            async function refreshSelectedAnalysis(jamovi) {
                renderSelectedAnalysis(await jamovi.analyses.getSelected());
                window.jamoviAux.resize();
            }

            async function refreshAnalyses(jamovi) {
                return await jamovi.analyses.list();
            }

            async function refresh(jamovi) {
                const context = await jamovi.context.get();
                const summary = await jamovi.dataset.summary();
                const variables = await jamovi.variables.list();
                const analyses = await refreshAnalyses(jamovi);
                setValue('rowCount', summary.rowCount);
                setValue('visibleRowCount', summary.visibleRowCount);
                setValue('columnCount', summary.columnCount);
                setValue('activeFilterCount', summary.activeFilterCount);
                renderVariables(variables);
                await refreshSelectedVariable(jamovi);
                await refreshSelectedAnalysis(jamovi);

                const state = document.querySelector('[data-role="state"]');
                state.textContent = [
                    context.documentTitle || 'Untitled dataset',
                    summary.filtersVisible ? 'filters visible' : 'filters hidden',
                    summary.computedColumnCount + ' transformed columns',
                    analyses.length + ' analyses',
                    summary.edited ? 'edited' : 'saved',
                ].join(' - ');
                window.jamoviAux.resize();
            }

            void (async () => {
                const jamovi = await window.jamoviAux.connect({ apiVersion: 'jamovi.aux.v1' });
                await refresh(jamovi);
                jamovi.on('shown', () => refresh(jamovi));
                jamovi.on('datasetChanged', () => refresh(jamovi));
                jamovi.on('selectedVariableChanged', () => refreshSelectedVariable(jamovi));
                jamovi.on('selectedAnalysisChanged', () => refreshSelectedAnalysis(jamovi));
                jamovi.on('analysesChanged', () => refresh(jamovi));
                document.querySelector('[data-action="notify"]').addEventListener('click', () => {
                    void jamovi.ui.notify({
                        title: 'Dataset Summary Extension',
                        message: 'The sample iframe extension is connected.',
                        type: 'info',
                    });
                });
            })().catch(error => {
                const state = document.querySelector('[data-role="state"]');
                state.textContent = error.message || 'Unable to connect to jamovi.';
            });
        })();
    <\/script>
</body>
</html>`;
}

export default createSandboxAuxExtensionEntry(manifest, createDatasetSummaryDocument);
