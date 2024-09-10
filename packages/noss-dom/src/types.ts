import type { Node as EditorNode, Text, NodeView } from "noss-editor";

export const DOMNode = globalThis.Node;
export type DOMNode = globalThis.Node & {
  _nodeId?: string;
};
export type DOMElement = globalThis.HTMLElement & {
  _nodeId?: string;
};
export const DOMText = globalThis.Text;
export type DOMText = globalThis.Text & {
  _nodeId?: string;
};
/**
 * Possible results from a render method;
 * a `Text` node or an `HTMLElement`.
 */
export type NodeRoot = DOMText | DOMElement;
