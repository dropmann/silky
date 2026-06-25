import type Instance from '../instance';
import type { IModuleMeta } from '../modules';
import Notify from '../notification';
import MsgDialog from '../../common/msgdialog';
import { AuxView } from './types';
import type { AuxTranslate } from './types';

type ModuleInstallState = {
    source: string;
    progress: [number, number];
    percent: number;
};

export default class ModulesAuxView extends AuxView {
    model: Instance;
    tabsElement: HTMLDivElement | null = null;
    searchElement: HTMLInputElement | null = null;
    listElement: HTMLDivElement | null = null;
    installStates = new Map<string, ModuleInstallState>();
    renderVersion = 0;
    selectedTab: 'installed' | 'available' = 'installed';
    searchTerm = '';

    constructor(t: AuxTranslate, model: Instance) {
        super('modules', t);
        this.model = model;
    }

    getTitle() { return this.t('Module Library'); }

    getIconSvg() { return `
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="4" width="6" height="6" rx="1" />
                <rect x="14" y="4" width="6" height="6" rx="1" />
                <rect x="4" y="14" width="6" height="6" rx="1" />
                <path d="M17 13v8" />
                <path d="M13 17h8" />
            </svg>
        `; }

    getBody() {
        const body = document.createElement('div');

        const tabs = document.createElement('div');
        tabs.className = 'aux-module-tabs';

        const installedTab = this.createTabButton(this.t('Installed'), 'installed');
        const availableTab = this.createTabButton(this.t('Available'), 'available');
        tabs.append(installedTab, availableTab);

        const searchBox = document.createElement('div');
        searchBox.className = 'aux-module-searchbox';

        const searchIcon = document.createElement('div');
        searchIcon.className = 'aux-module-search-icon';

        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'aux-module-search-input';
        search.spellcheck = true;
        search.placeholder = this.t('Search');
        search.setAttribute('aria-label', this.selectedTab === 'available'
            ? this.t('Search available modules')
            : this.t('Search installed modules'));
        search.addEventListener('input', () => {
            this.searchTerm = search.value;
            void this.update();
        });

        searchBox.append(searchIcon, search);

        const list = document.createElement('div');
        list.className = 'aux-panel-list';

        body.append(tabs, searchBox, list);

        this.tabsElement = tabs;
        this.searchElement = search;
        this.listElement = list;

        return body;
    }

    createTabButton(label: string, tab: 'installed' | 'available') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'aux-module-tab';
        button.textContent = label;
        button.dataset.tab = tab;
        button.setAttribute('aria-pressed', this.selectedTab === tab ? 'true' : 'false');
        button.classList.toggle('active', this.selectedTab === tab);
        button.addEventListener('click', () => {
            this.selectedTab = tab;
            this.updateTabState();
            void this.update();
        });
        return button;
    }

    onMount(): void {
        const modules = this.model.modules();
        const available = modules.available();

        modules.on('change:modules', this.update, this);
        modules.on('modulesChanged', this.update, this);
        modules.on('moduleVisibilityChanged', this.update, this);
        available.on('change:modules', this.update, this);
        available.on('change:status', this.update, this);
        available.on('change:progress', this.update, this);

        this.update();
    }

    onShow(): void {
        this.model.modules().available().retrieve();
        this.updateTabState();
        this.update();
    }

    createListItem(text: string) {
        const item = document.createElement('div');
        item.className = 'aux-panel-list-item';
        item.textContent = text;
        return item;
    }

    createDescriptionContent(text: string): DocumentFragment {
        const template = document.createElement('template');
        template.innerHTML = text;

        const fragment = document.createDocumentFragment();
        this.appendSanitizedDescriptionNodes(fragment, Array.from(template.content.childNodes));
        return fragment;
    }

    appendSanitizedDescriptionNodes(target: DocumentFragment | HTMLElement, nodes: ChildNode[]): void {
        for (const node of nodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                target.append(this.createLinkedTextContent(node.textContent || ''));
                continue;
            }

            if (! (node instanceof HTMLElement))
                continue;

            if (node.tagName === 'A') {
                const href = node.getAttribute('href') || '';
                const safeHref = this.safeDescriptionUrl(href);
                if (safeHref === null) {
                    target.append(this.createLinkedTextContent(node.textContent || ''));
                    continue;
                }

                const link = document.createElement('a');
                link.href = safeHref;
                link.textContent = node.textContent || safeHref;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                target.append(link);
                continue;
            }

            this.appendSanitizedDescriptionNodes(target, Array.from(node.childNodes));
        }
    }

    createLinkedTextContent(text: string): DocumentFragment {
        const fragment = document.createDocumentFragment();
        const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/gi;

        let lastIndex = 0;
        let match: RegExpExecArray | null = null;
        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIndex)
                fragment.append(text.slice(lastIndex, match.index));

            const label = match[1] || match[3];
            const href = match[2] || match[3];
            const safeHref = this.safeDescriptionUrl(href);
            if (safeHref === null) {
                fragment.append(match[0]);
            }
            else {
                const link = document.createElement('a');
                link.href = safeHref;
                link.textContent = label;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                fragment.append(link);
            }

            lastIndex = pattern.lastIndex;
        }

        if (lastIndex < text.length)
            fragment.append(text.slice(lastIndex));

        return fragment;
    }

    safeDescriptionUrl(value: string): string | null {
        try {
            const url = new URL(value);
            if (url.protocol !== 'http:' && url.protocol !== 'https:')
                return null;
            return url.toString();
        }
        catch {
            return null;
        }
    }

    async update(): Promise<void> {
        if (this.listElement === null)
            return;

        const renderVersion = ++this.renderVersion;

        const modules = this.model.modules();
        const available = modules.available();

        const installedModules = modules.get('modules') || [];
        const availableModules = available.get('modules') || [];

        const nextListContent = document.createDocumentFragment();

        if (this.selectedTab === 'installed') {
            const installedSection = document.createElement('div');
            installedSection.className = 'aux-module-section';

            const featuredModules = installedModules
                .filter(module => this.moduleMatchesSearch(module))
                .slice()
                .sort((left, right) => left.title.localeCompare(right.title));

            for (const module of featuredModules) {
                if (renderVersion !== this.renderVersion)
                    return;
                installedSection.append(await this.createModuleCard(module, false));
            }

            if (featuredModules.length === 0)
                installedSection.append(this.createListItem(this.t('No installed modules found.')));

            nextListContent.append(installedSection);
        }
        else {
            const availableSection = document.createElement('div');
            availableSection.className = 'aux-module-section';

            const featuredAvailable = availableModules
                .filter(module => ! installedModules.some(installed => installed.name === module.name))
                .filter(module => this.moduleMatchesSearch(module))
                .slice()
                .sort((left, right) => left.title.localeCompare(right.title));

            for (const module of featuredAvailable) {
                if (renderVersion !== this.renderVersion)
                    return;
                availableSection.append(await this.createModuleCard(module, true));
            }

            if (featuredAvailable.length === 0)
                availableSection.append(this.createListItem(this.t('No additional modules available right now.')));

            nextListContent.append(availableSection);
        }

        if (renderVersion !== this.renderVersion)
            return;

        this.listElement.replaceChildren(nextListContent);
    }

    updateTabState(): void {
        if (this.tabsElement === null)
            return;

        this.tabsElement.querySelectorAll<HTMLButtonElement>('.aux-module-tab').forEach(button => {
            const active = button.dataset.tab === this.selectedTab;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        if (this.searchElement)
            this.searchElement.setAttribute('aria-label', this.selectedTab === 'available'
                ? this.t('Search available modules')
                : this.t('Search installed modules'));
    }

    moduleMatchesSearch(module: IModuleMeta): boolean {
        const rawSearch = this.searchTerm.trim().toLowerCase();
        if (rawSearch === '')
            return true;

        if (rawSearch.startsWith('module::')) {
            const term = rawSearch.substring(8).trim();
            return term === '' || module.name.toLowerCase().startsWith(term);
        }

        if (rawSearch.startsWith('plot::')) {
            const term = rawSearch.substring(6).trim();
            const hasPlots = module.category === 'plots' || module.analyses.some(analysis => analysis.category === 'plots');
            if (! hasPlots)
                return false;
            return term === '' || module.name.toLowerCase().startsWith(term);
        }

        const haystack = [
            module.name,
            module.title,
            module.description,
            module.category,
            ...module.authors,
            ...module.analyses.map(analysis => analysis.title),
            ...module.analyses.map(analysis => analysis.menuTitle),
            ...module.analyses.map(analysis => analysis.menuSubtitle),
        ]
            .filter(value => value)
            .join('\n')
            .toLowerCase();

        return haystack.includes(rawSearch);
    }

    async createModuleCard(module: IModuleMeta, installable: boolean): Promise<HTMLElement> {
        const translator = await module.getTranslator;
        const installState = this.installStates.get(module.name);
        const isInstalling = installState !== undefined;
        const canInstall = installable && (module.ops.includes('install') || module.ops.includes('update'));

        const card = document.createElement('div');
        card.className = 'aux-panel-placeholder aux-module-card';
        card.dataset.moduleName = module.name;

        const header = document.createElement('div');
        header.className = 'aux-module-header';

        const icon = document.createElement('div');
        icon.className = 'aux-module-icon';
        icon.setAttribute('aria-hidden', 'true');

        const title = document.createElement('div');
        title.className = 'aux-module-title';
        title.textContent = translator(module.title);
        header.append(icon, title);

        const meta = document.createElement('div');
        meta.className = 'aux-module-meta';
        const description = translator(module.description).trim();
        if (description) {
            meta.append(this.createDescriptionContent(description));
            meta.title = description;
            meta.tabIndex = 0;
            meta.setAttribute('role', 'button');
            meta.setAttribute('aria-expanded', 'false');
            const toggleExpanded = () => {
                const expanded = meta.classList.toggle('expanded');
                meta.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            };
            meta.addEventListener('click', event => {
                const target = event.target;
                if (target instanceof HTMLElement && target.closest('a'))
                    return;
                toggleExpanded();
            });
            meta.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ')
                    return;
                event.preventDefault();
                toggleExpanded();
            });
        }
        else {
            meta.textContent = this.t('{analysisCount} analyses', {
                analysisCount: module.analyses.length.toLocaleString(),
            });
        }

        const actions = document.createElement('div');
        actions.className = 'aux-module-actions';
        if (canInstall)
            actions.dataset.role = 'module-actions';

        if (isInstalling && canInstall) {
            actions.append(this.createInstallProgress(installState));
        }
        else if (installable && module.ops.includes('install')) {
            const button = this.createActionButton(
                this.t('Install'),
                () => this.installModule(module), false, 'primary');
            button.dataset.installAction = 'install';
            actions.append(button);
        }

        if (! isInstalling && module.ops.includes('update')) {
            const button = this.createActionButton(
                this.t('Update'),
                () => this.installModule(module), false, 'primary');
            button.dataset.installAction = 'update';
            actions.append(button);
        }

        if (module.ops.includes('remove'))
            actions.append(this.createActionButton(this.t('Remove'), () => this.uninstallModule(module), false, 'subtle'));

        if (module.ops.includes('show') || module.ops.includes('hide')) {
            const label = module.visible ? this.t('Hide') : this.t('Show');
            actions.append(this.createActionButton(label, () => this.toggleVisibility(module), false, 'subtle'));
        }

        if (! isInstalling) {
            if (module.ops.includes('installed'))
                actions.append(this.createStatusChip(this.t('Installed')));
            if (module.ops.includes('unavailable'))
                actions.append(this.createStatusChip(this.t('Unavailable'), 'warning'));
            if (module.ops.includes('old'))
                actions.append(this.createStatusChip(this.t('Requires newer jamovi'), 'warning'));
            if (module.ops.includes('incompatible'))
                actions.append(this.createStatusChip(this.t('Needs update'), 'warning'));
        }

        const analyses = installable
            ? this.createAvailableAnalyses(module, translator)
            : this.createInstalledAnalyses(module, translator);

        card.append(header, meta);
        if (actions.childElementCount > 0)
            card.append(actions);
        if (analyses.childElementCount > 0)
            card.append(analyses);

        return card;
    }

    createAvailableAnalyses(module: IModuleMeta, translator: (value: string) => string): HTMLDivElement {
        const analyses = document.createElement('div');
        analyses.className = 'aux-module-analyses';
        for (const analysis of module.analyses.slice(0, 4)) {
            const label = translator(analysis.menuTitle || analysis.title);
            analyses.append(this.createActionButton(label, () => this.runAnalysis(module, analysis.name, analysis.title), true));
        }
        return analyses;
    }

    createInstalledAnalyses(module: IModuleMeta, translator: (value: string) => string): HTMLElement {
        const details = document.createElement('details');
        details.className = 'aux-module-analyses-list';

        const summary = document.createElement('summary');
        summary.className = 'aux-module-analyses-summary';
        summary.textContent = this.t('Analyses ({count})', {
            count: module.analyses.length.toLocaleString(),
        });

        const list = document.createElement('div');
        list.className = 'aux-module-analyses-items';

        for (const analysis of module.analyses) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'aux-module-analysis-link';
            button.textContent = translator(analysis.menuTitle || analysis.title);
            button.addEventListener('click', () => this.runAnalysis(module, analysis.name, analysis.title));
            list.append(button);
        }

        details.append(summary, list);
        return details;
    }

    createActionButton(label: string, action: () => void, secondary = false, emphasis: 'default' | 'primary' | 'subtle' = 'default'): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = secondary ? 'aux-module-analysis-button' : 'aux-module-action-button';
        button.dataset.emphasis = emphasis;
        const icon = this.createActionIcon(label, secondary);
        if (icon)
            button.append(icon);

        const text = document.createElement('span');
        text.className = 'aux-module-action-label';
        text.textContent = label;
        button.append(text);
        button.addEventListener('click', action);
        return button;
    }

    createActionIcon(label: string, secondary: boolean): HTMLSpanElement | null {
        if (secondary)
            return null;

        const icon = document.createElement('span');
        icon.className = 'aux-module-action-icon';

        let svg = '';
        switch (label) {
            case this.t('Install'):
            case this.t('Update'):
                svg = `
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M8 3v6" />
                        <path d="M5.5 6.5 8 9l2.5-2.5" />
                        <path d="M3.5 12.5h9" />
                    </svg>`;
                break;
            case this.t('Remove'):
                svg = `
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3.5 4.5h9" />
                        <path d="M6.5 2.5h3" />
                        <path d="M5 4.5v8" />
                        <path d="M11 4.5v8" />
                        <path d="M4.5 4.5l.5 8h6l.5-8" />
                    </svg>`;
                break;
            case this.t('Hide'):
                svg = `
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M2 8s2.2-3 6-3 6 3 6 3-2.2 3-6 3-6-3-6-3Z" />
                        <path d="M6.8 7.9a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0Z" />
                        <path d="M3 13 13 3" />
                    </svg>`;
                break;
            case this.t('Show'):
                svg = `
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M2 8s2.2-3 6-3 6 3 6 3-2.2 3-6 3-6-3-6-3Z" />
                        <path d="M6.8 7.9a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0Z" />
                    </svg>`;
                break;
        }

        if (svg === '')
            return null;

        icon.innerHTML = svg;
        return icon;
    }

    createStatusChip(label: string, tone: 'default' | 'warning' = 'default'): HTMLSpanElement {
        const chip = document.createElement('span');
        chip.className = 'aux-module-status-chip';
        chip.dataset.tone = tone;
        chip.textContent = label;
        return chip;
    }

    createInstallProgress(state: ModuleInstallState): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.className = 'aux-module-progress-wrap';
        wrap.dataset.role = 'install-progress';

        const progressText = document.createElement('div');
        progressText.className = 'aux-module-progress-text';
        progressText.textContent = this.t('Installing');

        const progressBar = document.createElement('div');
        progressBar.className = 'aux-module-progress';
        progressBar.setAttribute('role', 'progressbar');
        progressBar.setAttribute('aria-valuemin', '0');
        progressBar.setAttribute('aria-valuemax', '100');
        progressBar.setAttribute('aria-valuenow', state.percent.toString());

        const progressBarFill = document.createElement('div');
        progressBarFill.className = 'aux-module-progress-bar';
        progressBarFill.style.width = `${ state.percent }%`;

        const progressLabel = document.createElement('div');
        progressLabel.className = 'aux-module-progress-label';
        progressLabel.textContent = this.t('{percent}%', { percent: state.percent.toString() });

        progressBar.append(progressBarFill);
        wrap.append(progressText, progressBar, progressLabel);

        return wrap;
    }

    updateInstallCard(module: IModuleMeta): void {
        if (this.listElement === null)
            return;

        const card = this.listElement.querySelector<HTMLElement>(`.aux-module-card[data-module-name="${ module.name }"]`);
        if (card === null)
            return;

        const installState = this.installStates.get(module.name);
        const isInstalling = installState !== undefined;
        const actions = card.querySelector<HTMLElement>('[data-role="module-actions"]');
        if (actions === null)
            return;

        if (isInstalling) {
            actions.replaceChildren(this.createInstallProgress(installState));
            return;
        }

        const source = module.url || module.path;
        if (! source)
            return;

        actions.replaceChildren();

        if (module.ops.includes('install')) {
            const button = this.createActionButton(this.t('Install'), () => this.installModule(module), false, 'primary');
            button.dataset.installAction = 'install';
            actions.append(button);
        }

        if (module.ops.includes('update')) {
            const button = this.createActionButton(this.t('Update'), () => this.installModule(module), false, 'primary');
            button.dataset.installAction = 'update';
            actions.append(button);
        }
    }

    installModule(module: IModuleMeta): void {
        const source = module.url || module.path;
        if (! source)
            return;

        this.installStates.set(module.name, {
            source,
            progress: [ 0, 1 ],
            percent: 0,
        });
        this.updateInstallCard(module);

        void this.model.installModule(source).then(() => {
            this.installStates.delete(module.name);
            this.model.modules().available().retrieve();
            this.model.trigger('notification', new Notify({
                title: this.t('Module installed'),
                message: this.t('{module} was installed successfully', { module: module.title }),
                duration: 3000,
                type: 'success'
            }));
            this.update();
        }, error => {
            this.installStates.delete(module.name);
            this.model.trigger('notification', new Notify({
                title: this.t('Unable to install module'),
                message: error.cause || error.message || '',
                duration: 4000,
                type: 'error'
            }));
            this.update();
        }, progress => {
            const value = progress?.[0] || 0;
            const total = progress?.[1] || 1;
            const percent = Math.max(0, Math.min(100, Math.round((100 * value) / total)));
            this.installStates.set(module.name, {
                source,
                progress: [ value, total ],
                percent,
            });
            this.updateInstallCard(module);
        });
    }

    uninstallModule(module: IModuleMeta): void {
        void MsgDialog.show(this.t('Really uninstall {module}?', { module: module.title }), {
            cancel: this.t('Cancel'),
            ok: this.t('OK')
        }).then(result => {
            if (result.action !== 'ok')
                return;

            return this.model.modules().uninstall(module.name).then(() => {
                this.model.trigger('notification', new Notify({
                    title: this.t('Module uninstalled'),
                    message: this.t('{module} was uninstalled successfully', { module: module.title }),
                    duration: 3000,
                    type: 'success'
                }));
                this.update();
            }, error => {
                this.model.trigger('notification', new Notify({
                    title: this.t('Unable to uninstall module'),
                    message: error.message || '',
                    duration: 4000,
                    type: 'error'
                }));
            });
        });
    }

    toggleVisibility(module: IModuleMeta): void {
        void this.model.modules().toggleModuleVisibility(module.name).then(() => this.update());
    }

    runAnalysis(module: IModuleMeta, analysisName: string, analysisTitle: string): void {
        void module.getTranslator.then(translator => {
            this.model.createAnalysis({
                name: analysisName,
                ns: module.name,
                title: translator(analysisTitle),
            });
        });
    }

    describeModule(module: IModuleMeta): string {
        const hiddenState = module.visible ? this.t('visible') : this.t('hidden');
        return this.t('{title} ({analysisCount} analyses, {hiddenState})', {
            title: module.title,
            analysisCount: module.analyses.length.toLocaleString(),
            hiddenState,
        });
    }

}
