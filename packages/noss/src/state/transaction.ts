import type { Result } from "@noss-editor/utils";
import type { EditorState } from ".";
import type { Text } from "../model/node";
import type { Step } from "./step";
import type { PositionLike } from "../model/position";
import type { Selection } from "../model/selection";
import { Ok, Err } from "@noss-editor/utils";
import { Node } from "../model/node";
import { NodeType } from "../model/nodeType";
import { AnchorPosition, Position } from "../model/position";
import { Diff } from "./diff";
import { ReplaceNodeStep } from "./steps/replace";
import { NodeRange, UnresolvedNodeRange } from "../model/range";

export class Transaction {
  readonly steps: Result<Step, string>[] = [];
  readonly diff: Result<Diff, string>[] = [];
  readonly original: Node;
  readonly history: boolean;

  public selection?: Selection;

  /**
   * The modified boundary with all the steps applied to it.
   */
  get modified(): Result<Node, string> {
    return this.diff[this.diff.length - 1].try((diff) => diff.modified);
  }

  get hasErrors(): boolean {
    return this.modified.ok;
  }

  /**
   * @param boundary The boundary node where this transaction originates, positions are resolved in this node.
   * @param addToHistory
   *    Whether to add this transaction to the history stack.
   *    When set to false, the transaction will not be added to the history stack
   *    and thus ignored by undo/redo actions, this is usefull for e.g. collaborative editing.
   */
  constructor(
    readonly state: EditorState,
    boundary?: Node,
    addToHistory = true,
  ) {
    boundary ||= state.document;
    this.original = boundary;
    this.diff = [Ok(Diff.none(boundary))];
    this.history = addToHistory;

    this.state.getSelection(boundary).map((val) => {
      // @ts-ignore : Typescript doesn't allow assigning in callback, but it's fine here.
      this.selection = val;
    });
  }

  private resolve(pos: PositionLike): Result<Position, string> {
    if (this.modified.err) return Err("Failed to resolve Position; transaction has errors", "Transaction.resolve");
    return Position.resolve(this.modified.val, pos).trace("Transaction.resolve");
  }

  /**
   * Tries to apply a step and add it to this transaction,
   * will ignore the step if applying failed.
   * @returns A Result containing either the new boundary or an error message.
   */
  step(step: Result<Step, string>): this {
    this.steps.push(step);
    if (step.err) {
      const diff = Err("Failed to apply step; step has errors", "Transaction.step");
      this.diff.push(diff);
      return this;
    }

    const diff = this.modified
      .replaceErr("Failed to add step to transaction")
      .try((mod) => step.val.apply(mod))
      .trace("Transaction.step");
    this.diff.push(diff);
    return this;
  }

  setSelection(selection?: Selection) {
    this.selection = selection;
  }

  /**
   * Adds an {@link InsertStep} to this transaction, which inserts a node into the current document.
   *
   * @param node The node to add
   * @param pos The position where to insert the node, see {@link Position}.
   */
  insert(node: Node, pos: PositionLike) {
    const range = new UnresolvedNodeRange(pos);
    return this.step(Ok(new ReplaceNodeStep(range, node)));
  }

  /**
   * Inserts a node as child of `parent` at the given index.
   *
   * @param node The node to add
   * @param parent The parent node where to insert the node
   * @param index The index in the node, undefined results in the last index, and negative values are relative to the last index.
   */
  insertChild(node: Node, parent: Node, index?: number) {
    const pos = AnchorPosition.child(parent, index);
    return this.insert(node, pos);
  }

  /**
   * Inserts text at the given position.
   * If the position points into a text node, the text node will be modified, otherwise a new text node will be inserted.
   *
   * @param text The text to insert at `pos`
   * @param pos The position where to insert the text
   */
  insertText(text: string, pos: PositionLike): this;
  /**
   * Inserts text at the given position.
   * If the position points into a text node, the text node will be modified, otherwise a new text node will be inserted.
   *
   * @param text The text to insert at `pos`
   * @param node The text node where to insert the text
   * @param offset The offset into the parent node where to insert the text
   */
  insertText(text: string, node: Text, offset: number): this;
  insertText(text: string, _pos: PositionLike | Node, _offset?: number): this {
    const fn = (pos: PositionLike) => {
      const position = this.resolve(pos);
      if (position.err) return this.step(position.traceMessage("Failed to create step", "Transaction.insertText"));

      // Position doesn't point into a text node
      if (position.val.offset() === 0) return this.insert(createTextNode(text), position.val);

      // Position points into a text node
      const textNode = position.val.parent as Text;
      if (!textNode.type.schema.text)
        return this.step(Err("Failed to create step; target node isn't a text node", "Transaction.insertText"));

      const node = textNode.insert(position.val.offset(), text);
      return this.replaceChild(textNode, node);
    };

    if (!(_pos instanceof Node)) return fn(_pos);
    // biome-ignore lint/style/noNonNullAssertion : _offset is defined when _pos is a Node
    return fn(AnchorPosition.offset(_pos, _offset!));
  }

  remove(range: NodeRange | UnresolvedNodeRange) {
    // TODO: First check if range resolves inside text node, then use removeText, otherwise continue
    return this.step(Ok(new ReplaceNodeStep(range, undefined)));
  }

  removeChild(parent: Node, index?: number) {
    const range = this.modified.try((boundary) => NodeRange.selectContent(boundary, parent, index, index));
    if (range.err)
      return this.step(Err("Failed to create step; failed to create NodeRange", "Transaction.removeChild"));

    return this.remove(range.val);
  }

  removeText(node: Text, start: number, end: number): this;
  removeText(node: Text, start: number, end: number) {
    if (start === 0 && end === node.contentSize) return this.remove(UnresolvedNodeRange.select(node));
    return this.replaceChild(node, node.remove(start, end));
  }
  //replace

  replaceRange(range: NodeRange, node: Node) {
    this.step(Ok(new ReplaceNodeStep(range, node)));
    return this;
  }

  replaceChild(old: Node, modified: Node) {
    const range = this.modified.try((boundary) => NodeRange.select(boundary, old));
    if (range.ok) return this.replaceRange(range.val, modified);
    else return this.step(Err("Failed to create step; failed to create NodeRange", "Transaction.replaceChild"));
  }
}

/**
 * @throws {MethodError}
 */
function createTextNode(content: string): Text {
  // @ts-ignore : `node` will never be the direct Node instance, but a subclass of it.
  return new (NodeType.get("text").node)(content);
}

/**
 * @throws {MethodError}
 */
function getNode(node: string | Node) {
  // @ts-ignore : `node` will never be the direct Node instance, but a subclass of it.
  if (typeof node === "string") return new (NodeType.get(node).node)();
  else return node;
}
