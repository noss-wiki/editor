import { MethodError } from "@noss-editor/utils";
import type { View, Node } from "noss-editor";
import { NodeView, DocumentView } from "noss-editor";

export class DOMView extends DocumentView<HTMLElement> {
  /**
   * Either inserts this element in the DOM or call the `mount` method to use a custom root element.
   */
  root: HTMLElement = document.createElement("div");

  mount(element: HTMLElement) {
    this.root = element;
  }

  override render() {
    const document = this.state.document;
    const ele = renderNodeRecursive(document);
    if (!ele)
      throw new MethodError(
        "The document node doesn't have a view attached, so it can't be rendered",
        "DOMView.render",
      );

    this.root.appendChild(ele);

    return ele as HTMLElement;
  }
}

function renderNodeRecursive(node: Node): HTMLElement | Text | null {
  const view = <NodeView<HTMLElement> | undefined>node.view;
  if (!view || !(view instanceof NodeView)) return null;

  if (view.name === "text" || view.node?.type.schema.text) {
    const res = (<NodeView<string>>node.view).render();
    return document.createTextNode(res);
  }
  const { root, outlet } = view.wrapRender();

  for (const [child] of node.content.iter()) {
    const childEle = renderNodeRecursive(child);
    if (!childEle) continue;
    outlet.appendChild(childEle);
  }

  return root;
}
