import { DecoratorNode, $createParagraphNode, $getSelection, NodeKey } from 'lexical';

export class PlaceholderNode extends DecoratorNode {
    private __text: string;

    constructor(text: string, key?: NodeKey) {
        super(key);

        this.__text = text;
    }

    static getType() {
        return 'placeholder';
    }

    static clone(node) {
        return new PlaceholderNode(node.__text, node.__key);
    }

    get placehoderText() {
        return this.__text;
    }

    createDOM(config, editor) {
        const div = document.createElement('div');
        div.textContent = this.__text;
        div.style.color = '#aaa';
        div.style.cursor = 'text';
        div.style.padding = '5px';

        // On click, replace with ParagraphNode
        div.addEventListener('click', () => {
            editor.update(() => {
                editor.update(() => {
                    const paragraphNode = $createParagraphNode();
                    paragraphNode.select();
                    this.replace(paragraphNode);
                });
            });
        });

        return div;
    }

    decorate() {
        return null;
    }

    updateDOM() {
        return false;
    }

    // ⛔ Prevent this node from being saved to file
    exportJSON() {
        return null; // This ensures it won't be included in the export
    }

    static importJSON() {
        return new PlaceholderNode('');
    }
}

export function $createPlaceholderNode(text: string) {
    return new PlaceholderNode(text);
}

export function $isPlaceholderNode(node) {
    return node instanceof PlaceholderNode;
}
