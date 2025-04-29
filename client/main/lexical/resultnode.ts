import type {
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import {
  DecoratorNode,
  $createNodeSelection,
  $setSelection
} from 'lexical';

import {
  Table
} from './components/table'

import {
  Image
} from './components/image'

import {
  AnalysisElement
} from './components/element'


import ProtoBuf from 'protobufjs';
import PROTO_DEFN from '../../assets/coms.proto?raw';

const builder = ProtoBuf.loadProto(PROTO_DEFN);

const Messages = builder.build().jamovi.coms;


export type SerializedResultNode = Spread<
  {
    data: Uint8Array;
  },
  SerializedLexicalNode
>;

// Pre-Init
const LUT_HEX_4b = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

export class ResultNode extends DecoratorNode<HTMLElement> {
  __data: Uint8Array;
  __dataType: string;

  static getType(): string {
    return 'result';
  }

  static clone(node: ResultNode): ResultNode {
    return new ResultNode(
      node.__data,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedResultNode): ResultNode {
    return new ResultNode(
      Uint8Array.fromHex(serializedNode.data)
    ).updateFromJSON(serializedNode);
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedResultNode>,
  ): this {
    const analysisElementNode = super.updateFromJSON(serializedNode);
    return analysisElementNode;
  }

  constructor(
    data: Uint8Array,
    key?: NodeKey,
  ) {
    super(key);
    this.__data = data;
  }
  

  exportJSON(): SerializedResultNode {
    return {
      ...super.exportJSON(),
      data: this.toHex(this.__data)
    };
  }

  
// End Pre-Init
  toHex(buffer) {
    let out = '';
    for (let idx = 0; idx < buffer.length; idx++) {
      let n = buffer[idx];
      out += LUT_HEX_4b[(n >>> 4) & 0xF];
      out += LUT_HEX_4b[n & 0xF];
    }
    return out;
  }

  decodeData() {
    let decoded = Messages.ResultsElement.decode(this.__data);
    const type = this.getType();
    if (type !== ResultNode.getType() && (type in decoded) === false)
      throw `Data doesn't match the node type`;

    return decoded;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    //div.inert = true;
    div.classList.add('results-item');
    let decoded = this.decodeData();

    let result: AnalysisElement | null = null;

    const writable = this.getWritable();
    if ('table' in decoded) {
      writable.__dataType = 'table';
      result = new Table(decoded, this.getKey());
    }
    else if ('image' in decoded) {
      writable.__dataType = 'image';
      result = new Image(decoded, this.getKey());
    }

    if (result === null)
      throw 'Unknown result type';

    div.setAttribute('data-type', result.type);

    /*result.addEventListener('click', () => {
      result.parent.setFocus();
      result.parent.editor.update(() => {
          let nodeKey = this.getKey();
          const selection = $createNodeSelection();
          selection.add(nodeKey); // Select the node
          $setSelection(selection);
      });
    });*/

    div.append(result);
 
    return div;
  }

  updateData(data: Uint8Array): boolean {
    const writable = this.getWritable();
    writable.__data = data;
    return true;
  }

  updateDOM(): boolean {
    return false;
  }

exportDOM(editor: LexicalEditor){
  let dom = editor.getElementByKey(this.getKey());
  let item = dom.querySelector('.jmv-results-item');
  let contents = item.getRootElement().querySelector('.contents').cloneNode(true);

  return { element: contents, /*after: (generatedElement: HTMLElement) => {
    console.log('stuff')
    console.log(generatedElement)
   }*/
  };
}

  decorate(editor: LexicalEditor, config: EditorConfig): HTMLElement {
    return null;
  }

  isIsolated(): boolean {
    return false;
  }

  isInline() {
    return true;
  }
}

export function $isResultNode(
  node: LexicalNode | null | undefined,
): node is ResultNode {
  return node instanceof ResultNode;
}

export function $createResultNode(
  data: Uint8Array
): ResultNode {
  return new ResultNode(data);
}