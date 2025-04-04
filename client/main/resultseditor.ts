'use strict';

import { registerDragonSupport } from '@lexical/dragon';
import { createEmptyHistoryState, registerHistory, HistoryState } from '@lexical/history';
import { registerRichText, $createHeadingNode } from '@lexical/rich-text';
import { copyToClipboard } from '@lexical/clipboard';
import { mergeRegister } from '@lexical/utils';
import { TOGGLE_LINK_COMMAND, toggleLink } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import { $isListItemNode, insertList } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { registerMarkdownShortcuts, TRANSFORMERS } from '@lexical/markdown';
import { ActionHub } from './actionhub';
import { EditorContext } from './lexical/editorcontext';

import {
    createEditor,
    $createParagraphNode,
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
    LexicalEditor,
} from 'lexical';

const TEXT_COLOR_COMMAND = 'text-color';
const HIGHLIGHT_COMMAND = 'highlight';

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

export class ResultsEditor extends HTMLElement {
    _root: ShadowRoot;
    _host: Element;
    canUndo: boolean;
    canRedo: boolean;
    el: HTMLElement | null;
    editor: LexicalEditor;
    historyState: HistoryState;
    blockType: string;

    constructor(context?: EditorContext) {
        super();

        if (!context)
            return;

        this._root = this.attachShadow({ mode: 'open' });
        this._host = this._root.host;

        this._root.innerHTML = `<style>${this._css()}</style><div class="editor" contenteditable></div>`;

        // Editor variables
        this.canUndo = false;
        this.canRedo = false;
        this.el = this._root.querySelector('.editor');

        let nodes = null;
        if (context)
            nodes = context.allowedNodes;

        this.editor = createEditor({
            namespace: 'jmv-results',
            editable: true,
            editorState: null,
            nodes: nodes,
            onError: (error) => {
                throw error;
            },
            theme: THEME
        });

        if (context)
            context.lexicalEditorFinalisation(this.editor);

        this.editor.setRootElement(this.el);

        this.historyState = createEmptyHistoryState();


        // Registring Plugins
        mergeRegister(
            registerMarkdownShortcuts(this.editor, TRANSFORMERS),
            registerRichText(this.editor),
            registerDragonSupport(this.editor),
            registerHistory(this.editor, this.historyState, 300),
        );

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

    _css() {
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

            .analysis-selected {
                outline: 2px solid #3e6da9;
            }

            .jmv-analysis {
                position: relative;
                transition: background-color .2s;
                border-radius: 3px;
                margin: 10px 0px;
            }

            .jmv-analysis:not(.analysis-selected):hover {
                /*background-color: #3e6da90d;*/
                outline: 1px solid #b9b9b9;
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
}

customElements.define('results-editor', ResultsEditor);
