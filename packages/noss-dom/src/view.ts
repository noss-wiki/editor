import type { Result } from "@noss-editor/utils";
import type { Node, Text, Diff, TextView, Transaction, ParseResult, NodeConstructor } from "noss-editor";
import type { NodeRoot, DOMElement, DOMText } from "./types";
import type { DOMNodeView } from "./nodeView";
import { Err, MethodError, Ok } from "@noss-editor/utils";
import { NodeView, EditorView, ChangeType, Position, Selection, NodeType, Fragment } from "noss-editor";
import { DOMObserver } from "./observer";
import { DOMNode } from "./types";
import {
  renderBreak,
  renderNodeRecursive,
  trailingBreakAttr,
  insertAtIndex,
  getDOMFromNode,
  getNodeFromDOM,
  updateRefUpwards,
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
    for (let i = 0; i < diff.changes.length; i++) {
      const change = diff.changes[i];
      // TODO: Get old and modified boundaries before and after th change, diff update is required
      //let oldBoundary = diff.modified

      const fn = () => {
        if (change.type === ChangeType.insert) {
          const child = change.modified;
          const domParent = this.toRendered(change.oldParent);
          if (domParent.err) return domParent;
          else if (domParent.val.nodeType !== DOMNode.ELEMENT_NODE) return Err("The parent domNode must be an element");

          const parent = domParent.val as DOMElement;
          const domChild = renderNodeRecursive(child);
          if (domChild.err) return domChild.replaceErr("Failed to render inserted node");

          const existing = parent.childNodes[change.index];
          if (existing && existing.nodeType === DOMNode.ELEMENT_NODE) {
            const node = existing as DOMElement;
            if (node.hasAttribute("data-pre-node") && node.getAttribute("data-pre-node") === child.id) {
              node.replaceWith(domChild.val);
            }
          }

          // Remove br element if in text holding node
          if (domChild.val.nodeType === DOMNode.TEXT_NODE) {
            const first = parent.childNodes[0];
            if (first && first.nodeType === DOMNode.ELEMENT_NODE && (<DOMElement>first).tagName === "BR")
              parent.removeChild(first);
          }

          if (change.index >= change.oldParent.content.childCount) parent.append(domChild.val);
          else {
            const anchor = parent.childNodes[change.index];
            if (!anchor) return Err("Failed to get an anchor domnode to insert node");

            parent.insertBefore(domChild.val, anchor);
          }

          const res = updateRefUpwards(change, domParent.val, tr.original, tr.modified, this.root);
          if (res.err) return res;
        } else {
          const domNode = this.toRendered(change.old);
          if (domNode.err) return domNode;

          if (change.type === ChangeType.remove) {
            const domParent = this.toRendered(change.oldParent) as Result<DOMElement, string>;
            if (domParent.err) return domParent;

            const parentView = change.oldParent.getView() as DOMNodeView | undefined;
            const index = change.oldParent.content.nodes.indexOf(change.old);
            if (index === -1) return Err("Failed to get the index of the removed node");

            domNode.val.remove();
            if (parentView?.emptyBreak === true) {
              if (change.modifiedParent.content.empty) domParent.val.innerHTML = renderBreak().outerHTML;
              else {
                // Node is the first node, or previous node isn't a text-like node
                // and node is the last node, or next node isn't a text-like node,
                // then insert temporary break.
                if (
                  (index === 0 || !(change.oldParent.content.softChild(index - 1)?.type.schema.text ?? false)) &&
                  (index === change.oldParent.content.childCount - 1 ||
                    !(change.oldParent.content.softChild(index + 1)?.type.schema.text ?? false))
                )
                  // TODO: If the removed node is a text node, it's prob already removed and maybe br is inserted.
                  insertAtIndex(domParent.val, renderBreak(), index);
              }
            }

            const res = updateRefUpwards(change, domParent.val, tr.original, tr.modified, this.root);
            if (res.err) return res;
          } else {
            if (change.old.type.schema.text) {
              const text = domNode.val as DOMText;
              text.data = (change.modified as Text).text;
              text._nodeId = change.modified.id;
              text._node = change.modified;

              if (change.modified.view) (<TextView<DOMText>>change.modified.view).textRoot = text;
              const res = updateRefUpwards(change, domNode.val, tr.original, tr.modified, this.root);
              if (res.err) return res;
            } else {
              const newNode = renderNodeRecursive(change.modified);
              if (newNode.err) return newNode.replaceErr("Failed to render inserted node");

              domNode.val.replaceWith(newNode.val);
              const res = updateRefUpwards(change, newNode.val, tr.original, tr.modified, this.root);
              if (res.err) return res;
            }
          }
        }
        return Ok(null);
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
      .try((node) => Position.offset(node, sel.anchorOffset).resolve(boundary));
    const focus = this.toNode(sel.focusNode) //
      .try((node) => Position.offset(node, sel.focusOffset).resolve(boundary));

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
    selection?.setBaseAndExtent(anchor.val, sel.anchor.offset, focus.val, sel.focus.offset);
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
