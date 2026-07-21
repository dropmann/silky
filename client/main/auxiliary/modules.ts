import type Instance from '../instance';
import type { IModuleMeta } from '../modules';
import Notify from '../notification';
import Version from '../utils/version';
import { AuxView } from './types';
import type { AuxTranslate } from './types';

type ModuleOp = IModuleMeta['ops'][number];

type ModuleInstallState = {
    source: string;
    progress: [number, number];
    percent: number;
    cancelRequested: boolean;
};

type ModuleCardState = {
    module: IModuleMeta;
    installable: boolean;
    installedInLibrary: boolean;
};

export default class ModulesAuxView extends AuxView {
    model: Instance;
    tabsElement: HTMLDivElement | null = null;
    searchElement: HTMLInputElement | null = null;
    summaryProgressElement: HTMLDivElement | null = null;
    listElement: HTMLDivElement | null = null;
    installStates = new Map<string, ModuleInstallState>();
    cancelledInstallSources = new Set<string>();
    pendingInstalledRemovals = new Set<string>();
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
        body.className = 'aux-module-view';

        const controls = document.createElement('div');
        controls.className = 'aux-module-controls';

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

        const summaryProgress = document.createElement('div');
        summaryProgress.className = 'aux-module-summary-progress';
        summaryProgress.setAttribute('aria-hidden', 'true');

        const list = document.createElement('div');
        list.className = 'aux-panel-list aux-module-list';

        controls.append(tabs, searchBox, summaryProgress);
        body.append(controls, list);

        this.tabsElement = tabs;
        this.searchElement = search;
        this.summaryProgressElement = summaryProgress;
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

    createDescriptionContent(text: string, highlightTerm = ''): DocumentFragment {
        const template = document.createElement('template');
        template.innerHTML = text;

        const fragment = document.createDocumentFragment();
        this.appendSanitizedDescriptionNodes(fragment, Array.from(template.content.childNodes), highlightTerm);
        return fragment;
    }

    appendSanitizedDescriptionNodes(target: DocumentFragment | HTMLElement, nodes: ChildNode[], highlightTerm = ''): void {
        for (const node of nodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                target.append(this.createLinkedTextContent(node.textContent || '', highlightTerm));
                continue;
            }

            if (! (node instanceof HTMLElement))
                continue;

            if (node.tagName === 'A') {
                const href = node.getAttribute('href') || '';
                const safeHref = this.safeDescriptionUrl(href);
                if (safeHref === null) {
                    target.append(this.createLinkedTextContent(node.textContent || '', highlightTerm));
                    continue;
                }

                const link = document.createElement('a');
                link.href = safeHref;
                link.append(this.createHighlightedTextContent(node.textContent || safeHref, highlightTerm));
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                target.append(link);
                continue;
            }

            this.appendSanitizedDescriptionNodes(target, Array.from(node.childNodes), highlightTerm);
        }
    }

    createLinkedTextContent(text: string, highlightTerm = ''): DocumentFragment {
        const fragment = document.createDocumentFragment();
        const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/gi;

        let lastIndex = 0;
        let match: RegExpExecArray | null = null;
        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIndex)
                fragment.append(this.createHighlightedTextContent(text.slice(lastIndex, match.index), highlightTerm));

            const label = match[1] || match[3];
            const href = match[2] || match[3];
            const safeHref = this.safeDescriptionUrl(href);
            if (safeHref === null) {
                fragment.append(this.createHighlightedTextContent(match[0], highlightTerm));
            }
            else {
                const link = document.createElement('a');
                link.href = safeHref;
                link.append(this.createHighlightedTextContent(label, highlightTerm));
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                fragment.append(link);
            }

            lastIndex = pattern.lastIndex;
        }

        if (lastIndex < text.length)
            fragment.append(this.createHighlightedTextContent(text.slice(lastIndex), highlightTerm));

        return fragment;
    }

    createHighlightedTextContent(text: string, highlightTerm = ''): DocumentFragment {
        const fragment = document.createDocumentFragment();
        const term = highlightTerm.trim();
        if (term === '') {
            fragment.append(text);
            return fragment;
        }

        const lowerText = text.toLocaleLowerCase();
        const lowerTerm = term.toLocaleLowerCase();
        let index = 0;

        while (index < text.length) {
            const matchIndex = lowerText.indexOf(lowerTerm, index);
            if (matchIndex === -1)
                break;

            if (matchIndex > index)
                fragment.append(text.slice(index, matchIndex));

            const highlight = document.createElement('span');
            highlight.className = 'aux-module-search-highlight';
            highlight.textContent = text.slice(matchIndex, matchIndex + term.length);
            fragment.append(highlight);
            index = matchIndex + term.length;
        }

        if (index < text.length)
            fragment.append(text.slice(index));

        return fragment;
    }

    getSearchHighlightTerm(): string {
        const rawSearch = this.searchTerm.trim();
        const lowerSearch = rawSearch.toLocaleLowerCase();
        if (lowerSearch.startsWith('module::'))
            return rawSearch.substring(8).trim();
        if (lowerSearch.startsWith('plot::'))
            return rawSearch.substring(6).trim();
        return rawSearch;
    }

    expandDescriptionForHiddenHighlight(meta: HTMLElement): void {
        if (meta.querySelector('.aux-module-search-highlight') === null)
            return;

        requestAnimationFrame(() => {
            if (! meta.isConnected || meta.classList.contains('expanded'))
                return;

            if (meta.scrollHeight <= meta.clientHeight + 1)
                return;

            const metaRect = meta.getBoundingClientRect();
            const highlights = Array.from(meta.querySelectorAll<HTMLElement>('.aux-module-search-highlight'));
            const highlightIsHidden = highlights.some(highlight => {
                const rect = highlight.getBoundingClientRect();
                return rect.top < metaRect.top - 1 || rect.bottom > metaRect.bottom + 1;
            });

            if (! highlightIsHidden)
                return;

            meta.classList.add('expanded');
            meta.setAttribute('aria-expanded', 'true');
        });
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
        const installedModules = this.getInstalledModules();
        const availableModules = this.getAvailableModules();
        this.updateSummaryProgress(installedModules, availableModules);

        let cards: ModuleCardState[];
        let emptyMessage: string;

        if (this.selectedTab === 'installed') {
            const featuredModules = installedModules
                .filter(module => this.moduleMatchesSearch(module))
                .slice()
                .sort((left, right) => left.title.localeCompare(right.title));

            cards = featuredModules.map(module => ({
                module,
                installable: false,
                installedInLibrary: false,
            }));
            emptyMessage = this.t('No installed modules found.');
        }
        else {
            const featuredAvailable = availableModules
                .map(module => this.getAvailableListModule(module, installedModules))
                .filter(module => this.moduleMatchesSearch(module))
                .slice()
                .sort((left, right) => left.title.localeCompare(right.title));

            cards = featuredAvailable.map(module => ({
                module,
                installable: true,
                installedInLibrary: installedModules.some(installed => installed.name === module.name),
            }));
            emptyMessage = this.t('No additional modules available right now.');
        }

        if (renderVersion !== this.renderVersion)
            return;

        await this.updateModuleSection(cards, emptyMessage, renderVersion);
    }

    async updateModuleSection(cards: ModuleCardState[], emptyMessage: string, renderVersion: number): Promise<void> {
        if (this.listElement === null || renderVersion !== this.renderVersion)
            return;

        let section = this.listElement.querySelector<HTMLElement>(':scope > .aux-module-section');
        const preserveScroll = section !== null && section.dataset.tab === this.selectedTab;
        const scrollAnchor = preserveScroll ? this.captureListScrollAnchor(section) : null;
        if (! preserveScroll) {
            section = document.createElement('div');
            section.className = 'aux-module-section';
            section.dataset.tab = this.selectedTab;
            this.listElement.replaceChildren(section);
        }

        const currentCards = Array.from(section.querySelectorAll<HTMLElement>(':scope > .aux-module-card[data-module-name]'));
        const nextModuleNames = new Set(cards.map(card => card.module.name));
        const removedCards = currentCards.filter(card => {
            const moduleName = card.dataset.moduleName;
            return moduleName !== undefined
                && this.selectedTab === 'installed'
                && ! nextModuleNames.has(moduleName)
                && this.pendingInstalledRemovals.has(moduleName);
        });

        if (removedCards.length > 0 && ! this.prefersReducedMotion())
            await this.animateCardRemoval(removedCards);

        if (renderVersion !== this.renderVersion)
            return;

        const currentCardsByName = new Map<string, HTMLElement[]>();
        for (const card of currentCards) {
            const moduleName = card.dataset.moduleName;
            if (moduleName === undefined)
                continue;

            const cardsForName = currentCardsByName.get(moduleName) || [];
            cardsForName.push(card);
            currentCardsByName.set(moduleName, cardsForName);
        }

        const emptyItem = section.querySelector<HTMLElement>(':scope > [data-role="module-empty"]');

        if (cards.length === 0) {
            for (const card of currentCards)
                card.remove();

            const item = emptyItem || this.createListItem(emptyMessage);
            item.dataset.role = 'module-empty';
            item.textContent = emptyMessage;
            if (item.parentElement !== section)
                section.append(item);

            this.restoreListScrollAnchor(section, scrollAnchor, renderVersion);
            for (const card of removedCards) {
                if (card.dataset.moduleName !== undefined)
                    this.pendingInstalledRemovals.delete(card.dataset.moduleName);
            }
            return;
        }

        emptyItem?.remove();

        const usedCards = new Set<HTMLElement>();
        for (const [ index, state ] of cards.entries()) {
            if (renderVersion !== this.renderVersion)
                return;

            const cardsForName = currentCardsByName.get(state.module.name) || [];
            const reusableCardIndex = cardsForName.findIndex(card => this.canReuseModuleCard(card, state.installable));
            let card: HTMLElement | undefined;
            if (reusableCardIndex !== -1) {
                card = cardsForName[reusableCardIndex];
                cardsForName.splice(reusableCardIndex, 1);
            }

            if (card === undefined)
                card = this.createModuleCardShell(state.module.name, state.installable);

            usedCards.add(card);

            await this.updateModuleCard(card, state.module, state.installable, state.installedInLibrary, renderVersion);
            if (renderVersion !== this.renderVersion)
                return;

            const nextChild = section.children[index] ?? null;
            if (nextChild !== card)
                section.insertBefore(card, nextChild);
        }

        for (const card of currentCards) {
            if (! usedCards.has(card))
                card.remove();
        }
        this.restoreListScrollAnchor(section, scrollAnchor, renderVersion);

        for (const card of removedCards) {
            if (card.dataset.moduleName !== undefined)
                this.pendingInstalledRemovals.delete(card.dataset.moduleName);
        }
    }

    canReuseModuleCard(card: HTMLElement, installable: boolean): boolean {
        return card.classList.contains('available-in-library') === installable;
    }

    captureListScrollAnchor(section: HTMLElement): { moduleName: string; offset: number; scrollTop: number } | null {
        if (this.listElement === null)
            return null;

        const listRect = this.listElement.getBoundingClientRect();
        const cards = Array.from(section.querySelectorAll<HTMLElement>(':scope > .aux-module-card[data-module-name]'));
        for (const card of cards) {
            const cardRect = card.getBoundingClientRect();
            if (cardRect.bottom < listRect.top)
                continue;

            const moduleName = card.dataset.moduleName;
            if (moduleName === undefined)
                continue;

            return {
                moduleName,
                offset: cardRect.top - listRect.top,
                scrollTop: this.listElement.scrollTop,
            };
        }

        return {
            moduleName: '',
            offset: 0,
            scrollTop: this.listElement.scrollTop,
        };
    }

    restoreListScrollAnchor(section: HTMLElement, anchor: { moduleName: string; offset: number; scrollTop: number } | null, renderVersion: number): void {
        if (this.listElement === null || anchor === null || renderVersion !== this.renderVersion)
            return;

        if (anchor.moduleName === '') {
            this.listElement.scrollTop = anchor.scrollTop;
            return;
        }

        const card = section.querySelector<HTMLElement>(`:scope > .aux-module-card[data-module-name="${ CSS.escape(anchor.moduleName) }"]`);
        if (card === null) {
            this.listElement.scrollTop = anchor.scrollTop;
            return;
        }

        const listRect = this.listElement.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        this.listElement.scrollTop += cardRect.top - listRect.top - anchor.offset;
    }

    prefersReducedMotion(): boolean {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    }

    animateCardRemoval(cards: HTMLElement[]): Promise<void> {
        return new Promise(resolve => {
            for (const card of cards) {
                card.style.height = `${ card.offsetHeight }px`;
                card.style.overflow = 'hidden';
                card.style.boxSizing = 'border-box';
            }

            requestAnimationFrame(() => {
                for (const card of cards)
                    card.classList.add('removing');

                window.setTimeout(resolve, 260);
            });
        });
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

    getInstalledModules(): IModuleMeta[] {
        return this.model.modules().get('modules') || [];
    }

    getAvailableModules(): IModuleMeta[] {
        return this.model.modules().available().get('modules') || [];
    }

    getAvailableListModule(module: IModuleMeta, installedModules: IModuleMeta[]): IModuleMeta {
        const installedModule = installedModules.find(installed => installed.name === module.name);
        if (installedModule === undefined)
            return module;

        const ops: ModuleOp[] = [];
        if (module.ops.includes('old') || module.ops.includes('unavailable')) {
            ops.push(...module.ops.filter(op => op === 'old' || op === 'unavailable'));
        }
        else if (installedModule.incompatible) {
            if (module.url !== '' && module.version >= installedModule.version)
                ops.push('update');
            ops.push('incompatible');
        }
        else if (module.version > installedModule.version && module.url !== '') {
            ops.push('update');
        }
        else {
            ops.push('installed');
        }

        if (installedModule.ops.includes('remove'))
            ops.push('remove');

        return {
            ...module,
            isSystem: installedModule.isSystem,
            visible: installedModule.visible,
            incompatible: installedModule.incompatible,
            ops: [ ...new Set(ops) ],
        };
    }

    getVisibleModules(installedModules = this.getInstalledModules(), availableModules = this.getAvailableModules()): IModuleMeta[] {
        if (this.selectedTab === 'installed')
            return installedModules
                .filter(module => this.moduleMatchesSearch(module))
                .slice()
                .sort((left, right) => left.title.localeCompare(right.title));

        return availableModules
            .map(module => this.getAvailableListModule(module, installedModules))
            .filter(module => this.moduleMatchesSearch(module))
            .slice()
            .sort((left, right) => left.title.localeCompare(right.title));
    }

    updateSummaryProgress(installedModules = this.getInstalledModules(), availableModules = this.getAvailableModules()): void {
        if (this.summaryProgressElement === null)
            return;

        const activeInstalls = [ ...this.installStates.values() ];
        if (activeInstalls.length === 0) {
            const updateableModules = this.getVisibleModules(installedModules, availableModules)
                .filter(module => module.ops.includes('update'))
                .filter(module => ! this.installStates.has(module.name));

            if (updateableModules.length > 0) {
                const button = this.createActionButton(
                    this.t('Update all ({count})', { count: updateableModules.length.toString() }),
                    () => this.updateAll(updateableModules),
                    false,
                    'primary');
                button.classList.add('aux-module-summary-action');
                this.summaryProgressElement.classList.add('active');
                this.summaryProgressElement.setAttribute('aria-hidden', 'false');
                this.summaryProgressElement.replaceChildren(button);
                return;
            }

            this.summaryProgressElement.classList.remove('active');
            this.summaryProgressElement.setAttribute('aria-hidden', 'true');
            this.summaryProgressElement.replaceChildren();
            return;
        }

        const totalValue = activeInstalls.reduce((sum, state) => sum + state.progress[0], 0);
        const totalMax = activeInstalls.reduce((sum, state) => sum + state.progress[1], 0);
        const percent = totalMax > 0
            ? Math.max(0, Math.min(100, Math.round((100 * totalValue) / totalMax)))
            : 0;
        const allCancelling = activeInstalls.every(state => state.cancelRequested);

        const summaryState: ModuleInstallState = {
            source: '',
            progress: [ totalValue, totalMax ],
            percent,
            cancelRequested: allCancelling,
        };
        const summaryText = activeInstalls.length === 1
            ? this.t('Installing 1 module')
            : this.t('Installing {count} modules', { count: activeInstalls.length.toString() });

        this.summaryProgressElement.classList.add('active');
        this.summaryProgressElement.setAttribute('aria-hidden', 'false');
        const existingWrap = this.summaryProgressElement.querySelector<HTMLElement>('.aux-module-progress-wrap-summary');
        if (existingWrap !== null) {
            this.updateInstallProgress(existingWrap, summaryState, summaryText);
            return;
        }

        const wrap = this.createInstallProgress(summaryState, {
            text: summaryText,
            className: 'aux-module-progress-wrap aux-module-progress-wrap-summary',
            cancelAction: () => this.cancelAllInstalls(),
            cancelLabel: this.t('Cancel all'),
        });

        this.summaryProgressElement.replaceChildren(wrap);
    }

    updateAll(modules: IModuleMeta[]): void {
        for (const module of modules)
            this.installModule(module);
    }

    cancelAllInstalls(): void {
        const modulesBySource = new Map<string, IModuleMeta>();
        const availableModules = this.getAvailableModules();
        const installedModules = this.getInstalledModules();
        for (const module of [ ...availableModules, ...installedModules ]) {
            const source = module.url || module.path;
            if (source)
                modulesBySource.set(source, module);
        }

        for (const [ moduleName, state ] of this.installStates) {
            if (state.cancelRequested)
                continue;

            const module = modulesBySource.get(state.source);
            if (module !== undefined) {
                this.cancelInstallModule(module);
                continue;
            }

            this.installStates.set(moduleName, {
                ...state,
                cancelRequested: true,
            });
            this.cancelledInstallSources.add(state.source);
            this.cancelInstallBySource(state.source, error => {
                this.cancelledInstallSources.delete(state.source);
                const currentState = this.installStates.get(moduleName);
                if (currentState !== undefined) {
                    this.installStates.set(moduleName, {
                        ...currentState,
                        cancelRequested: false,
                    });
                }
                this.updateSummaryProgress();
                this.notifyUnableToCancelInstall(error);
            }, () => {
                this.installStates.delete(moduleName);
                this.updateSummaryProgress();
                void this.update();
            });
        }

        this.updateSummaryProgress();
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

    async createModuleCard(module: IModuleMeta, installable: boolean, installedInLibrary = false): Promise<HTMLElement> {
        const card = this.createModuleCardShell(module.name, installable);
        await this.updateModuleCard(card, module, installable, installedInLibrary, this.renderVersion);
        return card;
    }

    createModuleCardShell(moduleName: string, installable: boolean): HTMLElement {
        const card = document.createElement('div');
        card.className = 'aux-panel-placeholder aux-module-card';
        card.dataset.moduleName = moduleName;
        card.classList.toggle('available-in-library', installable);

        const header = document.createElement('div');
        header.className = 'aux-module-header';

        const icon = document.createElement('div');
        icon.className = 'aux-module-icon';
        icon.setAttribute('aria-hidden', 'true');

        const titleWrap = document.createElement('div');
        titleWrap.className = 'aux-module-title-wrap';

        const title = document.createElement('div');
        title.className = 'aux-module-title';

        const name = document.createElement('span');
        name.className = 'aux-module-name';

        const version = document.createElement('span');
        version.className = 'aux-module-version';

        const packageMeta = document.createElement('div');
        packageMeta.className = 'aux-module-package-meta';
        packageMeta.append(name, version);

        titleWrap.append(title, packageMeta);
        header.append(icon, titleWrap);

        const installedBadge = installable
            ? this.createStatusChip(this.t('Installed'))
            : null;
        if (installedBadge !== null) {
            installedBadge.classList.add('aux-module-installed-badge', 'hidden');
            installedBadge.setAttribute('aria-hidden', 'true');
        }

        const meta = document.createElement('div');
        meta.className = 'aux-module-meta';
        this.bindModuleMetaToggle(meta);

        const authors = document.createElement('div');
        authors.className = 'aux-module-authors';
        authors.hidden = true;

        const actions = document.createElement('div');
        actions.className = 'aux-module-actions';
        actions.hidden = true;

        const analyses = document.createElement('div');
        analyses.className = 'aux-module-analyses-host';
        analyses.hidden = true;

        card.append(header);
        if (installedBadge !== null)
            card.append(installedBadge);
        card.append(meta, authors, actions, analyses);

        return card;
    }

    bindModuleMetaToggle(meta: HTMLElement): void {
        const toggleExpanded = () => {
            if (meta.dataset.expandable !== 'true')
                return;

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

    async updateModuleCard(card: HTMLElement, module: IModuleMeta, installable: boolean, installedInLibrary: boolean, renderVersion: number): Promise<void> {
        const translator = await module.getTranslator;
        if (renderVersion !== this.renderVersion)
            return;

        const highlightTerm = this.getSearchHighlightTerm();

        card.dataset.moduleName = module.name;
        card.className = 'aux-panel-placeholder aux-module-card';
        card.classList.toggle('available-in-library', installable);
        card.classList.toggle('installed-in-library', installedInLibrary);

        this.updateModuleCardHeader(card, module, translator, highlightTerm);
        this.updateInstalledBadge(card, module, installable, installedInLibrary);
        this.updateModuleCardDescription(card, module, translator, highlightTerm);
        this.updateModuleCardAuthors(card, module, highlightTerm);
        this.updateModuleCardActions(card, module, installable, installedInLibrary);
        this.updateModuleCardAnalyses(card, module, installable, installedInLibrary, translator, highlightTerm);
    }

    updateModuleCardHeader(card: HTMLElement, module: IModuleMeta, translator: (value: string) => string, highlightTerm: string): void {
        const icon = card.querySelector<HTMLElement>('.aux-module-icon');
        if (icon !== null)
            icon.textContent = this.getModuleInitials(module);

        const title = card.querySelector<HTMLElement>('.aux-module-title');
        if (title !== null)
            title.replaceChildren(this.createHighlightedTextContent(translator(module.title), highlightTerm));

        const name = card.querySelector<HTMLElement>('.aux-module-name');
        if (name !== null)
            name.replaceChildren(this.createHighlightedTextContent(module.name, highlightTerm));

        const version = card.querySelector<HTMLElement>('.aux-module-version');
        if (version !== null)
            version.textContent = `v${ Version.stringify(module.version, 3) }`;
    }

    updateInstalledBadge(card: HTMLElement, module: IModuleMeta, installable: boolean, installedInLibrary: boolean): void {
        let installedBadge = card.querySelector<HTMLElement>('.aux-module-installed-badge');
        if (! installable) {
            installedBadge?.remove();
            return;
        }

        if (installedBadge === null) {
            installedBadge = this.createStatusChip(this.t('Installed'));
            installedBadge.classList.add('aux-module-installed-badge', 'hidden');
            const header = card.querySelector<HTMLElement>('.aux-module-header');
            if (header !== null)
                header.after(installedBadge);
            else
                card.prepend(installedBadge);
        }

        const showInstalledBadge = installedInLibrary && module.ops.includes('installed');
        installedBadge.classList.toggle('hidden', ! showInstalledBadge);
        installedBadge.setAttribute('aria-hidden', showInstalledBadge ? 'false' : 'true');
    }

    updateModuleCardDescription(card: HTMLElement, module: IModuleMeta, translator: (value: string) => string, highlightTerm: string): void {
        const meta = card.querySelector<HTMLElement>('.aux-module-meta');
        if (meta === null)
            return;

        const description = translator(module.description).trim();
        meta.replaceChildren();
        meta.classList.remove('expanded');

        if (description) {
            meta.append(this.createDescriptionContent(description, highlightTerm));
            meta.title = description;
            meta.tabIndex = 0;
            meta.dataset.expandable = 'true';
            meta.setAttribute('role', 'button');
            meta.setAttribute('aria-expanded', 'false');
            this.expandDescriptionForHiddenHighlight(meta);
            return;
        }

        meta.textContent = this.t('{analysisCount} analyses', {
            analysisCount: module.analyses.length.toLocaleString(),
        });
        meta.removeAttribute('title');
        meta.removeAttribute('role');
        meta.removeAttribute('aria-expanded');
        delete meta.dataset.expandable;
        meta.removeAttribute('tabindex');
    }

    updateModuleCardAuthors(card: HTMLElement, module: IModuleMeta, highlightTerm: string): void {
        const authors = card.querySelector<HTMLElement>('.aux-module-authors');
        if (authors === null)
            return;

        const authorList = module.authors.filter(author => author && author.trim() !== '');
        authors.replaceChildren();
        authors.hidden = authorList.length === 0;
        if (authorList.length > 0)
            authors.append(this.createHighlightedTextContent(authorList.join(', '), highlightTerm));
    }

    updateModuleCardActions(card: HTMLElement, module: IModuleMeta, installable: boolean, installedInLibrary: boolean): void {
        const actions = card.querySelector<HTMLElement>('.aux-module-actions');
        if (actions === null)
            return;

        const installState = this.installStates.get(module.name);
        const isInstalling = installState !== undefined;
        const canInstall = installable && (module.ops.includes('install') || module.ops.includes('update'));
        if (canInstall)
            actions.dataset.role = 'module-actions';
        else
            delete actions.dataset.role;

        const signature = [
            installable ? 'installable' : 'installed',
            installedInLibrary ? 'library-installed' : 'direct-list',
            isInstalling ? 'installing' : 'idle',
            module.ops.join(','),
            module.visible ? 'visible' : 'hidden',
        ].join('|');

        if (actions.dataset.signature === signature) {
            if (isInstalling && installState !== undefined) {
                const progressElement = actions.querySelector<HTMLElement>('[data-role="install-progress"]');
                if (progressElement !== null)
                    this.updateInstallProgress(progressElement, installState);
            }
            return;
        }

        actions.dataset.signature = signature;
        actions.replaceChildren();

        if (isInstalling && canInstall) {
            actions.append(this.createInstallProgress(installState, {
                cancelAction: () => this.cancelInstallModule(module),
            }));
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

        if (! installedInLibrary && (module.ops.includes('show') || module.ops.includes('hide'))) {
            const label = module.visible ? this.t('Hide') : this.t('Show');
            actions.append(this.createActionButton(label, () => this.toggleVisibility(module), false, 'subtle'));
        }

        if (! isInstalling) {
            if (module.ops.includes('installed') && ! installedInLibrary)
                actions.append(this.createStatusChip(this.t('Installed')));
            if (module.ops.includes('unavailable'))
                actions.append(this.createStatusChip(this.t('Unavailable'), 'warning'));
            if (module.ops.includes('old'))
                actions.append(this.createStatusChip(this.t('Requires newer jamovi'), 'warning'));
            if (module.ops.includes('incompatible'))
                actions.append(this.createStatusChip(this.t('Needs update'), 'warning'));
        }

        actions.hidden = actions.childElementCount === 0;
    }

    updateModuleCardAnalyses(card: HTMLElement, module: IModuleMeta, installable: boolean, installedInLibrary: boolean, translator: (value: string) => string, highlightTerm: string): void {
        const analysesHost = card.querySelector<HTMLElement>('.aux-module-analyses-host');
        if (analysesHost === null)
            return;

        analysesHost.replaceChildren();

        const analyses = installedInLibrary
            ? null
            : installable
            ? this.createAvailableAnalyses(module, translator, highlightTerm)
            : this.createInstalledAnalyses(module, translator, highlightTerm);

        analysesHost.hidden = analyses === null || analyses.childElementCount === 0;
        if (analyses !== null && analyses.childElementCount > 0)
            analysesHost.append(analyses);
    }

    getModuleInitials(module: IModuleMeta): string {
        const source = module.name.trim();
        const words = source
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .split(/[\s:_-]+/)
            .filter(word => /[A-Za-z0-9]/.test(word));

        if (words.length >= 2)
            return `${ words[0][0] }${ words[1][0] }`.toUpperCase();

        return source.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'J';
    }

    createAvailableAnalyses(module: IModuleMeta, translator: (value: string) => string, highlightTerm = ''): HTMLDivElement {
        const analyses = document.createElement('div');
        analyses.className = 'aux-module-analyses';
        for (const analysis of module.analyses.slice(0, 4)) {
            const label = translator(analysis.menuTitle || analysis.title);
            analyses.append(this.createActionButton(label, () => this.runAnalysis(module, analysis.name, analysis.title), true, 'default', highlightTerm));
        }
        return analyses;
    }

    createInstalledAnalyses(module: IModuleMeta, translator: (value: string) => string, highlightTerm = ''): HTMLElement {
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
            button.append(this.createHighlightedTextContent(translator(analysis.menuTitle || analysis.title), highlightTerm));
            button.addEventListener('click', () => this.runAnalysis(module, analysis.name, analysis.title));
            list.append(button);
        }

        details.append(summary, list);
        return details;
    }

    createActionButton(label: string, action: () => void, secondary = false, emphasis: 'default' | 'primary' | 'subtle' = 'default', highlightTerm = ''): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = secondary ? 'aux-module-analysis-button' : 'aux-module-action-button';
        button.dataset.emphasis = emphasis;
        const icon = this.createActionIcon(label, secondary);
        if (icon)
            button.append(icon);

        const text = document.createElement('span');
        text.className = 'aux-module-action-label';
        text.append(this.createHighlightedTextContent(label, highlightTerm));
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

        if (tone === 'default') {
            const icon = document.createElement('span');
            icon.className = 'aux-module-status-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = '✓';
            chip.append(icon);
        }

        const text = document.createElement('span');
        text.textContent = label;
        chip.append(text);
        return chip;
    }

    createInstallProgress(state: ModuleInstallState, options?: { text?: string; className?: string; cancelAction?: () => void; cancelLabel?: string }): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.className = options?.className || 'aux-module-progress-wrap';
        wrap.dataset.role = 'install-progress';

        const progressText = document.createElement('div');
        progressText.className = 'aux-module-progress-text';
        progressText.textContent = options?.text || (state.cancelRequested ? this.t('Cancelling') : this.t('Installing'));

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

        if (options?.cancelAction !== undefined) {
            const cancelButton = this.createActionButton(
                options.cancelLabel || this.t('Cancel'),
                options.cancelAction,
                false,
                'subtle');
            cancelButton.classList.add('aux-module-progress-cancel');
            cancelButton.disabled = state.cancelRequested;
            wrap.append(cancelButton);
        }

        return wrap;
    }

    updateInstallProgress(progressElement: HTMLElement, state: ModuleInstallState, text?: string): void {
        const progressText = progressElement.querySelector<HTMLElement>('.aux-module-progress-text');
        if (progressText !== null)
            progressText.textContent = text || (state.cancelRequested ? this.t('Cancelling') : this.t('Installing'));

        const progressBar = progressElement.querySelector<HTMLElement>('.aux-module-progress');
        if (progressBar !== null)
            progressBar.setAttribute('aria-valuenow', state.percent.toString());

        const progressBarFill = progressElement.querySelector<HTMLElement>('.aux-module-progress-bar');
        if (progressBarFill !== null)
            progressBarFill.style.width = `${ state.percent }%`;

        const progressLabel = progressElement.querySelector<HTMLElement>('.aux-module-progress-label');
        if (progressLabel !== null)
            progressLabel.textContent = this.t('{percent}%', { percent: state.percent.toString() });

        const cancelButton = progressElement.querySelector<HTMLButtonElement>('.aux-module-progress-cancel');
        if (cancelButton !== null)
            cancelButton.disabled = state.cancelRequested;
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
            const progressElement = actions.querySelector<HTMLElement>('[data-role="install-progress"]');
            if (progressElement !== null) {
                this.updateInstallProgress(progressElement, installState);
                return;
            }

            actions.replaceChildren(this.createInstallProgress(installState, {
                cancelAction: () => this.cancelInstallModule(module),
            }));
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

        this.cancelledInstallSources.delete(source);
        this.installStates.set(module.name, {
            source,
            progress: [ 0, 1 ],
            percent: 0,
            cancelRequested: false,
        });
        this.updateSummaryProgress();
        this.updateInstallCard(module);

        void this.model.installModule(source).then(() => {
            this.cancelledInstallSources.delete(source);
            this.installStates.delete(module.name);
            this.updateSummaryProgress();
            this.model.modules().available().retrieve();
            this.model.trigger('notification', new Notify({
                title: this.t('Module installed'),
                message: this.t('{module} was installed successfully', { module: module.title }),
                duration: 3000,
                type: 'success'
            }));
            this.update();
        }, error => {
            const wasCancelled = this.installStates.get(module.name)?.cancelRequested === true
                || this.cancelledInstallSources.delete(source);
            this.installStates.delete(module.name);
            this.updateSummaryProgress();
            if (! wasCancelled) {
                this.model.trigger('notification', new Notify({
                    title: this.t('Unable to install module'),
                    message: error.cause || error.message || '',
                    duration: 4000,
                    type: 'error'
                }));
            }
            this.update();
        }, progress => {
            const previousState = this.installStates.get(module.name);
            if (previousState === undefined && this.cancelledInstallSources.has(source))
                return;

            const value = progress?.[0] || 0;
            const total = progress?.[1] || 1;
            const percent = Math.max(0, Math.min(100, Math.round((100 * value) / total)));
            this.installStates.set(module.name, {
                source,
                progress: [ value, total ],
                percent,
                cancelRequested: previousState?.cancelRequested === true,
            });
            this.updateSummaryProgress();
            this.updateInstallCard(module);
        });
    }

    cancelInstallModule(module: IModuleMeta): void {
        const installState = this.installStates.get(module.name);
        if (installState === undefined || installState.cancelRequested)
            return;

        this.installStates.set(module.name, {
            ...installState,
            cancelRequested: true,
        });
        this.cancelledInstallSources.add(installState.source);
        this.updateSummaryProgress();
        this.updateInstallCard(module);

        this.cancelInstallBySource(installState.source, error => {
            this.cancelledInstallSources.delete(installState.source);
            const currentState = this.installStates.get(module.name);
            if (currentState !== undefined) {
                this.installStates.set(module.name, {
                    ...currentState,
                    cancelRequested: false,
                });
            }
            this.updateSummaryProgress();
            this.updateInstallCard(module);
            this.notifyUnableToCancelInstall(error);
        }, () => {
            this.installStates.delete(module.name);
            this.updateSummaryProgress();
            this.updateInstallCard(module);
            void this.update();
        });
    }

    cancelInstallBySource(source: string, onError?: (error: any) => void, onSuccess?: () => void): void {
        void this.model.cancelInstallModule(source).then(() => {
            onSuccess?.();
        }, error => {
            if (onError !== undefined) {
                onError(error);
                return;
            }

            this.notifyUnableToCancelInstall(error);
        });
    }

    notifyUnableToCancelInstall(error: any): void {
        this.model.trigger('notification', new Notify({
            title: this.t('Unable to cancel install'),
            message: error.cause || error.message || '',
            duration: 4000,
            type: 'error'
        }));
    }

    uninstallModule(module: IModuleMeta): void {
        if (this.selectedTab === 'installed')
            this.pendingInstalledRemovals.add(module.name);

        void this.model.modules().uninstall(module.name).then(() => {
            this.model.trigger('notification', new Notify({
                title: this.t('Module uninstalled'),
                message: this.t('{module} was uninstalled successfully', { module: module.title }),
                duration: 3000,
                type: 'success'
            }));
            this.update();
        }, error => {
            this.pendingInstalledRemovals.delete(module.name);
            this.model.trigger('notification', new Notify({
                title: this.t('Unable to uninstall module'),
                message: error.message || '',
                duration: 4000,
                type: 'error'
            }));
        });
    }

    toggleVisibility(module: IModuleMeta): void {
        this.model.modules().toggleModuleVisibility(module.name);
        void this.update();
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
