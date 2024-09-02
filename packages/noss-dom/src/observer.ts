import type { DOMView } from "./view";
import type { Node, Text, Transaction } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import type { DOMText } from "./types";
import { InsertTextStep, Position, RemoveTextStep } from "noss-editor";
import { Err, MethodError, Ok } from "@noss-editor/utils";
import { DOMNode } from "./types";
import { diffText } from "./diff";

export class DOMObserver {
  readonly observer: MutationObserver;
  readonly view!: DOMView;
  readonly pending: Transaction[] = [];

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

          const tr = this.view.state.tr;
          const res = calculateText(node, text.data)
            .replaceErr("Failed to calculate steps to update node")
            .try((step) => tr.softStep(step));

          // TODO: apply if Ok and throw(?) if Err
          if (res.ok) this.pending.push(tr);
        }
      }
    }
  }
}

function calculateText(node: Text, expected: string): Result<InsertTextStep | RemoveTextStep, null> {
  const diff = diffText(node.text, expected);
  if (diff.type === "none") return Err();
  else if (diff.type === "replace") {
    return Err();
  } else if (diff.type === "insert") return Ok(new InsertTextStep(node, diff.change, diff.start));
  else return Ok(new RemoveTextStep(node, diff.start, diff.end));
}
