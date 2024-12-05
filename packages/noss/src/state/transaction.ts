import type { Result } from "@noss-editor/utils";
import type { EditorState } from ".";
import type { Text } from "../model/node";
import type { Step } from "./step";
import type { Resolvable } from "../types";
import { Selection } from "../model/selection";
import { Ok, Err, all } from "@noss-editor/utils";
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
  /**
   * When a `Transaction` is sealed, no more steps can be added to it.
   * A transaction needs to be sealed before being applied to the state.
   */
  public sealed = false;

  /**
   * The modified boundary with all the steps applied to it.
   */
  get modified(): Result<Node, string> {
    return this.diff[this.diff.length - 1].try((diff) => diff.modified);
  }

  private mappedSelection: Result<Selection, string>[] = [];

  /**
   * The selection that was mapped through all the steps that are part of this Transaction.
   */
  get selection(): Result<Selection, string> {
    return this.mappedSelection[this.mappedSelection.length - 1];
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

    const val = this.state.getSelection(boundary);
    if (val.ok) this.mappedSelection[0] = val;
    else this.mappedSelection[0] = Ok(Selection.empty);
  }

  private resolve(pos: Resolvable<Position>): Result<Position, string> {
    if (this.modified.err) return Err("Failed to resolve Position; transaction has errors", "Transaction.resolve");
    return Position.resolve(this.modified.val, pos).trace("Transaction.resolve");
  }

  /**
   * Tries to apply a step and add it to this transaction,
   * will ignore the step if applying failed.
   * @returns A Result containing either the new boundary or an error message.
   */
  step(step: Result<Step, string>): this {
    if (this.sealed) return this; // throw?

    this.steps.push(step);
    if (step.err) {
      const diff = step.traceMessage("Failed to apply step; step has errors", "Transaction.step");
      this.diff.push(diff);
      this.mappedSelection.push(diff);
      return this;
    }

    const _diff = this.modified
      .replaceErr("Failed to add step to transaction")
      .try((mod) => step.val.apply(mod))
      .trace("Transaction.step");
    this.diff.push(_diff);

    const res = all(_diff, this.selection)
      .replaceErr("Failed to map selection")
      .try(([diff, sel]) => {
        if (sel.empty) return Ok(Selection.empty);

        return diff.mapRange(sel.ranges[0]).map((r) => new Selection(r));
      })
      .trace("Transaction.step");
    this.mappedSelection.push(res);

    return this;
  }

  setSelection(selection: Resolvable<Selection>) {
    if (this.sealed) return this; // throw?

    const sel = this.modified.try((mod) => Selection.resolve(mod, selection));
    this.mappedSelection[this.mappedSelection.length - 1] = sel;
    return this;
  }

  /**
   * Inserts a node at the given position.
   *
   * @param node The node to add
   * @param pos The position where to insert the node, see {@link Position}.
   */
  insert(node: Node, pos: Resolvable<Position>) {
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
  insertText(text: string, pos: Resolvable<Position>): this;
  /**
   * Inserts text at the given position.
   * If the position points into a text node, the text node will be modified, otherwise a new text node will be inserted.
   *
   * @param text The text to insert at `pos`
   * @param node The text node where to insert the text
   * @param offset The offset into the parent node where to insert the text
   */
  insertText(text: string, node: Text, offset: number): this;
  insertText(text: string, _pos: Resolvable<Position> | Node, _offset?: number): this {
    const insert = createTextNode(text);
    if (_pos instanceof Node) return this.insert(insert, AnchorPosition.offset(_pos, _offset as number));

    return this.insert(insert, _pos);
  }

  // TODO: Add support for general `Range`
  remove(range: Resolvable<NodeRange>) {
    // TODO: First check if range resolves inside text node, then use removeText, otherwise continue
    return this.step(Ok(new ReplaceNodeStep(range, undefined)));
  }

  removeChild(parent: Node, index?: number) {
    const range = this.modified.try((boundary) => NodeRange.selectContent(boundary, parent, index, index));
    if (range.err)
      return this.step(
        range.traceMessage("Failed to create step; failed to create NodeRange", "Transaction.removeChild"),
      );

    return this.remove(range.val);
  }

  removeText(node: Text, start: number, end: number): this;
  removeText(node: Text, start: number, end: number) {
    if (start === 0 && end === node.contentSize) return this.remove(UnresolvedNodeRange.select(node));
    return this.remove(UnresolvedNodeRange.between(node, start, end));
  }
  //replace

  replaceRange(range: NodeRange, node: Node) {
    return this.step(Ok(new ReplaceNodeStep(range, node)));
  }

  replaceChild(old: Node, modified: Node) {
    const range = this.modified.try((boundary) => NodeRange.select(boundary, old));
    if (range.ok) return this.replaceRange(range.val, modified);
    else
      return this.step(
        range.traceMessage("Failed to create step; failed to create NodeRange", "Transaction.replaceChild"),
      );
  }

  // Sealing

  toResult(): Result<this, string> {
    return this.modified.replace(this);
  }

  seal(): Result<this, string> {
    return this.toResult()
      .tap(() => (this.sealed = true))
      .traceMessage("Failed to seal transaction; transaction has errors", "Transaction.seal");
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
