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
    path: string;
    data: Uint8Array;
  },
  SerializedLexicalNode
>;

// Pre-Init
const LUT_HEX_4b = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

export class ResultNode extends DecoratorNode<HTMLElement> {
  __path: string;
  __data: Uint8Array;
  __dataType: string;

  static getType(): string {
    return 'result';
  }

  static clone(node: ResultNode): ResultNode {
    return new ResultNode(
      node.__path,
      node.__data,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedResultNode): ResultNode {
    return new ResultNode(
      serializedNode.path,
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
    path: string,
    data: Uint8Array,
    key?: NodeKey,
  ) {
    super(key);
    this.__path = path;
    this.__data = data;
  }
  

  exportJSON(): SerializedResultNode {
    return {
      ...super.exportJSON(),
      data: this.toHex(this.__data),
      path: this.__path
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
    if (this.__data === null || this.__data === undefined)
      return null;

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
    if (decoded !== null) {

      let result: AnalysisElement | null = null;

      const writable = this.getWritable();
      if ('table' in decoded && decoded.table !== null) {
        writable.__dataType = 'table';
        result = new Table(decoded, this.getKey());
      }
      else if ('image' in decoded && decoded.image !== null) {
        writable.__dataType = 'image';
        result = new Image(decoded, this.getKey());
      }

      if (result === null)
        throw 'Unknown result type';

      result.classList.add('content');
      div.setAttribute('data-type', result.type);

      this.updateVisibility(div, decoded);

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
    }
 
    return div;
  }

  updateVisibility(div, data) {
    let visible = data && (data.visible === 0 || data.visible === 2);
    if (visible) {
      div.classList.remove('result_item_hidden');
      if (div.style.height === '0px')
        div.style.height = div.scrollHeight + 'px';
    }
    else {
      div.classList.add('result_item_hidden')
      div.style.height = '0px';
    }
  }

  updateDOM(prevNode, div, config) {
    let result = div.querySelector('.content');
    if (result) {
      let decoded = this.decodeData();
      result.setData(decoded);
      result.render();

      this.updateVisibility(div, decoded);

      return false;
    }
    return true;
  }

  updateData(data: Uint8Array): boolean {
    const writable = this.getWritable();
    writable.__data = data;
    return true;
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
  path: string,
  data: Uint8Array
): ResultNode {
  return new ResultNode(path, data);
}