import type { Result } from "@noss-editor/utils";
import type { View, Node, Text, Diff, TextView, Transaction } from "noss-editor";
import type { NodeRoot, DOMNode, DOMElement, DOMText } from "./types";
import { Err, MethodError, Ok } from "@noss-editor/utils";
import { NodeView, EditorView, ChangeType, Position, Selection, getParentNode } from "noss-editor";
import { DOMObserver } from "./observer";
import { getNodeById } from "noss-editor/src/model/position";

// TODO: Allow to derive state from the content of the root node
export class DOMView extends EditorView<HTMLElement, NodeRoot> {
  /**
   * The provided element, either via the constructor or via the `mount` method,
   * or a created element that can be appended to the document.
   */
  root: HTMLElement = document.createElement("div");

  observer: DOMObserver = new DOMObserver();

  override update(tr: Transaction, diff: Diff) {
    this.observer.stop();
    for (const change of diff.changes) {
      console.log(change);
      if (change.type === ChangeType.insert) {
        const child = change.modified;
        const parent = getParentNode(change.modified, child);
        console.log(parent.val);
      } else {
        const domNode = this.toDom(change.old);
        if (domNode.err) continue;
        if (change.type === ChangeType.remove) domNode.val.remove();
        else {
          if (change.old.type.schema.text) {
            const text = domNode.val as DOMText;
            text.data = (change.modified as Text).text;
            text._nodeId = change.modified.id;
            if (change.modified.view) (<TextView<DOMText>>change.modified.view).textRoot = text;
          } else {
            // TODO: don't rerender entire tree of children are not modified (change.kind)
            const newNode = renderNodeRecursive(change.modified);
            if (!newNode) continue;
            domNode.val.replaceWith(newNode);
          }
        }
      }
    }

    if (tr.selection) this.setSelection(tr.selection);
    this.observer.start();
  }

  override render() {
    this.observer.stop();
    const document = this.state.document;
    const ele = renderNodeRecursive(document);
    if (!ele)
      throw new MethodError(
        "The document node doesn't have a view attached, so it can't be rendered",
        "DOMView.render",
      );

    this.root.innerHTML = "";
    this.root.appendChild(ele);
    this.root.contentEditable = "true";

    this.observer.bind(this);
    this.observer.start();

    return ele as HTMLElement;
  }

  override toNode(element: DOMNode): Result<Node, string> {
    const id = element._nodeId;
    if (id) {
      const bound = getNodeById(this.state.document, id);
      return bound.replaceErr(`Failed to find node with id: ${id}`);
    } else if ((element as HTMLElement).tagName === "BODY")
      return Err("Failed to get bound node, searched up to the body tag");
    else if (!element.parentNode) return Err("Failed to get bound node, node doesn't have a parentNode");

    return this.toNode(element.parentNode);
  }

  // TODO: maybe implement some more ways to get the node from the DOM (via parents?)
  override toDom(node: Node): Result<NodeRoot, string> {
    if (node.type.schema.text) {
      const view = <TextView<DOMText> | undefined>node.view;
      if (view?.textRoot) return Ok(view.textRoot);
      else return Err("Text node doesn't have a text root");
    } else {
      const view = <NodeView<HTMLElement> | undefined>node.view;
      if (view?.root) return Ok(view.root);
      else return Err("Node doesn't have a root");
    }
  }

  override getSelection(boundary: Node): Result<Selection, string> {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !sel.focusNode) return Err("No selection found");

    const anchor = this.toNode(sel.anchorNode) //
      .try((node) => Position.offset(node, sel.anchorOffset).resolve(boundary));
    const focus = this.toNode(sel.focusNode) //
      .try((node) => Position.offset(node, sel.focusOffset).resolve(boundary));

    if (anchor.err || focus.err) return Err("Failed to resolve selection node positions");
    return Ok(new Selection(anchor.val, focus.val));
  }

  setSelection(sel: Selection) {
    const anchor = this.toDom(sel.anchor.parent);
    const focus = this.toDom(sel.focus.parent);

    if (anchor.err || focus.err) return;
    const selection = window.getSelection();
    selection?.setBaseAndExtent(anchor.val, sel.anchor.offset, focus.val, sel.focus.offset);
  }
}

function renderNodeRecursive(node: Node): DOMElement | DOMText | null {
  const view = <NodeView<HTMLElement> | undefined>node.view;
  if (!view || !(view instanceof NodeView)) return null;

  if (view.name === "text" || view.node?.type.schema.text) {
    const res = (<TextView<DOMText>>node.view).render();
    const text = document.createTextNode(res);
    (<TextView<DOMText>>node.view).textRoot = text;
    (<DOMText>text)._nodeId = node.id;
    return text;
  }
  const { root, outlet } = view._render(node);

  for (const [child] of node.content.iter()) {
    const childEle = renderNodeRecursive(child);
    if (!childEle) continue;
    outlet.appendChild(childEle);
  }

  (<DOMNode>root)._nodeId = node.id;

  return root;
}
