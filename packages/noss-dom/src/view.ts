import type { Result } from "@noss-editor/utils";
import type {
  Node,
  Text,
  Diff,
  TextView,
  Transaction,
  ParseResult,
  NodeConstructor,
  SingleNodeRange,
} from "noss-editor";
import type { NodeRoot, DOMElement, DOMText } from "./types";
import type { DOMNodeView } from "./nodeView";
import { Err, MethodError, Ok } from "@noss-editor/utils";
import { NodeView, EditorView, ChangeType, Position, Selection, NodeType, Fragment, AnchorPosition } from "noss-editor";
import { DOMObserver } from "./observer";
import { DOMNode } from "./types";
import {
  renderBreak,
  renderNodeRecursive,
  trailingBreakAttr,
  insertAtIndex,
  getDOMFromNode,
  getNodeFromDOM,
} from "./render";

// TODO: Allow to derive state from the content of the root node
export class DOMView extends EditorView<HTMLElement, NodeRoot> {
  /**
   * The provided element, either via the constructor or via the `mount` method,
   * or a created element that can be appended to the document.
   */
  root: HTMLElement = document.createElement("div");
  observer: DOMObserver = new DOMObserver();

  override update(tr: Transaction, diff: Diff) {
    this.observer.stop();
    for (const change of diff.changes) {
      const fn = (): Result<unknown, string> => {
        if (!change.rangeIsCollapsed) {
          const range = change.range as SingleNodeRange;
          const node = range.node as Node; // Range is not collapsed, so node is defined
          const rendered = this.toRendered(node);
          if (rendered.err) return rendered;

          if (change.modified) {
            return renderNodeRecursive(change.modified)
              .replaceErr("Failed to render node")
              .map((mod) => rendered.val.replaceWith(mod));
          } else {
            rendered.val.remove();
            return Ok(null);
          }
        } else if (!change.modified) return Ok(null);

        const anchor = change.range.first; /* instanceof SingleNodeRange ? change.range.first : change.range; */
        const parent = anchor.node(-1);
        const index = anchor.index(-1);
        return renderNodeRecursive(change.modified)
          .replaceErr("Failed to render node")
          .try((rendered) => this.toRendered(parent).try((domParent) => insertAtIndex(domParent, rendered, index)));
      };

      fn()
        .traceMessage("Failed to update rendered view", "DOMView.update")
        .warn((msg) => console.warn(msg));
    }

    if (tr.selection) this.setSelection(tr.selection);
    this.observer.start();
  }

  override render() {
    this.observer.bind(this);
    this.observer.stop();
    const document = this.state.document;
    const ele = renderNodeRecursive(document);
    if (ele.err)
      throw new MethodError(
        "The document node doesn't have a view attached, so it can't be rendered",
        "DOMView.render",
      );

    this.root.innerHTML = "";
    this.root.appendChild(ele.val);
    this.root.contentEditable = "true";

    this.observer.start();

    this.root.addEventListener("keydown", (e) => this.onKeyDown(e as KeyboardEvent));

    return ele.val as HTMLElement;
  }

  override destroy(): void {
    this.observer.stop();
    this.root.remove();
  }

  override toNode(element: DOMNode, boundary?: Node): Result<Node, string> {
    return getNodeFromDOM(element, boundary || this.state.document).trace("DOMView.toNode");
  }

  override toRendered(node: Node, boundary?: Node): Result<NodeRoot, string> {
    return getDOMFromNode(node, boundary || this.state.document, this.root).trace("DOMView.toRendered");
  }

  override parse(e: DOMNode, ignoreContent = false, defaultFallback = true): Result<Node | null, string> {
    if (e.nodeType === DOMNode.TEXT_NODE) {
      const text = e as DOMText;
      return NodeType.softGet("text").map((type) => {
        // @ts-ignore : type is not the base class but one that extends it
        const construct = <typeof Text>type.node;
        return new construct(text.data);
      });
    } else if (e.nodeType === DOMNode.ELEMENT_NODE) {
      const node = e as DOMElement;
      if (node.tagName === "BR" && node.hasAttribute(trailingBreakAttr)) return Ok(null);

      for (const name in NodeView.all) {
        const view = NodeView.all[name];
        const nodeType = NodeType.softGet(name);
        if (!view || nodeType.err) continue;

        const construct = nodeType.val.node as unknown as NodeConstructor;
        const res = view.parse(node);
        if (res.err) continue;

        if (ignoreContent) return Ok(new construct(Fragment.empty));

        let outlet: HTMLElement;
        // biome-ignore lint/style/noNonNullAssertion : res.outlet is non-null as checked
        if ((<ParseResult<HTMLElement>>res.val).outlet) outlet = (<ParseResult<HTMLElement>>res.val).outlet!;
        else outlet = node;

        const nodes: Node[] = [];
        for (const child of outlet.childNodes) {
          const res = this.parse(child);
          if (res.err) return res.trace("DOMView.parse");
          else if (res.val !== null) nodes.push(res.val);
        }

        return Ok(new construct(Fragment.from(nodes)));
      }

      if (!defaultFallback) return Ok(null);
      const defaultType = NodeType.default;
      if (defaultType.ok) {
        const construct = defaultType.val.node as unknown as NodeConstructor;
        return Ok(new construct(Fragment.empty));
      }
    }
    return Err("Unknown element nodeType").trace("DOMView.parse");
  }

  override getSelection(boundary: Node): Result<Selection, string> {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !sel.focusNode) return Err("No selection found").trace("DOMView.getSelection");

    const anchor = this.toNode(sel.anchorNode) //
      .try((node) => AnchorPosition.offset(node, sel.anchorOffset).resolve(boundary));
    const focus = this.toNode(sel.focusNode) //
      .try((node) => AnchorPosition.offset(node, sel.focusOffset).resolve(boundary));

    if (anchor.err)
      return anchor.traceMessage("Failed to resolve anchor head of selection positions", "DOMView.getSelection");
    else if (focus.err)
      return focus.traceMessage("Failed to resolve focus head of selection positions", "DOMView.getSelection");

    return Ok(new Selection(anchor.val, focus.val));
  }

  setSelection(sel: Selection) {
    const anchor = this.toRendered(sel.anchor.parent);
    const focus = this.toRendered(sel.focus.parent);

    if (anchor.err || focus.err) return;
    const selection = window.getSelection();
    selection?.setBaseAndExtent(anchor.val, sel.anchor.offset(), focus.val, sel.focus.offset());
  }

  // event handlers

  // handle key bindinds
  public bindingTimeout = 400;
  private pendingKeys: string[] = [];
  private timeOut: number | undefined;

  // TODO: Limit number of sequences
  private onKeyDown(e: KeyboardEvent) {
    // TODO: don't allow single presses, but allow sequences
    if (/(shift|control|alt|meta)/i.test(e.key)) return;

    // ignore letters and numbers without modifiers
    const modifier = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
    if (!modifier && /[a-z0-9]/i.test(e.key)) return;

    // create keybinding string
    let str = "";
    if (e.ctrlKey) str += "ctrl-";
    if (e.metaKey) str += "meta-";
    if (e.altKey) str += "alt-";
    if (e.shiftKey) str += "shift-";
    str += e.key.toLowerCase();

    this.pendingKeys.push(str);
    const binding = this.pendingKeys.join(" ");
    // Checks if the keybinding (or a part of it) exists.
    if (!this.state.keybinds.worthWaiting(binding)) {
      this.pendingKeys.length = 0;
      return;
    }

    e.preventDefault(); // TODO: Maybe check if keybinding is (or a keybinding includes) this sequence, and if not just return early
    if (this.timeOut) window.clearTimeout(this.timeOut);

    if (this.state.keybinds.exists(binding)) {
      this.pendingKeys.length = 0;
      this.state.keybinds.call(binding);
      return;
    }

    this.timeOut = window.setTimeout(() => {
      this.pendingKeys.length = 0;
      this.state.keybinds.call(binding);
      this.timeOut = undefined;
    }, this.bindingTimeout);
  }
}
