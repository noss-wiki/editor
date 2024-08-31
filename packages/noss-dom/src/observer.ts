import type { DOMView } from "./view";
import { DOMNode } from "./types";

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
          const node = this.view.toNode(t);
          console.log(record, node);
        }
      }
    }
  }
}
