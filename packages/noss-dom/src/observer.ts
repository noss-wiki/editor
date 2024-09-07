import type { DOMView } from "./view";
import type { Node, Text, Transaction } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import type { DOMText } from "./types";
import { InsertTextStep, RemoveTextStep } from "noss-editor";
import { Err, MethodError, Ok } from "@noss-editor/utils";
import { DOMNode } from "./types";
import { diffText } from "./diff";

export class DOMObserver {
  readonly observer: MutationObserver;
  readonly view!: DOMView;
  readonly pending: MutationRecord[] = [];

  constructor() {
    this.observer = new MutationObserver((e) => {
      for (const record of e) //this.pending.push(record);
        this.callback(record);
    });
  }

  bind(view: DOMView) {
    // @ts-ignore : Set here instead of constructor
    this.view = view;
  }

  start() {
    this.observer.observe(this.view.root, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  stop() {
    this.observer.disconnect();
  }

  private callback(record: MutationRecord) {
    if (record.type === "characterData") {
      const t = record.target;
      if (t.nodeType === DOMNode.TEXT_NODE) {
        const node = this.view.toNode(t) as Text;
        const text = record.target as DOMText;
        if (!node.type.schema.text)
          throw new MethodError("Node type mismatch; DOM node is text node, but bound node isn't", "anonymous");

        const tr = this.view.state.tr;
        const res = calculateText(tr, node, text.data).try((t) => this.view.state.apply(t));
        if (res.err) console.warn(res.val);
      }
    }
  }
}

/**
 * Calculates the transaction steps to apply to the text node to make it match the expected text.
 * This method only expects the changes to have happened on one position in the text node.
 * This method modifies the transaction and returns the result, but that parameter is still modified.
 */
function calculateText(tr: Transaction, node: Text, expected: string): Result<Transaction, string> {
  const diff = diffText(node.text, expected);
  if (diff.type === "none") return Err("No changes detected in the text node");
  else if (diff.type === "replace") {
    return tr
      .softStep(new RemoveTextStep(node, diff.start, diff.end))
      .try(() => tr.softStep(new InsertTextStep(node, diff.added, diff.start)))
      .replace(tr);
  } else if (diff.type === "insert") return tr.softStep(new InsertTextStep(node, diff.change, diff.start)).replace(tr);
  else return tr.softStep(new RemoveTextStep(node, diff.start, diff.end)).replace(tr);
}
