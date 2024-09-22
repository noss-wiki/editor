import type { Node, Text, NodeView } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import type { DOMElement, DOMText, DOMNode } from "./types";
import type { DOMNodeView } from "./nodeView";
import { Ok, Err } from "@noss-editor/utils";
import { TextView } from "noss-editor";

export function renderNode(node: Node): Result<DOMNode, null> {
  if (node.type.schema.text && node.view instanceof TextView) return renderTextNode(node as Text).trace("renderNode");

  const view = node.view as DOMNodeView | undefined;
  if (!view) return Err().trace("renderNode");

  const res = view.renderBind(node);
  if (res.err) return Err().trace("renderNode");

  if (view.emptyBreak && node.content.empty) {
    const outlet = view.outlet as DOMNode;
    outlet.appendChild(document.createElement("br"));
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

  // It has a view, otherwise renderNode would return `Err`;
  const view = node.view as NodeView<DOMNode>;
  const outlet = view.outlet as DOMNode;

  for (const [child] of node.content.iter()) {
    const childEle = renderNodeRecursive(child);
    if (childEle.err) continue; // TODO: maybe warn?
    outlet.appendChild(childEle.val);
  }

  return Ok(res.val);
}