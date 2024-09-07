import type { View, Node, Text, Position } from "noss-editor";
import type { NodeRoot, DOMNode, DOMElement, DOMText } from "./types";
import type { Diff } from "noss-editor";
import { MethodError } from "@noss-editor/utils";
import { NodeView, EditorView } from "noss-editor";
import { DOMObserver } from "./observer";
import { ChangeType } from "noss-editor";

// TODO: Allow to derive state from the content of the root node
export class DOMView extends EditorView<HTMLElement, NodeRoot> {
  /**
   * The provided element, either via the constructor or via the `mount` method,
   * or a created element that can be appended to the document.
   */
  root: HTMLElement = document.createElement("div");

  observer: DOMObserver = new DOMObserver();

  override update(diff: Diff) {
    for (const change of diff.changes) {
      if (change.type === ChangeType.insert) {
        // figure out pos
      } else {
        // renderNodeRecursive
      }
    }
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

  override toNode(element: DOMNode): Node {
    const bound = element._boundNode;
    if (bound) return bound;
    else if ((element as HTMLElement).tagName === "BODY")
      throw new MethodError("Failed to get bound node, searched up to the body tag", "DOMView.toNode");
    else if (!element.parentNode)
      throw new MethodError("Failed to get bound node, node doesn't have a parentNode", "DOMView.toNode");

    return this.toNode(element.parentNode);
  }
}

function renderNodeRecursive(node: Node): DOMElement | DOMText | null {
  const view = <NodeView<HTMLElement> | undefined>node.view;
  if (!view || !(view instanceof NodeView)) return null;

  if (view.name === "text" || view.node?.type.schema.text) {
    const res = (<NodeView<string>>node.view).render();
    const text = document.createTextNode(res);
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
