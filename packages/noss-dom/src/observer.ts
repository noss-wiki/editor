import type { DOMView } from "./view";
import type { Node, Text, Transaction } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import type { DOMText } from "./types";
import { InsertTextStep, NodeType, Position, InsertStep, RemoveStep, RemoveTextStep } from "noss-editor";
import { Err, MethodError, Ok, wrap } from "@noss-editor/utils";
import { DOMNode } from "./types";
import { diffText } from "./diff";

export class DOMObserver {
  readonly observer: MutationObserver;
  readonly view!: DOMView;
  readonly pending: MutationRecord[] = [];

  constructor() {
    this.observer = new MutationObserver((e) => {
      for (const record of e) {
        this.callback(record)
          .try((tr) => (tr ? this.view.state.apply(tr) : Ok(null)))
          .mapErr((err) => console.error(err));
      }
    });
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

  private callback(record: MutationRecord): Result<Transaction | null, string> {
    console.log(record);
    if (record.type === "characterData") {
      const t = record.target;
      if (t.nodeType === DOMNode.TEXT_NODE) {
        const node = this.view.toNode(t);
        const text = record.target as DOMText;
        if (node.err) return Err("Failed to get bound node from DOM node");
        if (!node.val.type.schema.text)
          return Err(`Node type mismatch; DOM node is text node, but bound node type: ${node.val.type.name}, isn't`);

        return calculateText(this.view.state.tr, node.val as Text, text.data);
      }
    } else if (record.type === "childList") {
      const parent = this.view.toNode(record.target);
      if (parent.err) return parent;

      const tr = this.view.state.tr;
      for (const c of record.addedNodes) {
        if (c.nodeType === DOMNode.ELEMENT_NODE && (<HTMLElement>c).tagName === "BR") continue;
        const index = wrap(() => Array.from(record.target.childNodes).indexOf(c as ChildNode)).unwrap(-1);
        if (index === -1) return Err("Failed to get index of added node");

        if (c.nodeType === DOMNode.TEXT_NODE) {
          if ((c as DOMText).data === "") continue;
          const text = createTextNode((c as DOMText).data);
          c.parentNode?.removeChild(c);
          tr.insertChild(text, parent.val, index);
        }
      }

      for (const c of record.removedNodes) {
        if (c.nodeType === DOMNode.TEXT_NODE) {
          const text = <DOMText>c;
          if (text.data === "") {
          }
        }
      }

      return Ok(tr);
    }
    return Err("Unhandled case");
  }
}

/**
 * Calculates the transaction steps to apply to the text node to make it match the expected text.
 * This method only expects the changes to have happened on one position in the text node.
 * This method modifies the transaction and returns the result, but that parameter is still modified.
 */
function calculateText(tr: Transaction, node: Text, expected: string): Result<Transaction, string> {
  if (expected === "")
    return tr //
      .softStep(new RemoveStep(node))
      .replace(tr);

  const diff = diffText(node.text, expected);
  if (diff.type === "none") return Err("No changes detected in the text node");
  else if (diff.type === "replace")
    return tr
      .softStep(new RemoveTextStep(node, diff.start, diff.end))
      .try(() => tr.softStep(new InsertTextStep(node, diff.added, diff.start)))
      .replace(tr);
  else if (diff.type === "insert")
    return tr //
      .softStep(new InsertTextStep(node, diff.change, diff.start))
      .replace(tr);
  else
    return tr //
      .softStep(new RemoveTextStep(node, diff.start, diff.end))
      .replace(tr);
}

/**
 * @throws {MethodError}
 */
function createTextNode(content: string): Text {
  // @ts-ignore : `node` will never be the direct Node instance, but a subclass of it.
  return new (NodeType.get("text").node)(content);
}
