import type {
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedLexicalNode,
  Spread,

} from 'lexical';

import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { ListNode, ListItemNode } from '@lexical/list';
import { ResultNode } from './resultnode';
import { $generateHtmlFromNodes } from '@lexical/html';
import { ResultHeadingNode, $createResultHeadingNode } from './headingNode'

import {
  DecoratorNode,
  DOMExportOutput,
} from 'lexical';

import { ResultsContext, AnalysisContext } from './editorcontext';

import { RefDef } from './components/references'

import OptionsPB from '../optionspb'

import ProtoBuf from 'protobufjs';
import PROTO_DEFN from '../../assets/coms.proto?raw';

const builder = ProtoBuf.loadProto(PROTO_DEFN);

const Messages = builder.build().jamovi.coms;

export type SerializedAnalysisNode = Spread<
  {
    id: number | null;
    ns: string;
    name: string;
    uuid: string;
    title: string;
    references: Array<RefDef>;
    options: Uint8Array | null;
    dets: Uint8Array | null;
  },
  SerializedLexicalNode
>;

export class AnalysisNode extends DecoratorNode<HTMLElement> {
  __uuid: string;
  __id: number | null;
  __ns: string;
  __name: string;
  __title: string;
  private __references: Array<RefDef>;
  __options: Uint8Array | null;
  __dets: Uint8Array | null;
  __focusOnCreation: boolean;

  static getType(): string {
    return 'analysis';
  }

  static clone(node: AnalysisNode): AnalysisNode {
    return new AnalysisNode(
      node.__ns,
      node.__name,
      node.__uuid,
      node.__id,
      node.__options,
      node.__dets,
      node.__title,
      node.__references,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedAnalysisNode): AnalysisNode {
    return new AnalysisNode(
      serializedNode.ns,
      serializedNode.name,
      serializedNode.uuid,
      serializedNode.id,
      serializedNode.options,
      serializedNode.dets,
      serializedNode.title,
      serializedNode.references,
    ).updateFromJSON(serializedNode);
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedAnalysisNode>,
  ): this {
    const analysisNode = super.updateFromJSON(serializedNode);
    return analysisNode;
  }

  constructor(
    ns: string,
    name: string,
    uuid?: string,
    id?: number | null,
    options?: Uint8Array,
    dets?: Uint8Array,
    title?: string,
    references?: Array<RefDef>,
    key?: NodeKey,
  ) {
    super(key);
    this.__id = id || null
    this.__ns = ns;
    this.__name = name;
    this.__uuid = uuid || crypto.randomUUID();
    this.__focusOnCreation = false;

    this.__dets = dets || null;


    this.__title = title || name;
    this.__options = options || null;
    this.__references = references || null; /* [{
      name: `Damo ${this.__title}`,
      type: 'Manware',
      authors: { complete: 'Damian Dropmann' },
      year: 2077,
      title: `A book about how awesome he is ${this.__title}`,
      publisher: '(Version 7.7) [Computer software]. Retrieved from https://cran.r-project.org',
      url: 'https://damo-is-cool.org',
      extra: 'He is good looking'
    }];*/
  }

  exportJSON(): SerializedAnalysisNode {
    return {
      ...super.exportJSON(),
      uuid: this.__uuid,
      id: this.__id,
      title: this.__title,
      ns: this.__ns,
      name: this.__name,
      options: this.__options,
      dets: this.__dets,
      references: this.__references,
    };
  }

  decodeDets() {
    console.log(this.__dets)
    if (this.__dets === null || this.__dets === undefined)
      return null;

    return Messages.AnalysisResponse.decode(this.__dets);
  }

  decodeOptions() {
    console.log(this.__options)
    if (this.__options === null || this.__options === undefined)
      return null;

    return OptionsPB.fromPB(Messages.AnalysisOptions.decode(this.__options), Messages);
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    let div = document.createElement('div');
    div.classList.add('jmv-analysis-wrapper');

    setTimeout(() => {
      let analysis = new AnalysisContext(this.__uuid, this.__ns, this.__name, this.getKey());
      analysis.setAllowedNodes(HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode, AnalysisNode, ResultNode, ResultHeadingNode);

      analysis.classList.add('analysis-content');
      div.append(analysis);
    }, 0);

    return div;
  }


  public set focusOnCreation(value: boolean) {
    this.__focusOnCreation = value;
  }

  public get focusOnCreation(): boolean {
    return this.__focusOnCreation;
  }

  public get references() {
    let dets = this.decodeDets();
    if (dets)
      return dets.references;

    return [];
  }

  public get ns() {
    return this.__ns;
  }

  public get AnalysisId() {
    return this.__id;
  }

  public getDetails() {
    return {
      options: this.decodeOptions(),
      name: this.__name,
      id: this.__id,
      ns: this.__ns,
      references: this.__references,
      title: this.__title,
      path: [this.getKey()]
    }
  }

  public setOptions(options: any) {
    console.log('OPTIONS CHANGED for sending')
    const writable = this.getWritable();
    let opts = { ...writable.decodeOptions(), ...options };
    console.log(opts)
    writable.__options = new Uint8Array(OptionsPB.toPB(opts, [], Messages).toArrayBuffer());
    console.log(writable.__options);
  }

  updateDOM(prevNode, dom) {
    // Handles attribute update when node selection changes
    dom.setAttribute(
      'data-lexical-selected',
      this.isSelected() ? 'true' : 'false'
    );
    return false;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    let dom = editor.getElementByKey(this.getKey());
    let analysis = dom.querySelector('jmv-analysis');
    let html = analysis.editor.read(() => {
      return $generateHtmlFromNodes(analysis.editor, null);
    });
    let el = document.createElement('div');
    el.innerHTML = html;
    return { element: el };
  }


  setTitle(title: string): void {
    const writable = this.getWritable();
    writable.__title = title;
  }

  decorate(editor: LexicalEditor, config: EditorConfig): HTMLElement {
    return null;
  }

  isIsolated(): boolean {
    return false;
  }

  isInline(): boolean {
    return true;
  }
}

export function $isAnalysisNode(
  node: LexicalNode | null | undefined,
): node is AnalysisNode {
  return node instanceof AnalysisNode;
}

export function $createAnalysisNode(
  ns: string,
  name: string,
  options: any,
  uuid?: string,
  id?: number,
): AnalysisNode {
  let optionsBytes = new Uint8Array(OptionsPB.toPB(options, [], Messages).toArrayBuffer());
  return new AnalysisNode(ns, name, uuid, id, optionsBytes);
}
