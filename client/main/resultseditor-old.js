'use strict';

import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { HeadingNode, QuoteNode, registerRichText, $createHeadingNode, $createQuoteNode, $isHeadingNode } from '@lexical/rich-text';
import { mergeRegister, $getNearestNodeOfType } from '@lexical/utils';
import { copyToClipboard } from '@lexical/clipboard';
import { $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND, LinkNode, toggleLink } from '@lexical/link';
import { $wrapNodes, $isAtNodeEnd, $patchStyleText, $setBlocksType } from '@lexical/selection';
import { $isListItemNode, ListNode, ListItemNode, insertList, removeList } from '@lexical/list';
import { CodeNode, $createCodeNode } from '@lexical/code';
import { registerMarkdownShortcuts, TRANSFORMERS } from '@lexical/markdown';
import * as Y from 'yjs';
import { Awareness } from './awareness';
import { AnalysisNode, $createAnalysisNode } from './lexical/analysisnode';

import {
    createBinding,
    syncLexicalUpdateToYjs,
    syncYjsChangesToLexical,
} from '@lexical/yjs';

const ActionHub = require('./actionhub');

import {
    createEditor,
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    KEY_TAB_COMMAND,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    REDO_COMMAND,
    UNDO_COMMAND,
    COMMAND_PRIORITY_LOW,
    COMMAND_PRIORITY_EDITOR,
    COMMAND_PRIORITY_HIGH,
    $getSelection,
    KEY_ENTER_COMMAND,
    $isRangeSelection,
    OUTDENT_CONTENT_COMMAND,
    INDENT_CONTENT_COMMAND,
    TextNode,
    ElementNode,
    $applyNodeReplacement
} from 'lexical';

const TEXT_COLOR_COMMAND = 'text-color';
const HIGHLIGHT_COMMAND = 'highlight';

const blockTypeToBlockName = {
    bullet: 'Bulleted List',
    check: 'Check List',
    code: 'Code Block',
    h1: 'Heading 1',
    h2: 'Heading 2',
    h3: 'Heading 3',
    h4: 'Heading 4',
    h5: 'Heading 5',
    h6: 'Heading 6',
    number: 'Numbered List',
    paragraph: 'Normal',
    quote: 'Quote'
};

class ResultsEditor extends HTMLElement {

    constructor() {
        super();

        this._root = this.attachShadow({ mode: 'open' });
        this._host = this._root.host;
        this.nodes = { };

        this._root.innerHTML = `
            <style>
                ${this._css()}
            </style>
            <div class="editor" contenteditable></div>`;

        this.doc = new Y.Doc();

        const docId = "dummy-id";
        const provider = this.createNoOpProvider(this.doc);

        provider.awareness.on('change', () => {
            console.log(provider.awareness.getLocalState());
        });


        // Editor variables
        this.canUndo = false;
        this.canRedo = false;
        this.el = this._root.querySelector('.editor');

        // Create Editor////
        this.editor = createEditor({
            namespace: 'jmv-results',
            editable: true,
            editorState: null,
            // Register nodes specific for @lexical/rich-text
            nodes: [HeadingNode, QuoteNode, ListNode,
                ListItemNode, LinkNode, CodeNode, AnalysisNode],
            onError: (error) => {
                throw error;
            },
            theme: {
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
        });
        this.editor.setRootElement(this.el);
        ////////////////////

        this.binding = createBinding(this.editor, provider, docId, this.doc, new Map([[docId, this.doc]]));

        this.registerCollaborationListeners(this.editor, provider, this.binding);
        this.doc.on('update', (update, origin, doc) => {
            if (origin === this.binding)
                this.sendUpdate(update);
        });

        this.historyState = createEmptyHistoryState();

        // Log editor state to console///////
        this.editor.registerUpdateListener(({ editorState }) => {
            editorState.read(() => {
                console.log($getSelection());
                console.log(this.editor.getEditorState().toJSON());
                this.getSelectedBlockType();
            });
        });
        ////////////////////////////////////

        // Registring Plugins
        mergeRegister(
            registerMarkdownShortcuts(this.editor, TRANSFORMERS),
            registerRichText(this.editor),
            registerDragonSupport(this.editor),
            registerHistory(this.editor, this.historyState, 300),
        );

        // Initial contents//////
        /*this.editor.update(() => {
            const root = $getRoot();
            if (root.getFirstChild() !== null) {
            return;
            }
        
            const heading = $createHeadingNode('h1');
            heading.append($createTextNode('Results'));
            root.append(heading);
            const quote = $createParagraphNode();
            quote.append(
                $createTextNode(
                `In case you were wondering what the text area at the bottom is – it's the debug view, showing the current state of the editor. `,
            ),
            );
            root.append(quote);
            const paragraph = $createParagraphNode();
            paragraph.append(
            $createTextNode('This is a demo environment built with '),
            $createTextNode('lexical').toggleFormat('code'),
            $createTextNode('.'),
            $createTextNode(' Try typing in '),
            $createTextNode('some text').toggleFormat('bold'),
            $createTextNode(' with '),
            $createTextNode('different').toggleFormat('italic'),
            $createTextNode(' formats.'),
            );
            root.append(paragraph);
        }, {tag: 'history-merge'});*/
        ///////////////////////

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
        )

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
        );

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
        );

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
        );

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
        );

        // Can undo command callback
        this.editor.registerCommand(
            CAN_UNDO_COMMAND,
            (payload) => {
                this.canUndo = payload;
                return false;
            },
            COMMAND_PRIORITY_LOW
        );

        // Can redo command callback
        this.editor.registerCommand(
            CAN_REDO_COMMAND,
            (payload) => {
                this.canRedo = payload;
                return false;
            },
            COMMAND_PRIORITY_LOW
        );

        this.createToolbarBindings();
    }

    setFocus() {
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


    registerCollaborationListeners(editor, provider, binding) {
        const unsubscribeUpdateListener = editor.registerUpdateListener(
            ({
                dirtyElements,
                dirtyLeaves,
                editorState,
                normalizedNodes,
                prevEditorState,
                tags,
            }) => {
                if (tags.has('skip-collab') === false) {
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
            },
        );

        const observer = (events, transaction) => {
            if (transaction.origin !== binding)
                syncYjsChangesToLexical(binding, provider, events, false);
        };

        binding.root.getSharedType().observeDeep(observer);

        return () => {
            unsubscribeUpdateListener();
            binding.root.getSharedType().unobserveDeep(observer);
        };
    }

    createNoOpProvider(doc) {
        const emptyFunction = () => { };

        return {
            awareness: new Awareness(doc),
            connect: emptyFunction,
            disconnect: emptyFunction,
            off: emptyFunction,
            on: emptyFunction,
        };
    }

    createToolbarBindings() {
        ActionHub.get('textCut').on('request', (source) => document.execCommand('cut'));
        ActionHub.get('textCopy').on('request', (source) => copyToClipboard(this.editor, null));
        ActionHub.get('textPaste').on('request', (source) => document.execCommand('paste'));
        ActionHub.get('textBold').on('request', (source) => this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"));
        ActionHub.get('textItalic').on('request', (source) => this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"));
        ActionHub.get('textUnderline').on('request', (source) => this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"));
        ActionHub.get('textStrike').on('request', (source) => this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"));
        ActionHub.get('textSubScript').on('request', (source) => this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "subscript"));
        ActionHub.get('textSuperScript').on('request', (source) => this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "superscript"));
        ActionHub.get('textIndentRight').on('request', () => this.editor.dispatchCommand(INDENT_CONTENT_COMMAND, null));
        ActionHub.get('textIndentLeft').on('request', () => this.editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, null));
        ActionHub.get('textAlignCenter').on('request', () => this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center"));
        ActionHub.get('textAlignLeft').on('request', () => this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left"));
        ActionHub.get('textAlignRight').on('request', () => this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right"));
        ActionHub.get('textAlignJustify').on('request', () => this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify"));
        ActionHub.get('textListBullet').on('request', (source) => insertList(this.editor, "bullet"));
        ActionHub.get('textListOrdered').on('request', (source) => insertList(this.editor, "number"));
        ActionHub.get('textColor').on('request', (source) => {
            if (source.name !== 'textColor')
                this.editor.dispatchCommand(TEXT_COLOR_COMMAND, { color: source.name === 'tcReset' ? '' : source.title });
        });
        ActionHub.get('textBackColor').on('request', (source) => {
            if (source.name !== 'textBackColor')
                this.editor.dispatchCommand(HIGHLIGHT_COMMAND, { color: source.name === 'tcReset' ? '' : source.title });
        });
        ActionHub.get('textUndo').on('request', () => {
            if (this.canUndo)
                this.editor.dispatchCommand(UNDO_COMMAND, null);
        });
        ActionHub.get('textRedo').on('request', () => {
            if (this.canRedo)
                this.editor.dispatchCommand(REDO_COMMAND, null);
        });
        ActionHub.get('textLink').on('request', () => {
            const url = 'https://www.jamovi.org';
            this.editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
        });

        ActionHub.get('textH2').on('request', (source) => {
            this.formatHeading(this.blockType, 'h1');
        });

        ActionHub.get('textCodeBlock').on('request', (source) => {
            this.formatCode(this.blockType);
        });
    }

    getSelectedBlockType() {
        this.editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                const anchorNode = selection.anchor.getNode();
                const blockNode = $getNearestNodeOfType(anchorNode, ElementNode);
                if (blockNode) {
                    this.blockType = $isHeadingNode(blockNode) ? blockNode.getTag() : blockNode.getType();
                    console.log(`Current Block Type: ${this.blockType}`);
                } else {
                    console.log('No block type found');
                }
            } else {
                console.log('No selection');
            }

        });
    }

    _isElement(item) {
        return (typeof HTMLElement === "object" ? item instanceof HTMLElement : //DOM2
            item && typeof item === "object" && item !== null && item.nodeType === 1 && typeof item.nodeName === "string");
    }

    _css() {
        return `
            :host {

            }

            .editor {
                padding: 0px 50px;
            }
        `;
    }

    insertAnalysis(insertIndex, analysis) {
        this.editor.update(() => {
            if (!insertIndex || insertIndex < 0) {
                let currentIndex = this.currentBlockIndex();
                insertIndex = currentIndex == -1 ? this.blockCount() - 1 : currentIndex;
            }
            const root = $getRoot();
            let analysisNode = $createAnalysisNode(analysis.id, analysis.ns, analysis.name);
            this.nodes[analysis.id] = analysisNode;
            const children = root.getChildren();

            let child = children[insertIndex];
            if ( ! child)
                root.append(analysisNode);
            else
                child.insertAfter(analysisNode);

            analysis.ready.then(() => {
                this.editor.update(() => {
                    analysisNode.setOptions(analysis.options.getValues());
                });
            });
            
            console.log(`analysis added index ${insertIndex}`);
        });
    }

    getState() {

    }

    blockCount() {
        return this.el.childElementCount
    }

    currentBlock() {
        let child = this._getBlockWithSelectionCaret();
        if (child == null)
            return -1;

        let parent = child.parentElement;
        while (parent && parent.classList.contains('editor') === false) {
            child = parent;
            parent = child.parentElement;
        }

        if (parent == null)
            return null;

        return child;
    }

    currentBlockIndex() {
        let child = this._getBlockWithSelectionCaret();
        if (child == null)
            return -1;

        let parent = child.parentElement;
        while (parent && parent.classList.contains('editor') === false) {
            child = parent;
            parent = child.parentElement;
        }

        if (parent == null)
            return -1;

        var i = 0;
        while ((child = child.previousSibling) != null)
            i++;
        return i;
    }

    _getBlockWithSelectionCaret() {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            const nodes = selection.getNodes();
            if (nodes.length > 0) {
                let element = this.editor.getElementByKey(nodes[nodes.length - 1].__key);
                console.log(element)
                return element;
            }

            return null
        }
    }

    sendUpdate(update) {
        let coms = this.instance.attributes.coms;

        let docPB = new coms.Messages.ProjectRR();
        docPB.op = coms.Messages.GetSet.SET;
        docPB.incDoc = true;
        docPB.docUpdate = update;

        let request = new coms.Messages.ComsMessage();
        request.payload = docPB.toArrayBuffer();
        request.payloadType = 'ProjectRR';
        request.instanceId = this.instance.instanceId();

        return coms.send(request).then(response => {
            console.log('sent')
        });
    }

    getDoc() {
        let coms = this.instance.attributes.coms;

        let docPB = new coms.Messages.ProjectRR();
        docPB.op = coms.Messages.GetSet.GET;
        docPB.incDoc = true;

        let request = new coms.Messages.ComsMessage();
        request.payload = docPB.toArrayBuffer();
        request.payloadType = 'ProjectRR';
        request.instanceId = this.instance.instanceId();

        return coms.send(request).then(response => {
            let docPB = coms.Messages.ProjectRR.decode(response.payload);
            this._processDocumentUpdateMessage(docPB);
        });
    }

    _processDocumentUpdateMessage(docPB) {
        let update = docPB.docUpdate.toBuffer();
        update = new Uint8Array(update);
        Y.applyUpdate(this.doc, update);
        this.editor.update(() => { }, { discrete: true }); // is needed to update stuff for some reason
    }

    setInstance(instance) {
        this.instance = instance;
        this.instance.analyses().on('analysisOptionsChanged', this._optionsChanged, this);
    }

    _optionsChanged(analysis, incoming) {
        if ( ! incoming) {
            this.editor.update(() => {
                this.nodes[analysis.id].setOptions(analysis.options.getValues());
            });
        }
    }
}

customElements.define('results-editor', ResultsEditor);
module.exports = ResultsEditor;
