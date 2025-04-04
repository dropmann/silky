
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
    Table
} from './components/table'


export class TableNode extends ResultNode {

    static getType(): string {
        return 'table';
    }

    static clone(node: TableNode): TableNode {
        return new TableNode(
            node.__data,
            node.__key,
        );
    }

    static importJSON(serializedNode: SerializedResultNode): TableNode {
        return new TableNode(
            serializedNode.data
        ).updateFromJSON(serializedNode);
    }

    updateFromJSON(
        serializedNode: LexicalUpdateJSON<SerializedResultNode>,
    ): this {
        const tableNode = super.updateFromJSON(serializedNode);
        return tableNode;
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
        const table = new Table(decoded, this.getKey())
        div.append(table);
        return div;
    }
}

export function $isTableNode(
    node: LexicalNode | null | undefined,
): node is TableNode {
    let value : boolean = node instanceof TableNode;
    if ( ! value)
        value = node instanceof ResultNode && ('table' === node.__dataType);

    return value;
}

export function $createTableNode(
    data: Uint8Array
): TableNode {
    return new TableNode(data);
}