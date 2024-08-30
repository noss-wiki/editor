import { MethodError } from "@noss-editor/utils";
import type { View, Node, Text } from "noss-editor";
import type { NodeRoot, NodeViewElement, TextViewElement, DOMText } from "./types";
import { NodeView, EditorView } from "noss-editor";
import { DOMObserver } from "./observer";

// TODO: Allow to derive state from the content of the root node
export class DOMView extends EditorView<HTMLElement, NodeRoot> {
  /**
   * The provided element, either via the constructor or via the `mount` method,
   * or a created element that can be appended to the document.
   */
  root: HTMLElement = document.createElement("div");

  observer: DOMObserver = new DOMObserver();

  //override update()

  override render() {
    console.log(this.state.document);
    this.observer.bind(this);
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
    this.observer.start();

    return ele as HTMLElement;
  }
}

function renderNodeRecursive(node: Node): HTMLElement | DOMText | null {
  const view = <NodeView<HTMLElement> | undefined>node.view;
  if (!view || !(view instanceof NodeView)) return null;

  if (view.name === "text" || view.node?.type.schema.text) {
    const res = (<NodeView<string>>node.view).render();
    const text = document.createTextNode(res);
    (<TextViewElement>text)._boundNode = <Text>node;
    return text;
  }
  const { root, outlet } = view._render(node);

  for (const [child] of node.content.iter()) {
    const childEle = renderNodeRecursive(child);
    if (!childEle) continue;
    outlet.appendChild(childEle);
  }

  (<NodeViewElement>root)._boundNode = node;
  (<NodeViewElement>root)._boundView = view;

  return root;
}
