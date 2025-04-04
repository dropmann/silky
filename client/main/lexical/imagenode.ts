
import type {
    EditorConfig,
    LexicalNode,
    LexicalUpdateJSON,
    NodeKey
} from 'lexical';

import type {
    SerializedResultNode
} from './resultnode';

import {
    ResultNode
} from './resultnode';

import {
    Image
} from './components/image';


export class ImageNode extends ResultNode {

    static getType(): string {
        return 'image';
    }

    static clone(node: ImageNode): ImageNode {
        return new ImageNode(
            node.__data,
            node.__key,
        );
    }

    static importJSON(serializedNode: SerializedResultNode): ImageNode {
        return new ImageNode(
            serializedNode.data
        ).updateFromJSON(serializedNode);
    }

    updateFromJSON(
        serializedNode: LexicalUpdateJSON<SerializedResultNode>,
    ): this {
        const imageNode = super.updateFromJSON(serializedNode);
        return imageNode;
    }

    constructor(
        data: Uint8Array,
        key?: NodeKey,
    ) {
        super(data, key);
    }

    createDOM(config: EditorConfig): HTMLElement {
        const div = document.createElement('div');
        let decoded = this.decodeData();
        const image = new Image(decoded, this.getKey())
        div.append(image);
        return div;
    }
}

export function $isImageNode(
    node: LexicalNode | null | undefined,
): node is ImageNode {
    let value : boolean = node instanceof ImageNode;
    if ( ! value)
        value = node instanceof ResultNode && ('image' === node.__dataType);

    return value;
}

export function $createImageNode(
    data: Uint8Array
): ImageNode {
    return new ImageNode(data);
}