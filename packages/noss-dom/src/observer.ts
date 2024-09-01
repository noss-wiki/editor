import type { DOMView } from "./view";
import type { Node, Text } from "noss-editor";
import { MethodError } from "@noss-editor/utils";
import { DOMNode, DOMText } from "./types";
import { diffText } from "./diff";

export class DOMObserver {
  readonly observer: MutationObserver;
  readonly view!: DOMView;

  get stateTr() {
    return this.view.state.tr;
  }

  constructor() {
    this.observer = new MutationObserver((e) => this.callback(e));
  }

  bind(view: DOMView) {
    // @ts-ignore : Set here instead of constructor
    this.view = view;
  }

  start() {
    this.observer.observe(this.view.root, {
      characterData: true,
      characterDataOldValue: true,
      childList: true,
      subtree: true,
    });
  }

  stop() {
    this.observer.disconnect();
  }

  private callback(e: MutationRecord[]) {
    for (const record of e) {
      if (record.type === "characterData") {
        const t = record.target;
        if (t.nodeType === DOMNode.TEXT_NODE) {
          const node = this.view.toNode(t) as Text;
          const text = record.target as DOMText;
          if (!node.type.schema.text)
            throw new MethodError("Node type mismatch; DOM node is text node, but bound node isn't", "anonymous");
          const diff = diffText(node.text, text.data);
          console.log(diff)
        }
      }
    }
  }
}
