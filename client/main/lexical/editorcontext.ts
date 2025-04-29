import { mergeRegister, $getNearestNodeOfType } from '@lexical/utils';

import { $isHeadingNode } from '@lexical/rich-text';
import { $createResultNode } from './resultnode';
import { $isPlaceholderNode, $createPlaceholderNode, PlaceholderNode } from './placeholdernode';

import {
    LexicalEditor,
    $getNodeByKey,
    SELECTION_CHANGE_COMMAND,
    COMMAND_PRIORITY_LOW,
    COMMAND_PRIORITY_HIGH,
    $getSelection,
    $isNodeSelection,
    $nodesOfType,
    KEY_DELETE_COMMAND,
    KEY_BACKSPACE_COMMAND,
    FOCUS_COMMAND,
    $isRangeSelection,
    $getRoot,
    $isRootNode,
    $createTextNode,
    LexicalNode,
    createEditor,
    $createParagraphNode,
    KEY_TAB_COMMAND,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    REDO_COMMAND,
    UNDO_COMMAND,
    COMMAND_PRIORITY_EDITOR,
    KEY_ENTER_COMMAND,
    OUTDENT_CONTENT_COMMAND,
    INDENT_CONTENT_COMMAND,
    TextNode,
    ElementNode,
    DELETE_CHARACTER_COMMAND,
    COMMAND_PRIORITY_CRITICAL,
    $createNodeSelection,
    $setSelection
} from 'lexical';

const TEXT_COLOR_COMMAND = 'text-color';
const HIGHLIGHT_COMMAND = 'highlight';

import {
    References
} from './components/references';

import {
    RefTable
} from './components/refs';

import {
    AnalysisNode,
    $createAnalysisNode
} from './analysisnode'

import { Awareness } from '../awareness';

import Modules from '../modules';

import * as Y from 'yjs';

import {
    createBinding,
    syncLexicalUpdateToYjs,
    syncYjsChangesToLexical,
    Binding
} from '@lexical/yjs';


import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory, HistoryState } from '@lexical/history';
import { registerRichText, $createHeadingNode } from '@lexical/rich-text';
import { copyToClipboard } from '@lexical/clipboard';
import { TOGGLE_LINK_COMMAND, toggleLink } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import { $isListItemNode, insertList } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { registerMarkdownShortcuts, TRANSFORMERS } from '@lexical/markdown';
import { ActionHub } from '../actionhub';

const THEME = {
    // Adding styling to Quote node, see styles.css
    quote: 'jmv-results__quote',
    text: {
        bold: "text-bold",
        italic: "text-italic",
        underline: "text-underline",
        code: 'text-code',
        highlight: 'text-highlight',
        strikethrough: 'text-strikethrough',
        subscript: 'text-subscript',
        superscript: 'text-superscript',
    }
}

let idCounter = 1;
let getNextId = function() {
    return idCounter++;
}

export interface CreateAnalysisOptions {
    readonly name: string;
    readonly ns: string;
    readonly title: string;
    readonly index?: number;
    readonly onlyOne?: boolean;
}

export interface IEnterable {
    onEnter: () => void;
    onLeave: () => void;
}

abstract class Feature<T extends ItemContext> {
    private _item: T;

    constructor(item: T) {
        this._item = item;
    }

    public get item() {
        return this._item;
    }

    public abstract registerEvents(): () => void;

    public abstract isReady(): Promise<void>;
}

abstract class EditorFeature extends Feature<EditorContext> {

    constructor(item: EditorContext) {
        super(item);
    }

    public get item(): EditorContext {
        return super.item;
    }

    public onEditorFinalisation(editor: LexicalEditor): void {

    }

    public abstract registerEditor(): () => void;
}

export class YDocSupport extends EditorFeature {
    private _doc: Y.Doc | null;
    private _binding: Binding | null = null;
    private _syncing = false;
    private _initialisingBinding = false;
    private _provider;
    private _uuid: string;
    private _ready: Promise<void>;
    private _resolve;

    constructor(item: EditorContext, uuid: string) {
        super(item);
        this._uuid = uuid;
        this.yDocUpdateHandle = this.yDocUpdateHandle.bind(this);
        this._doc = new Y.Doc();
        this._ready = new Promise((resolve, reject) => {
            this._resolve = resolve;
        });
    }

    isReady() {
        return this._ready;
    }

    //local
    public get uuid(): string {
        return this._uuid;
    }

    //local
    public get doc() {
        return this._doc;
    }

    public applyUpdate(update: Uint8Array) {
        let initialisingBinding = this._initialisingBinding;
        if (this._doc) {
            Y.applyUpdate(this._doc, update);
        }

        if ( ! initialisingBinding) {
            const event = new CustomEvent<Uint8Array>('updateApplied', { detail: update });
            this.item.dispatchEvent(event);
        }
    }

    private onAwarenessChanged() {
        //console.log(this._provider.awareness.getLocalState());
    }

    private registerBindings() {
        this._provider = this.createNoOpProvider(this._doc);

        this._provider.awareness.on('change', this.onAwarenessChanged);

        // The original yjsroot node needs to be stored so that the right collabNode is given to the right yjsNode
        let originalyjsRootNode = this._doc.get('root', Y.XmlText);
        let rootCollabNode = originalyjsRootNode._collabNode; //store root collab node for future repair.

        this._binding = createBinding(this.item.editor, this._provider, this.uuid, this._doc, {});

        if (this.uuid) {
            // Modify the binding to use the uuid root node in the yjs doc as the root node for lexical
            const yjsRootNode = this._doc.get(this.uuid, Y.XmlText);
            this._binding.root._xmlText = yjsRootNode;
            this._binding.root._key = this.uuid;
            yjsRootNode._collabNode = this._binding.root

            originalyjsRootNode._collabNode = rootCollabNode; //repair root collab node
        }

        let unregisterListeners = this.registerCollaborationListeners(this.item.editor, this._provider, this._binding);
        this._doc.on('update', this.yDocUpdateHandle);

        if (this.item.parent) {
            let parentYDocSupport = this.item.parent.getFeature(YDocSupport)
            if (parentYDocSupport) {
                this._initialisingBinding = true;
                this.applyUpdate(Y.encodeStateAsUpdate(parentYDocSupport.doc));
            }
        }

        return () => {
            unregisterListeners();
            this._provider.awareness.off('change', this.onAwarenessChanged);
            this._doc.off('update', this.yDocUpdateHandle);
        };
    }

    private yDocUpdateHandle(update: Uint8Array, origin, doc) {
        if (this._initialisingBinding) {
            //force an update after the inital update has occured and delcare ready.
            this.item.editor.update(() => { }, {
                discrete: true, onUpdate: () => {
                    this._resolve();
                }
            });
            return;
        }

        if (origin && origin.root._key === this._binding.root._key)
            this.onUpdate(update);
    }

    private registerCollaborationListeners(editor: LexicalEditor, provider, binding: Binding) {
        const unsubscribeUpdateListener = editor.registerUpdateListener(
            ({
                dirtyElements,
                dirtyLeaves,
                editorState,
                normalizedNodes,
                prevEditorState,
                tags,
            }) => {
                if (tags.has('skip-collab') === false && !this._syncing && !this._initialisingBinding) {
                    if (this.uuid) {
                        // Copy the root lexicalNode to update the reference as the 'root' has seemingly be replaced
                        // This allows the binder to use the uuid node in the lexical to update the jys doc.
                        let nodeMap = editorState._nodeMap;
                        const proto = Object.getPrototypeOf(nodeMap);
                        let rootNode = nodeMap.get('root');
                        proto.set.call(nodeMap, this.uuid, rootNode);

                        // also do to prevEditorState.
                        let prevNodeMap = prevEditorState._nodeMap;
                        const prevProto = Object.getPrototypeOf(prevNodeMap);
                        let preRootNode = prevNodeMap.get('root');
                        prevProto.set.call(prevNodeMap, this.uuid, preRootNode);
                    }
                    syncLexicalUpdateToYjs(
                        binding,
                        provider,
                        prevEditorState,
                        editorState,
                        dirtyElements,
                        dirtyLeaves,
                        normalizedNodes,
                        tags,
                    );
                }
                this._initialisingBinding = false;
            },
        );

        const observer = (events, transaction) => {
            if (transaction.origin !== binding) {
                this._syncing = true;
                syncYjsChangesToLexical(binding, provider, events, false);
                this._syncing = false;
            }
        };

        binding.root.getSharedType().observeDeep(observer);

        return () => {
            unsubscribeUpdateListener();
            binding.root.getSharedType().unobserveDeep(observer);
        };
    }

    private createNoOpProvider(doc: Y.Doc) {
        const emptyFunction = () => { };

        return {
            awareness: new Awareness(doc),
            connect: emptyFunction,
            disconnect: emptyFunction,
            off: emptyFunction,
            on: emptyFunction,
        };
    }

    private onUpdate(update: Uint8Array) {
        const event = new CustomEvent<Uint8Array>('nextUpdate', { detail: update, bubbles: true, composed: true });
        this.item.dispatchEvent(event);
    }

    public onEditorFinalisation(editor: LexicalEditor): void {

        if (this.uuid) {
            // Copy the root lexicalNode and make a reference to it in lexical using the uuid as the key
            // This allows the binder to use the uuid node in the jys doc as the root in lexical
            let nodeMap = editor.getEditorState()._nodeMap;
            let rootNode = nodeMap.get('root');
            if (rootNode)
                nodeMap.set(this.uuid, rootNode);
            else
                throw 'Root node should never be null';
            ////////////////////////
        }
    }

    public registerEditor() {
        return this.registerBindings();
    }

    public registerEvents() {
        if (!this.item.isRoot)
            this.item.parent.addEventListener('updateApplied', this.updateHandler);

        return () => {
            if (!this.item.isRoot)
                this.item.parent.removeEventListener('updateApplied', this.updateHandler);
        }
    }

    private updateHandler(event: CustomEvent<Uint8Array>) {
        let update: Uint8Array = event.detail;
        this.applyUpdate(update);
    }
}

export class Locked extends Feature<ItemContext> {
    constructor(item: ItemContext) {
        super(item);
    }

    isReady() {
        return Promise.resolve();
    }

    public registerEvents() {
        let item = this.item;
        let unregister = null;
        if (!item.isRoot) {
            unregister = mergeRegister(
                item.parent.editor.registerCommand(
                    DELETE_CHARACTER_COMMAND,
                    this.onBackspaceCommand.bind(this),
                    COMMAND_PRIORITY_CRITICAL
                ),
                item.parent.editor.registerCommand(
                    KEY_DELETE_COMMAND,
                    this.onDeleteCommand.bind(this),
                    COMMAND_PRIORITY_CRITICAL
                )
            );
        }
        return unregister;
    }

    private _isLocked(node: LexicalNode) {
        return node.getKey() === this.item.nodeKey;
    }

    onBackspaceCommand() {
        let selection = $getSelection();
        if ($isRangeSelection(selection)) {
            if (selection.isCollapsed()) {
                if (selection.anchor.offset === 0) {
                    const element = selection.anchor.type === 'element' ? selection.anchor.getNode() : selection.anchor.getNode().getParentOrThrow();

                    const prevNode = element.getPreviousSibling();
                    if (this._isLocked(prevNode)) {
                        return true;
                    }
                } else {
                    const curNode = selection.anchor.getNode();
                    if (this._isLocked(curNode)) {
                        return true;
                    }
                }
            }
            else {
                let selection = $getSelection();
                let anchorNode = selection.anchor.getNode();
                let focusNode = selection.focus.getNode();

                const nodes = selection.extract();
                let nodesToRemove = [];
                for (let node of nodes) {
                    if (node.isParentOf(anchorNode))
                        continue;
                    if (node.isParentOf(focusNode))
                        continue;

                    if (this._isLocked(node) === false) {
                        nodesToRemove.push(node);
                    }
                }

                this.item.parent.editor.update(() => {
                    for (let node of nodesToRemove)
                        node.remove();
                });

                return true;
            }
        }

        return false;
    }

    onDeleteCommand(payload) {
        let selection = $getSelection();
        if ($isRangeSelection(selection) && selection.isCollapsed()) {
            if (selection.anchor) {
                let anchorNode = selection.anchor.getNode();
                if (anchorNode && anchorNode.getTextContent) {
                    const nodeTextContent = anchorNode.getTextContent();  // Get the node's text content
                    const nodeLength = nodeTextContent.length;

                    // If anchorOffset is equal to the length of the node's text content, it means it's at the end
                    if (selection.anchor.offset === nodeLength) {
                        const prevNode = anchorNode.getParent()?.getNextSibling();
                        if (this._isLocked(prevNode)) {
                            const event: KeyboardEvent = payload;
                            event.preventDefault();
                            return true;
                        }
                    }
                }
                else {
                    const prevNode = anchorNode.getNextSibling();
                    if (this._isLocked(prevNode)) {
                        return true;
                    }
                }
            }
            return false;
        }
    }
}

export class Selectable extends Feature<ItemContext> {
    constructor(item: ItemContext) {
        super(item);

        this.onClick = this.onClick.bind(this);
    }

    isReady() {
        return Promise.resolve();
    }

    onClick(event) {
        this.item.parent.setFocus();
        this.item.parent.editor.update(() => {
            let nodeKey = this.item.nodeKey;
            const selection = $createNodeSelection();
            selection.add(nodeKey); // Select the node
            $setSelection(selection);
        });
    }

    public registerEvents() {
        let item = this.item;
        let unregister = null;
        if (!item.isRoot) {
            this.item.addEventListener('click', this.onClick);

            unregister = mergeRegister(
                item.parent.editor.registerCommand(
                    SELECTION_CHANGE_COMMAND,
                    this.updateDOMElement.bind(this),
                    COMMAND_PRIORITY_LOW
                ),
                () => {
                    this.item.removeEventListener('click', this.onClick);
                }
            );
            
        }
        return unregister;
    }

    updateDOMElement() {
        let item = this.item;
        item.parent.editor.read(() => {
            let dom = item.parent.editor.getElementByKey(item.nodeKey);
            let node = $getNodeByKey(item.nodeKey);
            let selected = node.isSelected();
            if (selected) {
                dom.setAttribute('data-lexical-selected', 'true');
            }
            else {
                dom.setAttribute('data-lexical-selected', 'false');
            }
        });
    }
}

export class Enterable extends Feature<ItemContext> {
    _enterable: IEnterable;
    _active: boolean;

    constructor(item: ItemContext & IEnterable) {
        super(item);
        item.setAttribute('tabindex', '0');
        this._enterable = item;
        //this.onDoubleClick = this.onDoubleClick.bind(this);
        this.onFocusOut = this.onFocusOut.bind(this);
        this.onFocusIn = this.onFocusIn.bind(this);
    }

    isReady() {
        return Promise.resolve();
    }

    public registerEvents() {
        let item = this.item;
        let unregister = null;
        if (!item.isRoot) {
            //item.addEventListener('dblclick', this.onDoubleClick);
            item.addEventListener('focusout', this.onFocusOut);
            item.addEventListener('focusin', this.onFocusIn);
            unregister = () => {
                //item.removeEventListener('dblclick', this.onDoubleClick);
                item.removeEventListener('focusout', this.onFocusOut);
                item.removeEventListener('focusin', this.onFocusIn);
            };
        }
        return unregister;
    }

    onFocusOut(event: FocusEvent) {
        if (event.relatedTarget === null || (event.relatedTarget instanceof Node && this.item.contains(event.relatedTarget) === false)) {
            this._active = false;
            this._enterable.onLeave();
        }
    }

    onFocusIn(event: FocusEvent) {
        if ( !this._active && event.target instanceof Element) {
            this._active = true;
            this._enterable.onEnter();
        }
    }

    /*onDoubleClick(event) {
        if ( ! this._entered)
            this._enterable.onEnter();
        this._entered = true;
    }*/
}

export class Removable extends Feature<ItemContext> {
    constructor(item: ItemContext) {
        super(item);
    }

    isReady() {
        return Promise.resolve();
    }

    public registerEvents() {
        let item = this.item;
        if (!item.isRoot) {
            return mergeRegister(
                item.parent.editor.registerCommand(
                    KEY_DELETE_COMMAND,
                    (payload) => {
                        item.parent.editor.update(() => {
                            this.$delete(payload);
                        });
                    },
                    COMMAND_PRIORITY_LOW
                ),
                item.parent.editor.registerCommand(
                    KEY_BACKSPACE_COMMAND,
                    (payload) => {
                        item.parent.editor.update(() => {
                            this.$delete(payload);
                        });
                    },
                    COMMAND_PRIORITY_LOW
                )
            )
        }
        return null;
    }

    $delete(payload) {
        const deleteSelection = $getSelection();
        let node = $getNodeByKey(this.item.nodeKey);
        if (node.isSelected && $isNodeSelection(deleteSelection)) {
            const event: KeyboardEvent = payload;
            event.preventDefault();
            node.remove();
        }
        return false;
    }
}


export class ItemContext extends HTMLElement {
    private _id: string;
    private _parent: ParentContext | null;  // A parent will always be either null (for root) or of type ParentContext which is the fundimental container for nested items
    protected _root: ShadowRoot;  //we can't use shadow dom yet because browser support of shadowdom selection is not great. Hopefully one day it will be. Works in firefox
    //protected _root: HTMLElement;
    private _host: Element;
    private _isConnected = false;
    private _nodeKey: string;
    private _unregisterEvents;
    private _features: Array<Feature<ItemContext>>;
    private _ready: Array<Promise<void>>;
    private _resolve;

    constructor(nodeKey?: string) {
        super();

        this._root = this.attachShadow({ mode: 'open', serializable: true, delegatesFocus: true, clonable: true });  //used with shadow dom
        this._host = this._root.host;  //used with shadow dom
        //this._root = this; //this.attachShadow({ mode: 'open', serializable: true, delegatesFocus: true, clonable: true });  //used with shadow dom
        //this._host = this; //this._root.host;  //used with shadow dom

        this._id = crypto.randomUUID();
        this._nodeKey = nodeKey;

        this._features = [];

        this._ready = [new Promise((resolve, reject) => {
            this._resolve = resolve;
        })];
    }

    public getRootElement() {
        return this._root;
    }

    public get features() {
        return this._features;
    }

    public addFeatures<T extends ItemContext>(...features: Array<Feature<T>>) {
        this._features.push(...features);
        for (let feature of features)
            this._ready.push(feature.isReady());
    }

    public getFeature<T extends Feature<ItemContext>>(type: new (...args: any[]) => T): T {
        return this._features.find((feature): feature is T => feature instanceof type);
    }

    public hasFeature<T extends Feature<ItemContext>>(type: new (...args: any[]) => T): boolean {
        return this._features.some((feature) => feature instanceof type);
    }

    public get id() {
        return this._id;
    }

    //local
    public get parent() {
        return this._parent;
    }

    public get isConnected() {
        return this._isConnected;
    }

    public isReady() {
        return Promise.all(this._ready);
    }

    public closestPassShadow<T extends ItemContext>(type: new (...args: any[]) => T, node) {
        if (!node)
            return null;

        if (node instanceof type)
            return node;

        if (node instanceof ShadowRoot)
            return this.closestPassShadow(type, node.host);

        return this.closestPassShadow(type, node.parentNode);
    }

    connectedCallback() {
        this._isConnected = true;
        this._parent = this.closestPassShadow(ResultsContext, this._host.parentElement);
        this.onConnected();
        this._resolve();
    }

    protected onConnected() {
        this._unregisterEvents = this.registerEvents();
    }

    disconnectedCallback() {
        this._isConnected = false;
        this.destroy();
    }

    protected destroy() {
        this.parent.removeItem(this);
        this._unregisterEvents();
    }

    public get isRoot() {
        return this._parent === null;
    }

    //local
    public get nodeKey(): string {
        return this._nodeKey;
    }

    protected registerEvents() {
        if (!this.isRoot) {
            let unregister = [];
            for (let feature of this._features) {
                let unregisterCallback = feature.registerEvents();
                if (unregisterCallback)
                    unregister.push(unregisterCallback);
            }
            return mergeRegister(...unregister)
        }
        return null;
    }

    $delete(payload) {
        const deleteSelection = $getSelection();
        let node = $getNodeByKey(this.nodeKey);
        if (node.isSelected && $isNodeSelection(deleteSelection)) {
            const event: KeyboardEvent = payload;
            event.preventDefault();
            node.remove();
        }
        return false;
    }

    updateDOMElement() {
        this.parent.editor.read(() => {
            let dom = this.parent.editor.getElementByKey(this.nodeKey);
            let node = $getNodeByKey(this.nodeKey);
            if (node.isSelected()) {
                dom.setAttribute('data-lexical-selected', 'true');
            }
            else {
                dom.setAttribute('data-lexical-selected', 'false');
            }
        });
    }
}

export abstract class EditorContext extends ItemContext {
    private _editor: LexicalEditor;

    private _unregisterEditor;
    private _allowedNodes: Array<LexicalNode>;
    private _focusedEditor: EditorContext;
    private _canUndo = false;
    private _canRedo = false;
    private _blockType: string;
    private _historyState: HistoryState;
    protected _editorElement: HTMLElement;

    constructor(nodeKey?: string) {
        super(nodeKey);

        let elementId = `editor${getNextId()}`;
        this._root.innerHTML = `<style>${this._css()}</style>`;

        this._editorElement = document.createElement('div');
        this._editorElement.setAttribute('id', elementId);
        this._editorElement.setAttribute('contenteditable', 'true');
        this._editorElement.classList.add('editor');
        this._root.append(this._editorElement);
    }

    protected onConnected() {
        super.onConnected();
        this.createLexicalEditor();

    }

    public setAllowedNodes(...nodes: Array<LexicalNode>) {
        if (this.isConnected)
            throw 'Nodes must be specified before adding to the DOM';
        this._allowedNodes = nodes;
    }

    protected _css() {
        return `
            :host {

            }

            [data-lexical-selected="true"] {
                outline: 2px solid blue;
                background-color: #f0f8ff;
            }

            [data-lexical-selected="false"] {
                outline: none;
                background-color: transparent;
            }

            .editor {
                outline: none !important;
                outline-offset: 10px;
                font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol" ;
                color: #333333 ;
                cursor: text ;
                margin: 0 ;
                font-size: 13px;
                line-height: 1.42;
                tab-size: 4;
                padding: 1px 14px ;
            }

            h1 {
                font-size: 160% ;
                color: #3E6DA9 ;
                margin-bottom: 3px ;
                white-space: nowrap ;
            }

            h2 {
                font-size: 130%;
                margin-bottom: 3px;
                margin-top: 3px;
                color: #3e6da9;
            }
        `;
    }

    setFocus() {
        //this._editorElement.focus();
        this.editor.focus();
    }

    _setNodeStyle(writable, styleName, styleValue) {
        const currentStyle = writable.getStyle();
        // Parse CSS style string into an object 
        let styleObj = {};
        if (currentStyle !== '') {
            styleObj = currentStyle.split(';').reduce((styles, style) => {
                const [key, value] = style.split(':').map(item => item.trim());
                if (key)
                    styles[key] = value;

                return styles;
            }, {});
        }
        // Update the specific style 
        styleObj[styleName] = styleValue;
        // Convert object back to CSS style string 
        const newStyle = Object.entries(styleObj).map(([key, value]) => `${key}: ${value}`).join('; ');
        writable.setStyle(newStyle);
    }

    formatHeading(blockType, headingSize) {
        if (blockType !== headingSize) {
            this.editor.update(() => {
                const selection = $getSelection();
                $setBlocksType(selection, () => $createHeadingNode(headingSize));
            });
        }
    };

    formatCode(blockType) {
        if (blockType !== 'code') {
            this.editor.update(() => {
                let selection = $getSelection();

                if (selection !== null) {
                    if (selection.isCollapsed()) {
                        $setBlocksType(selection, () => $createCodeNode());
                    } else {
                        const textContent = selection.getTextContent();
                        const codeNode = $createCodeNode();
                        selection.insertNodes([codeNode]);
                        selection = $getSelection();
                        if ($isRangeSelection(selection)) {
                            selection.insertRawText(textContent);
                        }
                    }
                }
            });
        }
    };

    cutAction(source) {
        document.execCommand('cut');
    }

    copyAction(source) {
        copyToClipboard(this.editor, null);
    }

    pasteAction(source) {
        document.execCommand('paste');
    }

    boldAction(source) {
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
    }

    italicAction(source) {
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
    }

    underlineAction(source) {
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
    }

    textStrikeAction(source) {
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough");
    }

    subscriptAction(source) {
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "subscript");
    }

    superscriptAction(source) {
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "superscript");
    }

    textIndentRightAction(source) {
        this.editor.dispatchCommand(INDENT_CONTENT_COMMAND, null);
    }

    textIndentLeftAction(source) {
        this.editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, null);
    }

    textAlignCenterAction(source) {
        this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center");
    }

    textAlignLeftAction(source) {
        this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left");
    }

    textAlignRightAction(source) {
        this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right");
    }

    textAlignJustifyAction(source) {
        this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify");
    }

    listBulletAction(source) {
        insertList(this.editor, "bullet");
    }

    listOrderedAction(source) {
        insertList(this.editor, "number");
    }

    textColorAction(source) {
        if (source.name !== 'textColor')
            this.editor.dispatchCommand(TEXT_COLOR_COMMAND, { color: source.name === 'tcReset' ? '' : source.title });
    }

    textBackColorAction(source) {
        if (source.name !== 'textBackColor')
            this.editor.dispatchCommand(HIGHLIGHT_COMMAND, { color: source.name === 'tcReset' ? '' : source.title });
    }

    undoAction(source) {
        if (this._canUndo)
            this.editor.dispatchCommand(UNDO_COMMAND, null);
    }

    redoAction(source) {
        if (this._canRedo)
            this.editor.dispatchCommand(REDO_COMMAND, null);
    }

    linkAction(source) {
        const url = 'https://www.jamovi.org';
        this.editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    }

    headingAction(source) {
        this.formatHeading(this._blockType, 'h1');
    }

    codeBlockAction(source) {
        this.formatCode(this._blockType);
    }

    registerToolbarBindings() {
        ActionHub.get('textCut').on('request', this.cutAction, this);
        ActionHub.get('textCopy').on('request', this.copyAction, this);
        ActionHub.get('textPaste').on('request', this.pasteAction, this);
        ActionHub.get('textBold').on('request', this.boldAction, this);
        ActionHub.get('textItalic').on('request', this.italicAction, this);
        ActionHub.get('textUnderline').on('request', this.underlineAction, this);
        ActionHub.get('textStrike').on('request', this.textStrikeAction, this);
        ActionHub.get('textSubScript').on('request', this.subscriptAction, this);
        ActionHub.get('textSuperScript').on('request', this.superscriptAction, this);
        ActionHub.get('textIndentRight').on('request', this.textIndentRightAction, this);
        ActionHub.get('textIndentLeft').on('request', this.textIndentLeftAction, this);
        ActionHub.get('textAlignCenter').on('request', this.textAlignCenterAction, this);
        ActionHub.get('textAlignLeft').on('request', this.textAlignLeftAction, this);
        ActionHub.get('textAlignRight').on('request', this.textAlignRightAction, this);
        ActionHub.get('textAlignJustify').on('request', this.textAlignJustifyAction, this);
        ActionHub.get('textListBullet').on('request', this.listBulletAction, this);
        ActionHub.get('textListOrdered').on('request', this.listOrderedAction, this);
        ActionHub.get('textColor').on('request', this.textColorAction, this);
        ActionHub.get('textBackColor').on('request', this.textBackColorAction, this);
        ActionHub.get('textUndo').on('request', this.undoAction, this);
        ActionHub.get('textRedo').on('request', this.redoAction, this);
        ActionHub.get('textLink').on('request', this.linkAction, this);
        ActionHub.get('textH2').on('request', this.headingAction, this);
        ActionHub.get('textCodeBlock').on('request', this.codeBlockAction, this);

        return () => {
            ActionHub.get('textCut').off('request', this.cutAction, this);
            ActionHub.get('textCopy').off('request', this.copyAction, this);
            ActionHub.get('textPaste').off('request', this.pasteAction, this);
            ActionHub.get('textBold').off('request', this.boldAction, this);
            ActionHub.get('textItalic').off('request', this.italicAction, this);
            ActionHub.get('textUnderline').off('request', this.underlineAction, this);
            ActionHub.get('textStrike').off('request', this.textStrikeAction, this);
            ActionHub.get('textSubScript').off('request', this.subscriptAction, this);
            ActionHub.get('textSuperScript').off('request', this.superscriptAction, this);
            ActionHub.get('textIndentRight').off('request', this.textIndentRightAction, this);
            ActionHub.get('textIndentLeft').off('request', this.textIndentLeftAction, this);
            ActionHub.get('textAlignCenter').off('request', this.textAlignCenterAction, this);
            ActionHub.get('textAlignLeft').off('request', this.textAlignLeftAction, this);
            ActionHub.get('textAlignRight').off('request', this.textAlignRightAction, this);
            ActionHub.get('textAlignJustify').off('request', this.textAlignJustifyAction, this);
            ActionHub.get('textListBullet').off('request', this.listBulletAction, this);
            ActionHub.get('textListOrdered').off('request', this.listOrderedAction, this);
            ActionHub.get('textColor').off('request', this.textColorAction, this);
            ActionHub.get('textBackColor').off('request', this.textBackColorAction, this);
            ActionHub.get('textUndo').off('request', this.undoAction, this);
            ActionHub.get('textRedo').off('request', this.redoAction, this);
            ActionHub.get('textLink').off('request', this.linkAction, this);
            ActionHub.get('textH2').off('request', this.headingAction, this);
            ActionHub.get('textCodeBlock').off('request', this.codeBlockAction, this);
        }
    }

    public get allowedNodes() {
        return this._allowedNodes;
    }

    protected createLexicalEditor() {
        if (this._editor)
            throw 'Editor already exists';

        this._editor = createEditor({
            namespace: 'jmv-results',
            editable: true,
            editorState: null,
            nodes: this.allowedNodes,
            onError: (error) => {
                throw error;
            },
            theme: THEME
        });

        const originalDispatchCommand = this._editor.dispatchCommand;

        this._editor.dispatchCommand = (command, payload) => {
            console.log(`Command Fired: ${command.type}`, payload);
            return originalDispatchCommand.call(this._editor, command, payload);
        };

        this.editorFinalisation(this.editor);

        /*if (this.isRoot)
            this._historyState = createEmptyHistoryState();
        else
            this._historyState = this._root._historyState;*/

        let element = this._root.querySelector('.editor');
        this.editor.setRootElement(element);

        this._unregisterEditor = this.registerEditor();
    }

    public get historyState() {
        if (this.parent)
            return this.parent.historyState;

        if (!this._historyState)
            this._historyState = createEmptyHistoryState();

        return this._historyState;
    }

    //global
    public get focusedContext(): EditorContext {
        if (this.parent)
            return this.parent.focusedContext;

        return this._focusedEditor;
    }

    protected onFocusedContextChanged() {

    }

    public set focusedContext(context: EditorContext) {
        if (this.parent)
            this.parent.focusedContext = context;
        else if (this._focusedEditor != context) {
            this._focusedEditor = context;
            this.onFocusedContextChanged();
        }
    }

    //local
    public get editor(): LexicalEditor {
        return this._editor;
    }

    private $getSelectedBlockType() {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            const blockNode = $getNearestNodeOfType(anchorNode, ElementNode);
            if (blockNode) {
                this._blockType = $isHeadingNode(blockNode) ? blockNode.getTag() : blockNode.getType();
                console.log(`Current Block Type: ${this._blockType}`);
            } else {
                console.log('No block type found');
            }
        } else {
            console.log('No selection');
        }
    }

    protected registerEditor() {

        // Add editor registrations from editor features
        let unregister = [];
        for (let feature of this.features) {
            if (feature instanceof EditorFeature) {
                let unregisterCallback = feature.registerEditor();
                if (unregisterCallback)
                    unregister.push(unregisterCallback);
            }
        }
        /////////////

        return mergeRegister(
            mergeRegister(...unregister),
            registerMarkdownShortcuts(this.editor, TRANSFORMERS),
            registerRichText(this.editor),
            registerDragonSupport(this.editor),
            registerHistory(this.editor, this.historyState, 300),
            this.registerToolbarBindings(),
            this.editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    this.$getSelectedBlockType();
                });
            }),
            this.editor.registerCommand(
                FOCUS_COMMAND,
                () => {
                    this.focusedContext = this;
                    return true;
                },
                COMMAND_PRIORITY_HIGH
            ),
            // Toggle link command callback
            this.editor.registerCommand(
                TOGGLE_LINK_COMMAND,
                (payload) => {
                    if (payload === null) {
                        toggleLink(payload)
                        return true
                    }
                    else if (typeof payload === 'string') {
                        //if (props.validateUrl === undefined || props.validateUrl(payload)) {
                        toggleLink(payload);
                        return true
                        //}
                        //return false
                    }
                    else {
                        const { url, target, rel, title } = payload
                        toggleLink(url, { rel, target, title })
                        return true
                    }
                },
                COMMAND_PRIORITY_LOW,
            ),

            // Tab key command callback
            this.editor.registerCommand(
                KEY_TAB_COMMAND,
                (payload) => {
                    const event = payload;
                    event.preventDefault();
                    return this.editor.dispatchCommand(
                        event.shiftKey ? OUTDENT_CONTENT_COMMAND : INDENT_CONTENT_COMMAND,
                    );
                },
                COMMAND_PRIORITY_EDITOR
            ),

            // Text color command callback
            this.editor.registerCommand(
                TEXT_COLOR_COMMAND,
                (payload) => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        const nodes = selection.extract();
                        nodes.forEach(node => {
                            let writable = node.getWritable();
                            this._setNodeStyle(writable, 'color', payload.color);
                        });
                    }
                    return true;
                },
                0
            ),

            // Text background color command callback
            this.editor.registerCommand(
                HIGHLIGHT_COMMAND,
                (payload) => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        const nodes = selection.extract();
                        nodes.forEach(node => {
                            if (node instanceof TextNode) {
                                let writable = node.getWritable();
                                this._setNodeStyle(writable, 'background-color', payload.color);
                            }
                        });
                    }
                    return true;
                },
                0
            ),

            // Enter key command callback
            this.editor.registerCommand(
                KEY_ENTER_COMMAND,
                () => {
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        const node = selection.anchor.getNode();
                        if ($isListItemNode(node) && node.getTextContent().trim() === '') {
                            this.editor.update(() => {
                                const paragraphNode = $createParagraphNode();
                                node.getParent().insertAfter(paragraphNode, node);
                                paragraphNode.select();
                            });
                            return true;
                        }
                    }
                    return false;
                },
                COMMAND_PRIORITY_HIGH
            ),

            // Can undo command callback
            this.editor.registerCommand(
                CAN_UNDO_COMMAND,
                (payload) => {
                    this._canUndo = payload;
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),

            // Can redo command callback
            this.editor.registerCommand(
                CAN_REDO_COMMAND,
                (payload) => {
                    this._canRedo = payload;
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),
        );
    }

    protected unregisterEditor() {
        this._unregisterEditor();
    }

    protected destroy() {
        super.destroy();
        this.unregisterEditor();
    }

    protected editorFinalisation(editor: LexicalEditor) {
        editor._config.jmvContext = this;

        if (this.parent instanceof EditorContext) {
            editor._parentEditor = this.parent.editor;
            editor._editable = this.parent.editor._editable;
        }

        for (let feature of this.features) {
            if (feature instanceof EditorFeature)
                feature.onEditorFinalisation(editor);
        }
    }
}

export abstract class ParentContext extends EditorContext {
    private _nestedContexts: { [index: string]: ItemContext } = {};

    constructor(nodeKey?: string) {
        super(nodeKey);
    }

    protected onConnected() {
        super.onConnected();

        if (!this.isRoot) {
            if (this.parent instanceof ParentContext && this instanceof ItemContext)
                this.parent._nestedContexts[this.id] = this;
        }
    }

    public removeItem(item: ItemContext) {
        delete this._nestedContexts[item.id]
    }

    public get items() {
        return this._nestedContexts;
    }
}

export class ResultsContext extends ParentContext implements IEnterable {
    private _references: References;
    private _mode: string;
    private _refsMode: string;
    private _editState: boolean;
    private _devMode: string;
    private _format: any;
    private _selectedAnalysis: Analysis | null;
    private _modules: Modules;
    private _unsubscribeUpdateListener: () => void;
    private _persistantSelectedAnalysis = false;

    constructor(uuid?: string, nodeKey?: string) {
        super(nodeKey);
        this._selectedAnalysis = null;
        this.onAnalysesChanged = this.onAnalysesChanged.bind(this);

        this.addFeatures(
            new YDocSupport(this, uuid),
            //new Removable(this), 
            new Selectable(this),
            //new Enterable(this)
        );
    }

    public onEnter() {
        this._editorElement.setAttribute('contenteditable', 'true');
        this._editorElement.classList.remove('content-not-selectable');
        //this.setFocus();
        /*setTimeout(() => {
            this._editorElement.focus();
        }, 0);*/
        
        console.log('entered!!!!!!!!!!!!')
    }

    public onLeave() {
        this._editorElement.setAttribute('contenteditable', 'false');
        this._editorElement.classList.add('content-not-selectable');
        console.log('left!!!!!!!!!!!!')
    }

    protected registerEditor() {
        return mergeRegister(
            super.registerEditor(),
            this.editor.registerMutationListener(AnalysisNode, this.onAnalysesChanged),
            this.editor.registerUpdateListener(({ editorState }) => {  // this isn't great and should change
                editorState.read(() => {
                    const root = $getRoot();
                    const textContent = root.getTextContent();

                    if (textContent.trim() === '')
                        this.initialiseContent();
                });
            })
        );
    }

//18v makita auto feed DFR450ZX 418.45 + battery - 25mm fine thread screw wall - 32mm cieling  600mm centers


    protected _css() {
        let css = super._css();
        css += `
            .jmv-analysis-wrapper {
                position: relative;
                transition: background-color .2s;
                border-radius: 3px;
                margin: 10px 0px;
                display: block;
            }

            .jmv-analysis-wrapper:not(.analysis-selected):hover {
                /*background-color: #3e6da90d;*/
                outline: 1px solid #b9b9b9;
            }

            .analysis-selected {
                outline: 2px solid #3e6da9;
            }
        `;
        return css;
    }

    initialiseContent() {
        if (this.isRoot) {
            this.editor.update(() => {
                const root = $getRoot();
                const textContent = root.getTextContent();
                const isEmpty = root.getChildrenSize() === 0;

                if (textContent.trim() === '' || isEmpty) {
                    root.clear();
                    const headingNode = $createHeadingNode('h1');
                    headingNode.append($createTextNode('Results'));
                    root.append(headingNode);

                    let placeholderNode = $createPlaceholderNode('Add analysis or just start typing...');
                    root.append(placeholderNode);
                }
            });
        }
    }

    protected onAnalysesChanged() {
        const event = new CustomEvent('analysesChanged', { bubbles: true, composed: true });
        this.dispatchEvent(event);
    }

    insertAnalysis(opts: CreateAnalysisOptions) {
        let focusedContext = this.focusedContext || this;
        //if (focusedContext instanceof EditorContext) {
            focusedContext.editor.update(() => {
                let analysisNode = $createAnalysisNode(opts.ns, opts.name);
                analysisNode.focusOnCreation = true;

                //let paragraphNode = $createParagraphNode();
                //paragraphNode.append(analysisNode);

                const root = $getRoot();
                const lastNode = root.getChildren().at(-1);
                if ($isPlaceholderNode(lastNode))
                    lastNode.replace(analysisNode);
                else {
                    let currentNode = null;
                    const selection = $getSelection();
                    if ($isRangeSelection(selection)) {
                        const nodes = selection.getNodes();
                        if (nodes.length > 0)
                            currentNode = nodes[nodes.length - 1];
                    }

                    if (!currentNode || $isRootNode(currentNode))
                        root.append(analysisNode);
                    else {
                        let topLevel = currentNode.getTopLevelElement();
                        if (topLevel) {
                            if (topLevel.getType() === 'paragraph' && topLevel.getTextContent() === '')
                                topLevel.replace(analysisNode);
                            else
                                topLevel.insertAfter(analysisNode);
                        }
                        else
                            currentNode.insertAfter(analysisNode);
                    }
                }

            });
        //}
    }

    getAllAnalysisNodes(): Array<AnalysisNode> {
        return this.editor.read(() => {
            let analysisNodes = [];
            let nodes = $nodesOfType(AnalysisNode);
            analysisNodes.push(...nodes);
            for (let key in this.items) {
                let context = this.items[key];
                if (context instanceof ResultsContext)
                    analysisNodes.push(...context.getAllAnalysisNodes());
            }
            return analysisNodes;
        });
    }

    protected onConnected() {
        super.onConnected();

        if (this.isRoot && this._references)
            this._references.setRootContext(this);
        else {

            //if (applyFocus) {
            //    setTimeout(() => {
            //        this.focusedContext = context;
            //    }, 0);
            //}
        }
    }

    public get selectedAnalysis(): Analysis {
        if (this.parent && this.parent instanceof ResultsContext)
            return this.parent.selectedAnalysis;

        return this._selectedAnalysis;
    }

    public clearSelectedAnalysis() {
        this._setSelectedAnalysis(null);
    }

    private _setSelectedAnalysis(context: AnalysisContext | null) {
        if (this._persistantSelectedAnalysis === false || context instanceof AnalysisContext || context === null) {
            if (this._selectedAnalysis) {
                let oldEditor = this._selectedAnalysis._context.parent.editor;
                let element = oldEditor.getElementByKey(this._selectedAnalysis._context.nodeKey);
                element.classList.remove('analysis-selected');
            }
        }

        if (context instanceof AnalysisContext) {

            this._selectedAnalysis = new Analysis(context, this._modules);

            let editor = context.parent.editor;
            let element = editor.getElementByKey(context.nodeKey);
            element.classList.add('analysis-selected');

            this._unsubscribeUpdateListener = editor.registerUpdateListener((event) => {
                event.editorState.read(() => {
                    if (event.dirtyLeaves.has(context.nodeKey)) {
                        const event = new CustomEvent<Analysis>('analysisOptionsChanged', { detail: this._selectedAnalysis, bubbles: true, composed: true });
                        this.dispatchEvent(event);
                    }
                });
            });
        }
        else
            this._selectedAnalysis = null;
        //////////////////

        const event = new CustomEvent<Analysis>('selectedAnalysisChanged', { detail: this._selectedAnalysis });
        this.dispatchEvent(event);
    }

    protected onFocusedContextChanged(): void {
        super.onFocusedContextChanged();

        // determining analysis selection
        if (this._unsubscribeUpdateListener) {
            this._unsubscribeUpdateListener();
            this._unsubscribeUpdateListener = null;
        }

        if (this.focusedContext instanceof AnalysisContext)
            this._setSelectedAnalysis(this.focusedContext);
        else if (this.focusedContext instanceof ResultsContext && this._persistantSelectedAnalysis === false)
            this._setSelectedAnalysis(null);
    }

    public set persistantSelectedAnalysis(value: boolean) {
        this._persistantSelectedAnalysis = value;
    }

    public get persistantSelectedAnalysis(): boolean {
        return this._persistantSelectedAnalysis;
    }

    //global
    public get references(): References {
        if (this.parent && this.parent instanceof ResultsContext)
            return this.parent.references;

        return this._references;
    }

    public setModules(modules: Modules) {
        if (this.parent && this.parent instanceof ResultsContext)
            throw 'Modules can only be changed on the root context';

        this._modules = modules;
    }

    //Only root
    public setReferences(references: References) {
        if (this.parent && this.parent instanceof ResultsContext)
            throw 'Reference table can only be changed on the root context';

        this._references = references;
        if (this.isConnected)
            this._references.setRootContext(this);
    }

    //global
    public get mode() {
        if (this.parent && this.parent instanceof ResultsContext)
            return this.parent.mode;

        return this._mode;
    }

    //Only root
    public set mode(mode: string) {
        if (this.parent && this.parent instanceof ResultsContext)
            throw 'Mode can only be changed on the root context';

        this._mode = mode;
    }

    //global
    public get refsMode() {
        if (this.parent && this.parent instanceof ResultsContext)
            return this.parent.refsMode;

        return this._refsMode;
    }

    //only root
    public set refsMode(refsMode: string) {
        if (this.parent && this.parent instanceof ResultsContext)
            throw 'refsMode can only be changed on the root context';

        this._refsMode = refsMode;
    }

    //global
    public get editState() {
        if (this.parent && this.parent instanceof ResultsContext)
            return this.parent.editState;

        return this._editState;
    }

    //only root
    public set editState(editState: boolean) {
        if (this.parent && this.parent instanceof ResultsContext)
            throw 'editState can only be changed on the root context';

        this._editState = editState;
    }

    //global
    public get devMode() {
        if (this.parent && this.parent instanceof ResultsContext)
            return this.parent.devMode;

        return this._devMode;
    }

    //only root
    public set devMode(devMode: string) {
        if (this.parent && this.parent instanceof ResultsContext)
            throw 'devMode can only be changed on the root context';

        this._devMode = devMode;
    }

    //global
    public get format() {
        if (this.parent && this.parent instanceof ResultsContext)
            return this.parent.format;

        return this._format;
    }

    //only root
    public set format(format: any) {
        if (this.parent && this.parent instanceof ResultsContext)
            throw 'format can only be changed on the root context';

        this._format = format;
    }

}

export class AnalysisContext extends ResultsContext {
    private _refTable: RefTable;
    private _ns: string;
    private _name: string;
    private _test = 0;

    constructor(uuid: string, ns: string, name: string, nodeKey: string) {
        //let allowedNodes = [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode, AnalysisNode, ResultNode];
        super(uuid, nodeKey);

        this._ns = ns;
        this._name = name;

        this._refTable = new RefTable();

        this.refchangedHandle = this.refchangedHandle.bind(this);
        //this.isReady().then(() => {
        //    this.appendTable();
        //});
    }

    protected onConnected() {
        super.onConnected();
        this._refTable.setup(this.references.getNumbers(this._ns), this.parent.refsMode);
    }

    refchangedHandle(e: CustomEvent<Array<string>>) {
        let nsList = e.detail;
        if (nsList.includes(this._ns))
            this._refTable.setup(this.references.getNumbers(this._ns), this.parent.refsMode);
    }

    private registerReferences() {
        this.references.addEventListener("refChanged", this.refchangedHandle);

        return () => {
            this.references.removeEventListener("refChanged", this.refchangedHandle);
        };
    }

    protected registerEditor() {
        return mergeRegister(
            super.registerEditor(),
            this.registerReferences()
        );
    }

    protected _css(): string {
        let css = super._css();
        css += `
            .results-item {
                width: fit-content;
            }

            .results-item[data-type='table'] {
                padding: 10px;
            }
        `;
        return css;
    }

    //local
    public get refTable(): RefTable {
        return this._refTable;
    }

    //local
    public get ns(): string {
        return this._ns;
    }

    //local
    public get name(): string {
        return this._name;
    }

    public getDetails() {
        let editorState = this.parent.editor.getEditorState();
        return editorState.read(() => {
            let node = $getNodeByKey(this.nodeKey);
            return node.getDetails();
        });
    }

    public setOptions(options: any) {
        this.parent.editor.update(() => {
            let node = $getNodeByKey(this.nodeKey);
            node.setOptions(options);
        });
    }

    hexToUint8Array(hexString) {
        // Remove potential "0x" prefix
        if (hexString.startsWith("0x")) {
            hexString = hexString.slice(2);
        }

        // Ensure even length
        if (hexString.length % 2 !== 0) {
            throw new Error("Hex string must have an even length");
        }

        // Convert hex string to Uint8Array
        const byteArray = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < byteArray.length; i++) {
            byteArray[i] = parseInt(hexString.substr(i * 2, 2), 16);
        }

        return byteArray;
    }

    appendTable() {
        this.editor.update(() => {
            const root = $getRoot();

            const headingNode = $createHeadingNode('h1');
            headingNode.append($createTextNode('ANOVA'));
            root.append(headingNode);

            const paragraphNode1 = $createParagraphNode();
            paragraphNode1.append($createTextNode('T-' + this._test.toString()));
            root.append(paragraphNode1);
            this._test += 1;

            let hex = '0a046d61696e120b414e4f5641202d206c656e28013281050a3c0a046e616d651a04746578743a081a04646f736528013a061a04737570703a0d1a09646f73653a7375707028023a0d1a09526573696475616c7328030a480a027373120e53756d206f6620537175617265731a066e756d6265723a09117a4cf060def4a2403a09113c33333333ab69403a091130dbf97e6a145b403a0911032b8716d94086400a3d0a026466120264661a07696e74656765723a091100000000000000403a0911000000000000f03f3a091100000000000000403a09110000000000004b400a450a026d73120b4d65616e205371756172651a066e756d6265723a09117a4cf060def492403a09113c33333333ab69403a091130dbf97e6a144b403a0911469bcfe1d15f2a400a330a01461201461a066e756d6265723a0911cd00c06cffff56403a09115eeba47dda242f403a0911f828c7128f6d10403a021a000a3f0a01701201701a066e756d626572220a7a746f2c7076616c75653a0911aa06a27904a9523c3a0911c3c1f936354d2e3f3a0911c56424d18962963f3a021a000a410a0565746153711204ceb7c2b21a066e756d62657222037a746f3a0911036a450ddd7de63f3a0911897ea7f9a374ae3f3a09112c887ef69b10a03f3a021a0078010a430a066574615371501205ceb7c2b2701a066e756d62657222037a746f3a09113a94cd744fbde83f3a0911fc1512f14fa6cc3f3a0911f0c6e0664ae6c03f3a021a0078010a430a076f6d65676153711204cf89c2b21a066e756d62657222037a746f3a091107778df49a29e63f3a09117b1a0f533164ac3f3a0911fec3f1bccd36983f3a021a007801120622646f7365221206227375707022120f5b22646f7365222c2273757070225d1202222238ffffffffffffffffff01820103636172';
            let resultNode = $createResultNode(this.hexToUint8Array(hex));
            root.append(resultNode);
        });
    }

}

export class Analysis {

    modules: any;
    isReady: boolean;
    uijs: any;
    missingModule: boolean;
    arbitraryCode: boolean;

    _defn: any;
    i18n: any;

    ready: Promise<void>;
    details: any;

    _context: AnalysisContext;

    constructor(context: AnalysisContext, modules) {
        this._context = context
        this.details = null;
        this.modules = modules;
        this.isReady = false;
        this.uijs = undefined;

        this.missingModule = false;
        this.arbitraryCode = false;

        this._defn = null;

        this.reload();
    }

    async getCurrentI18nCode() {
        return await this.modules.getCurrentI18nCode(this.ns);
    }

    async reload() {
        this.isReady = false;
        this.ready = (async () => {
            try {
                this.details = this._context.getDetails();

                let defn = await (async () => {
                    let defn = await this.modules.getDefn(this.ns, this.name);
                    let i18nDefn = await this.modules.getI18nDefn(this.ns);
                    this.i18n = i18nDefn;
                    this.uijs = defn.uijs;
                    return defn;
                })();

                this._defn = defn;
                this.arbitraryCode = (defn.arbitraryCode || defn.arbitraryCode2);
                this.missingModule = false;
                this.isReady = true;
            }
            catch (e) {
                this.missingModule = true;
                this.isReady = true;
            }

        })();
    }

    translate(key) {
        if (this.i18n) {
            let value = this.i18n.locale_data.messages[key][0];
            if (value)
                return value;
        }
        return key;
    };

    get id() {
        return this.details.id;
    }

    get name() {
        return this._context.name;
    }

    get ns() {
        return this._context.ns;
    }

    getOptions() {
        this.refreshDetails();
        return this.details.options;
    }

    refreshDetails() {
        if (this.isReady)
            this.details = this._context.getDetails();
        else
            throw 'Analysis object is not ready';
    }

    hasUserOptions() {
        return true;
    }

    setOptions(values) {
        this._context.setOptions(values);
    }

    notifyColumnsRenamed(columnRenames) {
        /*for (let i = 0; i < columnRenames.length; i++)
            this.options.renameColumn(columnRenames[i].oldName, columnRenames[i].newName);
        this.revision++;*/
    }

    notifyLevelsRenamed(levelRenames) {
        /*for (let i = 0; i < levelRenames.length; i++)
            this.options.renameLevel(levelRenames[i].variable, levelRenames[i].oldLabel, levelRenames[i].newLabel);
        this.revision++;*/
    }

    clearColumnUse(columnNames) {
        /*for (let i = 0; i < columnNames.length; i++)
            this.options.clearColumnUse(columnNames[i]);
        this.revision++;
        if (this._parent !== null)
            this._parent._notifyOptionsChanged(this);*/
    }

    getUsingColumns() {
        //return this.options.getAssignedColumns();
    }

    getUsingOutputs() {
        //return this.options.getAssignedOutputs();
    }
}

customElements.define('jmv-results', ResultsContext);
customElements.define('jmv-analysis', AnalysisContext);