import type { Result, MethodError } from "@noss-editor/utils";
import type { EditorState } from ".";
import type { Node, Text } from "../model/node";
import type { Step } from "./step";
import type { AbsoluteLike, PositionLike } from "../model/position";
import { stack } from "@noss-editor/utils";
import { NodeType } from "../model/nodeType";
import { Position } from "../model/position";
import { Diff } from "./diff";
// Steps
import { InsertStep, InsertTextStep } from "./steps/insert";
import { RemoveStep, RemoveTextStep } from "./steps/remove";

export class Transaction {
  readonly steps: Step[] = [];
  readonly diff: Diff[] = [];
  readonly original: Node;
  readonly history: boolean;

  /**
   * The modified boundary with all the steps applied to it.
   */
  get modified() {
    // modified is checked before adding to diff.
    return this.diff[this.diff.length - 1].modified.val as Node;
  }

  /**
   * @param boundary The boundary node where this transaction originates, positions are resolved in this node.
   * @param addToHistory
   *    Whether to add this transaction to the history stack.
   *    When set to false, the transaction will not be added to the history stack
   *    and thus ignored by undo/redo actions, this is usefull for e.g. collaborative editing.
   */
  constructor(boundary: Node, addToHistory = true) {
    this.original = boundary;
    this.diff = [Diff.none(boundary)];
    this.history = addToHistory;
  }

  /**
   * Applies and adds a step to this transaction,
   * will throw if anything failed.
   * @throws {MethodError} If the step failed to apply
   */
  step(step: Step) {
    const res = this.softStep(step);
    if (res.err) throw res.val;
    return res.val;
  }

  /**
   * Tries to apply a step and add it to this transaction,
   * will ignore the step if applying failed.
   * @returns A Result containing either the new boundary or an error message.
   */
  softStep(step: Step) {
    return step.apply(this.modified).map<Diff, string>((val) => {
      val.modified.map((node) => {
        this.diff.push(val);
        this.steps.push(step);
      });
      return val;
    });
  }

  /**
   * Adds an {@link InsertStep} to this transaction, which inserts a node into the current document.
   *
   * @param node The node to add, or the node type (node will be created automatically).
   * @param pos The position where to insert the node, see {@link Position}.
   * @throws {MethodError} When the node is provided as string, and that nodeType doesn't exist.
   * @throws {MethodError} If the step failed to apply
   */
  insert(node: string | Node, pos: PositionLike) {
    const insertNode = stack("Transaction.insert")(getNode(node));
    stack("Transaction.insert")(this.step(new InsertStep(pos, insertNode)));
    return this;
  }

  // TODO: Allow `PositionLike`?
  insertText(node: Text, text: string, pos: AbsoluteLike) {
    return stack("Transaction.insertText", () => {
      const resolvedPos = Position.resolve(this.modified, pos);
      const index = Position.offsetToIndex(resolvedPos.parent, resolvedPos.offset);

      if (index !== undefined) this.insert(createTextNode(text), pos);
      else this.step(new InsertTextStep(resolvedPos.parent as Text, text, resolvedPos.offset));

      return this;
    });
  }

  /**
   * Adds an {@link RemoveStep} to this transaction, which removes a node from the document.
   * @param node The node to remove, this node needs to be in the current document.
   * @throws {MethodError} If the step failed to apply
   */
  remove(node: Node) {
    stack("Transaction.remove")(this.step(new RemoveStep(node)));
    return this;
  }

  removeText(node: Text, from: number, to?: number) {
    if (from < 0) from = node.text.length + from;
    // Useless step
    if (from === to || from > node.text.length || (to && to < 0)) return this;

    return stack("Transaction.removeText", () => {
      if (from === 0 && (!to || to > node.text.length)) this.remove(node);
      else this.step(new RemoveTextStep(node, from, to));

      return this;
    });
  }
}

/**
 * @throws {MethodError}
 */
function createTextNode(content: string) {
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
