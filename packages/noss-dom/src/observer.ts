import type { DOMView } from "./view";
import type { Node, NodeConstructor, Transaction, Text } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import type { DOMText } from "./types";
import { NodeType, Position, Selection, Fragment, UnresolvedRange, UnresolvedFlatRange } from "noss-editor";
import { all, Err, Ok, wrap } from "@noss-editor/utils";
import { DOMNode } from "./types";
import { diffText } from "./diff";

export class DOMObserver {
  readonly observer: MutationObserver;
  readonly view!: DOMView;
  readonly pending: MutationRecord[] = [];
  readonly useInputEvent = true;

  constructor() {
    this.observer = new MutationObserver((e) => this.pend(e));
  }

  bind(view: DOMView) {
    // @ts-ignore : Set here instead of constructor
    this.view = view;
  }

  private listener = (e: Event) =>
    this.beforeInput(e as InputEvent)
      .try((tr) => (tr ? this.view.state.apply(tr) : Ok(null)))
      .warn((e) => console.warn(e))
      .map((e) => e && console.log(e));

  start() {
    this.observer.observe(this.view.root, {
      characterData: true,
      characterDataOldValue: true,
      childList: true,
      subtree: true,
    });

    if (this.useInputEvent) this.view.root.addEventListener("beforeinput", this.listener);
  }

  stop() {
    this.observer.disconnect();
    if (this.useInputEvent) this.view.root.removeEventListener("beforeinput", this.listener);
  }

  flush() {
    while (this.pending.length > 0) {
      const record = this.pending.shift();
      if (!record) break;
      this.callback(record)
        .try((tr) => (tr ? this.view.state.apply(tr) : Ok(null)))
        .warn((e) => console.warn(e))
        .map((e) => e && console.log(e));
    }
    // TODO: Merge transactions or ensure that they count towards a single history entry
  }

  private unChecked(callback: () => void) {
    this.stop();
    callback();
    this.start();
  }

  private pend(records: MutationRecord[]) {
    let skipNext = false;
    for (let i = 0; i < records.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }

      const record = records[i];
      if (record.type === "childList") {
        const next = records[i + 1];
        if (next && next.type === "childList" && record.addedNodes.length === 1 && next.removedNodes.length === 1) {
          if (record.addedNodes[0] === next.removedNodes[0]) {
            skipNext = true;
            continue;
          }
        } else if (record.addedNodes.length === 1) {
          const node = record.addedNodes[0];
          if (node.nodeType === DOMNode.ELEMENT_NODE && (<HTMLElement>node).tagName === "BR") continue;
          else if (node.nodeType === DOMNode.TEXT_NODE && (<globalThis.Text>node).data === "") continue;
        }
      }

      this.pending.push(record);
    }

    this.flush();
  }

  private callback(record: MutationRecord): Result<Transaction | null, string> {
    console.log(record);
    if (record.type === "characterData") {
      const t = record.target;
      if (t.nodeType !== DOMNode.TEXT_NODE)
        return Err("Invalid target for characterData input type", "DOMObserver.callback", "private");

      const node = this.view.toNode(t);
      const text = record.target as DOMText;
      if (node.err) return node.trace("DOMObserver.callback", "private");
      if (!node.val.type.schema.text)
        return Err(
          `Node type mismatch; DOM node is text node, but bound node type: ${node.val.type.name}, isn't`,
          "DOMObserver.callback",
          "private",
        );

      const sel = this.view.state.getSelection();
      const tr = this.view.state.tr;
      if (sel.err) return sel.trace("DOMObserver.callback", "private");

      calculateText(tr, node.val as Text, text.data);
      return tr.setSelection(sel.val.ranges[0].absolute).seal(); // TODO: Add support for multiple ranges
    } else if (record.type === "childList") {
      const tr = this.view.state.tr;
      for (const c of record.addedNodes) {
        if (c.nodeType === DOMNode.ELEMENT_NODE && (<HTMLElement>c).tagName === "BR") continue;

        const index = getIndex(record, c).unwrap(-1);
        if (index === -1) return Err("Failed to get index of added node").trace("DOMObserver.callback", "private");

        const parent = this.view.toNode(record.target);
        if (parent.err) return parent.trace("DOMObserver.callback", "private");

        if (c.nodeType === DOMNode.TEXT_NODE) {
          const domText = c as DOMText;
          if (domText.data === "") continue;
          const text = createTextNode(domText.data);
          const sel = this.view.getSelection(tr.original);

          this.unChecked(() => {
            // Still set id on old node, so it can be resolved in other records that are part of the same mutation
            (<DOMNode>c)._node = text;
            c.parentNode?.removeChild(c);
          });

          tr.insertChild(text, parent.val, index);
          // Dom's selection already accounts for the added char, so just set this instead of mapping it.
          all(tr.modified, sel).map(([_, sel]) => tr.setSelection(sel));
        } else if (c.nodeType === DOMNode.ELEMENT_NODE) {
          const element = c as HTMLElement;

          const parsed = this.view.parse(element, true);
          if (parsed.err) return parsed.trace("DOMObserver.callback", "private");
          else if (parsed.val === null) continue;

          const node = parsed.val;
          element.setAttribute("data-pre-node", node.id);

          tr.insertChild(node, parent.val, index)
            .modified.try((boundary) => UnresolvedRange.fromStart(node, 0).resolve(boundary))
            .map((range) => tr.setSelection(new Selection(range)));
        }
      }

      for (const c of record.removedNodes) {
        if (c.nodeType === DOMNode.TEXT_NODE && (<DOMText>c).data === "") continue;
        else if (c.nodeType === DOMNode.ELEMENT_NODE && (<HTMLElement>c).tagName === "BR") continue;

        const parent = this.view.toNode(record.target);
        if (parent.err) return parent.trace("DOMObserver.callback", "private");

        const node = this.view.toNode(c);
        if (node.err) return node.trace("DOMObserver.callback", "private");
        else if (!parent.val.content.contains(node.val))
          return Err("Node not found in parent node", "DOMObserver.callback", "private");

        tr.remove(UnresolvedFlatRange.select(node.val));
      }

      if (tr.steps.length === 0) return Ok(null);
      else return tr.seal();
    }
    return Err("Unhandled case");
  }

  private beforeInput(e: InputEvent): Result<Transaction | null, string> {
    // TODO: Does every type need selection? else move this so it's only called when needed
    // TODO: Some behaviour should not happen on input, as keybindings can be different
    const sel = this.view.state.getSelection();
    if (sel.err) return sel.trace("DOMObserver.beforeInput", "private");
    else if (sel.val.empty) return Ok(null);

    if (e.inputType === "insertParagraph") {
      const range = sel.val.ranges[0];
      if (!range.isCollapsed) return Ok(null); // TODO: Also implement this case

      const anchor = range.anchor;
      if (!anchor.parent.type.schema.text)
        return Err("Selection parent node should be a text node", "DOMObserver.beforeInput", "private");

      const parent = anchor.node(-1);
      const offset = Position.indexToOffset(parent, anchor.index()).map((o) => o + anchor.offset());
      if (offset.err) return offset.trace("DOMObserver.beforeInput", "private");
      // TODO: Doesn't quite yet work with multiple nodes
      const curr = parent.cut(0, offset.val);
      const newlineNode = parent.cut(offset.val);

      return defaultNode(newlineNode.content)
        .replaceErr("Failed to get default Node")
        .try((node) =>
          this.view.state.tr
            .insertChild(node, anchor.node(-2), anchor.index(-2) + 1)
            .replaceChild(parent, curr)
            .setSelection(UnresolvedRange.fromStart(node, 0))
            .seal()
            .tap(() => e.preventDefault())
            .trace("DOMObserver.beforeInput", "private"),
        );
    } else console.log(e.inputType);
    return Ok(null);
  }
}

function defaultNode(content?: Fragment | Node | Node[]): Result<Node, null> {
  return NodeType.default.map(
    (nodeType) => new (nodeType.node as unknown as NodeConstructor)(Fragment.from(content ?? [])),
  );
}

/**
 * Calculates the transaction steps to apply to the text node to make it match the expected text.
 * This method only expects the changes to have happened on one position in the text node.
 * This method modifies the transaction and returns the result, but that parameter is still modified.
 */
function calculateText(tr: Transaction, node: Text, expected: string): Transaction | null {
  // TODO: What sel here?
  if (expected === "") return tr.remove(UnresolvedFlatRange.select(node));

  const diff = diffText(node.text, expected);
  if (diff.type === "none") return null;
  else if (diff.type === "replace")
    return tr
      .setSelection(UnresolvedRange.fromStart(node, diff.start + diff.added.length))
      .removeText(node, diff.start, diff.end)
      .insertText(diff.added, node, diff.start);
  else if (diff.type === "insert")
    return tr //
      .setSelection(UnresolvedRange.fromStart(node, diff.start + diff.change.length))
      .insertText(diff.change, node, diff.start);

  return tr //
    .setSelection(UnresolvedRange.fromStart(node, diff.start))
    .removeText(node, diff.start, diff.end);
}

/**
 * @throws {MethodError}
 */
function createTextNode(content: string): Text {
  // @ts-ignore : `node` will never be the direct Node instance, but a subclass of it.
  return new (NodeType.get("text").node)(content);
}

function getIndex(record: MutationRecord, node: globalThis.Node): Result<number, null> {
  const parent = record.target;
  const i = Array.from(parent.childNodes).indexOf(node as ChildNode);
  if (i !== -1) return Ok(i);

  if (record.type !== "childList") return Err();
  else if (record.addedNodes.length > 1) return Err();
  else if (record.removedNodes.length > 1) return Err();

  if (!record.previousSibling) return Ok(0);
  else if (!record.nextSibling) return Ok(parent.childNodes.length);
  if (record.previousSibling) {
    const index = Array.from(parent.childNodes).indexOf(record.previousSibling as ChildNode);
    if (index !== -1) return Ok(index + 1);
  }
  if (record.nextSibling) {
    const index = Array.from(parent.childNodes).indexOf(record.nextSibling as ChildNode);
    if (index !== -1) return Ok(index);
  }
  return Err();
}
