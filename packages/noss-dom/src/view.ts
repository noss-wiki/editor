import type { Result } from "@noss-editor/utils";
import type { Node, Text, Diff, TextView, Transaction, ParseResult, NodeConstructor } from "noss-editor";
import type { NodeRoot, DOMElement, DOMText } from "./types";
import type { DOMNodeView } from "./nodeView";
import { Err, MethodError, Ok } from "@noss-editor/utils";
import { NodeView, EditorView, ChangeType, Position, Selection, NodeType, Fragment } from "noss-editor";
import { getNodeById } from "noss-editor/internal";
import { DOMObserver } from "./observer";
import { DOMNode } from "./types";
import { renderBreak, renderNodeRecursive } from "./render";

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
      if (change.type === ChangeType.insert) {
        const child = change.modified;
        const domParent = this.toRendered(change.parent);
        if (domParent.err) continue;
        else if (domParent.val.nodeType === DOMNode.TEXT_NODE) continue; // parent can't be text node

        const parent = domParent.val as DOMElement;
        const domChild = renderNodeRecursive(child);
        if (domChild.err) continue;

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

        if (change.index >= change.parent.content.childCount) parent.append(domChild.val);
        else {
          const anchor = parent.childNodes[change.index];
          if (!anchor) continue; // err if anchor is not found
          parent.insertBefore(domChild.val, anchor);
        }
      } else {
        const domNode = this.toRendered(change.old);
        if (domNode.err) continue;
        if (change.type === ChangeType.remove) {
          const domParent = this.toRendered(change.parent);
          if (domParent.err) continue;
          const parentView = change.parent.getView() as DOMNodeView | undefined;

          domNode.val.remove();
          if (change.parent.content.empty && parentView?.emptyBreak === true) {
            if (domParent.val.childNodes.length === 0) domParent.val.appendChild(renderBreak());
            // TODO: Also add if hardbreak at the end
          }
        } else {
          if (change.old.type.schema.text) {
            const text = domNode.val as DOMText;
            text.data = (change.modified as Text).text;
            text._nodeId = change.modified.id;
            if (change.modified.view) (<TextView<DOMText>>change.modified.view).textRoot = text;
          } else {
            const newNode = renderNodeRecursive(change.modified);
            if (newNode.err) continue;
            domNode.val.replaceWith(newNode.val);
          }
        }
      }
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

  override toNode(element: DOMNode): Result<Node, string> {
    let id = element._nodeId;

    if (!id && element.nodeType === DOMNode.ELEMENT_NODE) {
      const _element = element as DOMElement;
      if (_element.hasAttribute("data-pre-node")) id = _element.getAttribute("data-pre-node") || undefined;
    }

    if (id) {
      const bound = getNodeById(this.state.document, id);
      return bound.replaceErr(`Failed to find node with id: ${id}`).trace("DOMView.toNode");
    } else if ((element as HTMLElement).tagName === "BODY")
      return Err("Failed to get bound node, searched up to the body tag").trace("DOMView.toNode");
    else if (!element.parentNode)
      return Err("Failed to get bound node, node doesn't have a parentNode").trace("DOMView.toNode");

    return this.toNode(element.parentNode);
  }

  override toRendered(node: Node): Result<NodeRoot, string> {
    if (node.type.schema.text) {
      const view = <TextView<DOMText> | undefined>node.view;
      if (view?.textRoot) return Ok(view.textRoot);
    } else {
      const view = <NodeView<HTMLElement> | undefined>node.view;
      if (view?.root) return Ok(view.root);
    }

    const domNode = findDOMNodeWithId(this.root, node.id);
    if (domNode) return Ok(domNode);
    else return Err("Failed to find dom node").trace("DOMView.toDom");
  }

  override parse(e: DOMNode, ignoreContent = false): Result<Node | null, string> {
    if (e.nodeType === DOMNode.TEXT_NODE) {
      const text = e as DOMText;
      return NodeType.softGet("text").map((type) => {
        // @ts-ignore : type is not the base class but one that extends it
        const construct = <typeof Text>type.node;
        return new construct(text.data);
      });
    } else if (e.nodeType === DOMNode.ELEMENT_NODE) {
      const node = e as DOMElement;
      if (node.tagName === "BR") return Ok(null);

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

    if (anchor.err || focus.err) return Err("Failed to resolve selection node positions").trace("DOMView.getSelection");
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

function findDOMNodeWithId(node: DOMNode, id: string): NodeRoot | undefined {
  if (node._nodeId === id) return node as NodeRoot;
  if (node.nodeType !== DOMNode.ELEMENT_NODE) return undefined;
  for (const child of node.childNodes) {
    const found = findDOMNodeWithId(child, id);
    if (found) return found;
  }
}
