import type { Result } from "@noss-editor/utils";
import type { View, Node, Text, Position, Diff, TextView } from "noss-editor";
import type { NodeRoot, DOMNode, DOMElement, DOMText } from "./types";
import { Err, MethodError, Ok } from "@noss-editor/utils";
import { NodeView, EditorView, ChangeType } from "noss-editor";
import { DOMObserver } from "./observer";

// TODO: Allow to derive state from the content of the root node
export class DOMView extends EditorView<HTMLElement, NodeRoot> {
  /**
   * The provided element, either via the constructor or via the `mount` method,
   * or a created element that can be appended to the document.
   */
  root: HTMLElement = document.createElement("div");

  observer: DOMObserver = new DOMObserver();

  override update(diff: Diff) {
    this.observer.stop();
    for (const change of diff.changes) {
      if (change.type === ChangeType.insert) {
        // figure out pos
      } else {
        const domNode = this.toDom(change.old);
        if (domNode.err) continue;
        if (change.type === ChangeType.remove) domNode.val.remove();
        else {
          if (change.old.type.schema.text) {
            const text = domNode.val as DOMText;
            text.data = (change.modified as Text).text;
            text._boundNode = <Text>change.modified;
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
    const bound = element._boundNode;
    if (bound) return Ok(bound);
    else if ((element as HTMLElement).tagName === "BODY")
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
}

function renderNodeRecursive(node: Node): DOMElement | DOMText | null {
  const view = <NodeView<HTMLElement> | undefined>node.view;
  if (!view || !(view instanceof NodeView)) return null;

  if (view.name === "text" || view.node?.type.schema.text) {
    const res = (<TextView<DOMText>>node.view).render();
    const text = document.createTextNode(res);
    (<TextView<DOMText>>node.view).textRoot = text;
    (<DOMText>text)._boundNode = <Text>node;
    return text;
  }
  const { root, outlet } = view._render(node);

  for (const [child] of node.content.iter()) {
    const childEle = renderNodeRecursive(child);
    if (!childEle) continue;
    outlet.appendChild(childEle);
  }

  (<DOMNode>root)._boundNode = node;
  (<DOMNode>root)._boundView = view;

  return root;
}
