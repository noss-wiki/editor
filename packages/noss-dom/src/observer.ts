import type { DOMView } from "./view";
import type { Node, Text, Transaction } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import type { DOMText } from "./types";
import { InsertTextStep, NodeType, Position, InsertStep, RemoveStep, RemoveTextStep, Selection } from "noss-editor";
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
          .trace("DOMObserver.callback", "private")
          .try((tr) => (tr ? this.view.state.apply(tr) : Ok(null)))
          .warn((e) => console.warn(e))
          .map((e) => console.log(e));
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

  unChecked(callback: () => void) {
    this.stop();
    callback();
    this.start();
  }

  private callback(record: MutationRecord): Result<Transaction | null, string> {
    console.log(record);
    if (record.type === "characterData") {
      const t = record.target;
      if (t.nodeType === DOMNode.TEXT_NODE) {
        const node = this.view.toNode(t);
        const text = record.target as DOMText;
        if (node.err) return node.trace("DOMObserver.callback", "private");
        if (!node.val.type.schema.text)
          return Err(`Node type mismatch; DOM node is text node, but bound node type: ${node.val.type.name}, isn't`) //
            .trace("DOMObserver.callback", "private");

        return calculateText(this.view.state.tr, node.val as Text, text.data).trace("DOMObserver.callback", "private");
      }
    } else if (record.type === "childList") {
      const parent = this.view.toNode(record.target);
      if (parent.err) return parent.trace("DOMObserver.callback", "private");

      const tr = this.view.state.tr;
      for (const c of record.addedNodes) {
        if (c.nodeType === DOMNode.ELEMENT_NODE && (<HTMLElement>c).tagName === "BR") continue;
        const index = wrap(() => Array.from(record.target.childNodes).indexOf(c as ChildNode)).unwrap(-1);
        if (index === -1) return Err("Failed to get index of added node").trace("DOMObserver.callback", "private");

        if (c.nodeType === DOMNode.TEXT_NODE) {
          console.log(parent.val);
          if ((c as DOMText).data === "") continue;

          const text = createTextNode((c as DOMText).data);
          this.unChecked(() => c.parentNode?.removeChild(c));
          wrap(() => tr.insertChild(text, parent.val, index))
            .trace("DOMObserver.callback", "private")
            .warn((e) => console.warn(e));
        } else if (c.nodeType === DOMNode.ELEMENT_NODE) {
          const node = c as HTMLElement;

          const parsed = this.view.parse(node);
          if (parsed.err) return parsed.trace("DOMObserver.callback", "private");
          else if (parsed.val === null) continue;

          node.setAttribute("data-pre-node", parsed.val.id);
          // TODO: Allow to hint that new domnode should not be inserted if it's equal to a provided one
          tr.softStep(new InsertStep(Position.child(parent.val, index), parsed.val)) //
            .trace("DOMObserver.callback", "private")
            .warn((e) => console.warn(e));

          // Position.offset(parsed.val, 0)
          //   .resolve(tr.modified)
          //   .map((pos) => tr.setSelection(Selection.collapsed(pos)));
        }
      }

      for (const c of record.removedNodes) {
        if (c.nodeType === DOMNode.TEXT_NODE) {
          const text = <DOMText>c;
          if (text.data === "") continue;
          const node = this.view.toNode(c);
          if (node.err) return node.trace("DOMObserver.callback", "private");
          const res = tr.softStep(new RemoveStep(node.val));
          if (res.err) return res.trace("DOMObserver.callback", "private");
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
      .trace("calculateText")
      .replace(tr);

  const diff = diffText(node.text, expected);
  if (diff.type === "none") return Err("No changes detected in the text node");
  else if (diff.type === "replace")
    return tr
      .softStep(new RemoveTextStep(node, diff.start, diff.end))
      .try(() => tr.softStep(new InsertTextStep(node, diff.added, diff.start)))
      .trace("calculateText")
      .replace(tr);
  else if (diff.type === "insert")
    return tr //
      .softStep(new InsertTextStep(node, diff.change, diff.start))
      .trace("calculateText")
      .replace(tr);
  else
    return tr //
      .softStep(new RemoveTextStep(node, diff.start, diff.end))
      .trace("calculateText")
      .replace(tr);
}

/**
 * @throws {MethodError}
 */
function createTextNode(content: string): Text {
  // @ts-ignore : `node` will never be the direct Node instance, but a subclass of it.
  return new (NodeType.get("text").node)(content);
}
