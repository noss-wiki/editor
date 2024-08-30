import type { Node as EditorNode, Text, NodeView } from "noss-editor";

export const DOMNode = globalThis.Node;
export type DOMNode = globalThis.Node & {
  _boundView?: NodeView<Node>;
  _boundNode?: EditorNode;
};
export const DOMText = globalThis.Text;
export type DOMText = globalThis.Text & {
  _boundNode?: Text;
};
/**
 * Possible results from a render method;
 * a `Text` node or an `HTMLElement`.
 */
export type NodeRoot = DOMText | HTMLElement;

/**
 * Interface for the properties that are attached to a root node element that is created by the editor.
 * These props are attached on the `root` element; the element returned from the render hook, when the node is inserted into the DOM.
 */
export interface NodeViewElement extends HTMLElement {
  _boundView: NodeView<HTMLElement>;
  _boundNode: EditorNode;
}

export interface TextViewElement extends DOMText {
  _boundNode: Text;
}
