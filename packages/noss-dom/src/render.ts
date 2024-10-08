import type { Node, Text, NodeView } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import type { DOMElement, DOMText } from "./types";
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
  root._nodeId = node.id;
  return Ok(root);
}

export function renderTextNode(node: Text): Result<DOMText, null> {
  const view = node.view as TextView<DOMText> | undefined;
  if (!view) return Err().trace("renderTextNode");
  view.bind(node);
  const data = view.render();

  const text = document.createTextNode(data) as DOMText;
  view.textRoot = text;
  text._nodeId = node.id;
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
