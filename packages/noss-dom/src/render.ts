import type { Node, Text, NodeView } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import type { DOMElement, DOMText, NodeRoot } from "./types";
import type { DOMNodeView } from "./nodeView";
import { Ok, Err } from "@noss-editor/utils";
import { TextView } from "noss-editor";
import { DOMNode } from "./types";

export const trailingBreakAttr = "data-trailing-break";

export function renderBreak() {
  const node = document.createElement("br");
  node.setAttribute(trailingBreakAttr, "true");
  return node;
}

export function renderNode(node: Node): Result<DOMNode, null> {
  if (node.type.schema.text && node.view instanceof TextView) return renderTextNode(node as Text).trace("renderNode");

  const view = node.view as DOMNodeView | undefined;
  if (!view) return Err().trace("renderNode");

  const res = view.renderBind(node);
  if (res.err) return Err().trace("renderNode");

  if (view.emptyBreak && node.content.empty) {
    const outlet = view.outlet as DOMNode;
    outlet.appendChild(renderBreak());
  }

  const root = res.val;
  root._node = node;
  return Ok(root);
}

export function renderTextNode(node: Text): Result<DOMText, null> {
  const view = node.view as TextView<DOMText> | undefined;
  if (!view) return Err().trace("renderTextNode");
  view.bind(node);
  const data = view.render();

  const text = document.createTextNode(data) as DOMText;
  view.textRoot = text;
  text._node = node;
  return Ok(text);
}

export function renderNodeRecursive(node: Node): Result<DOMNode, null> {
  const res = renderNode(node);
  if (res.err) return res.trace("renderNodeRecursive");
  if (res.val.nodeType === DOMNode.TEXT_NODE) return res;

  // It has a view, otherwise renderNode would return `Err`;
  const view = node.view as NodeView<DOMNode>;
  const outlet = view.outlet as DOMNode;

  for (const [child] of node.content.iter()) {
    const childEle = renderNodeRecursive(child);
    if (childEle.err) return childEle.trace("renderNodeRecursive");
    outlet.appendChild(childEle.val);
  }

  return Ok(res.val);
}

export function getDOMFromNode(node: Node, boundary: Node, root: DOMElement): Result<NodeRoot, string> {
  if (node.type.schema.text) {
    const view = <TextView<DOMText> | undefined>node.view;
    if (view?.textRoot) return Ok(view.textRoot);
  } else {
    const view = <NodeView<HTMLElement> | undefined>node.view;
    if (view?.root) return Ok(view.root);
  }

  return traverseDOMRoot(root, node)
    .replaceErr("Failed to get attached DOMNode, is the node rendered?")
    .trace("getDOMNode");
}

function traverseDOMRoot(domNode: DOMNode, search: Node): Result<NodeRoot, null> {
  //console.log(search, domNode, domNode._node?.strictEq(search));
  if (domNode._node?.strictEq(search)) return Ok(<NodeRoot>domNode);
  for (const child of domNode.childNodes) {
    const res = traverseDOMRoot(child as DOMNode, search);
    if (res.ok) return res;
  }
  return Err().trace("traverseDOMRoot");
}

export function getNodeFromDOM(node: DOMNode, boundary: Node): Result<Node, string> {
  if (node._node) {
    // TODO: Check if node is part of current boundary, if not map throug transformations?
    // or maybe keep a map of special domnode ids to nodes?
    return Ok(node._node);
  }

  if ((<DOMElement>node).tagName === "BODY")
    return Err("Failed to get bound node, searched up to the body tag", "getNodeFromDOM");
  else if (!node.parentNode) return Err("Failed to get bound node, node doesn't have a parentNode", "getNodeFromDOM");

  return getNodeFromDOM(node.parentNode, boundary);
}

export function updateRefUpwards(domNode: DOMNode, oldBoundary: Node, modifiedBoundary: Node): Result<null, string> {
  const node = getNodeFromDOM(domNode, oldBoundary);
  if (node.err) return node.trace("updateRefUpwards");
  return Err("Not implemented", "updateRefUpwards");
}

// DOM helper methods

export function insertAtIndex(parent: DOMNode, child: DOMNode, index?: number): Result<null, string> {
  if (!index) {
    parent.appendChild(child);
    return Ok(null);
  }

  let i = 0;
  for (const c of parent.childNodes) {
    if (c.nodeType === DOMNode.ELEMENT_NODE) {
      const e = c as DOMElement;
      if (e.tagName === "BR" && e.hasAttribute(trailingBreakAttr)) continue;
    }

    if (i === index) {
      parent.insertBefore(child, c);
      return Ok(null);
    }

    i++;
  }

  if (i === index) {
    parent.appendChild(child);
    return Ok(null);
  }

  return Err("Index is out of range", "insertAtIndex");
}
