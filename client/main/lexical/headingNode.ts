import { 
  HeadingNode,
  SerializedHeadingNode
} from '@lexical/rich-text';

import type {
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  Spread,
} from 'lexical';

import {
  $applyNodeReplacement
} from 'lexical';

export type SerializedHeadingNode = Spread<
  {
    path: string;
    visible: boolean;
  },
  SerializedHeadingNode
>;

export class ResultHeadingNode extends HeadingNode {
  __path: string;
  __visible: boolean;
  __defaultValue: string;

  constructor(
    tag, 
    key?: NodeKey, 
    path = '',
    visible = true,
    defaultValue = ''
  ) {
    super(tag, key);
    this.__path = path;
    this.__visible = visible;
    this.__defaultValue = defaultValue;
  }

  static getType() {
    return 'result-heading'; // Important: must match the original node
  }

  static clone(node: ResultHeadingNode) {
    return new ResultHeadingNode(node.__tag, node.__key, node.__path, node.__visible, node.__defaultValue);
  }

  updateVisibility(div) {
    if (this.__visible) {
      div.classList.remove('result_item_hidden');
      if (div.style.height === '0px')
        div.style.height = div.scrollHeight + 'px';
    }
    else {
      div.classList.add('result_item_hidden')
      div.style.height = '0px';
    }
  }

  createDOM(config: EditorConfig, editor): HTMLElement {
    let div = super.createDOM(config, editor);
    div.classList.add('results-item')
    this.updateVisibility(div);
    return div;
  }

  updateDOM(prevNode, div, config) {
    this.updateVisibility(div);
    return false;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      path: this.__path,
      visible: this.__visible,
      defaultValue: this.__defaultValue
    };
  }

  static importJSON(serializedNode: SerializedHeadingNode) {
    const node = new ResultHeadingNode(serializedNode.tag, undefined, serializedNode.path, serializedNode.visible, serializedNode.defaultValue);
    return node;
  }
}

export function $createResultHeadingNode(tag, path, defaultValue) {
  return $applyNodeReplacement(new ResultHeadingNode(tag, undefined, path, defaultValue));
}