import type { EditorState } from ".";
import type { Node } from "../model/node";
import type { Step } from "./step";
import type { PositionLike } from "../model/position";
import { NodeType } from "../model/nodeType";
import { Position } from "../model/position";
// Steps
import { InsertStep } from "./steps/insert";
import { RemoveStep } from "./steps/remove";
import { MethodError, NotImplementedError, stack } from "../error";
import { Result } from "../result";

export class Transaction {
  readonly steps: Step[] = [];
  readonly mod: Node[];

  /**
   * The modified boundary with all the steps applied to it.
   */
  get boundary() {
    return this.mod[this.mod.length - 1];
  }

  constructor(
    readonly state: EditorState,
    boundary: Node,
  ) {
    this.mod = [boundary];
  }

  /**
   * Applies and adds a step to this transaction,
   * will throw if anything failed.
   * @throws {MethodError} If the step failed to apply
   */
  step(step: Step) {
    const res = this.softStep(step);
    const val = res.unwrapToError("Transaction.step");
    if (val instanceof MethodError) throw val;
    return Result.Ok(val);
  }

  /**
   * Tries to apply a step and add it to this transaction,
   * will ignore the step if applying failed.
   */
  softStep(step: Step) {
    const res = step.apply(this.boundary);
    const val = res.unwrap();
    if (val !== null) {
      this.mod.push(val);
      this.steps.push(step);
    }
    return res;
  }

  /**
   * Adds an {@link InsertStep} to this transaction, which inserts a node into the current document.
   *
   * @param node The node to add, or the node type (node will be created automatically).
   * @param pos The position where to insert the node, see {@link Position}.
   * @throws {MethodError} When the node is provided as string, and that nodeType doesn't exist.
   */
  insert(node: string | Node, pos: PositionLike) {
    const insertNode = stack("Transaction.insert")(getNode(node));
    stack("Transaction.insert")(this.step(new InsertStep(pos, insertNode)));
    return this;
  }

  insertText(text: string, pos: PositionLike) {
    const resolvedPos = stack("Transaction.insertText")(Position.resolve(this.boundary, pos));
    const index = Position.offsetToIndex(resolvedPos.parent, resolvedPos.offset);

    if (index !== undefined) {
      // New node needs to be created
      const node = stack("Transaction.insertText")(createTextNode(text));
      stack("Transaction.inserText")(this.step(new InsertStep(resolvedPos, node)));
    } else {
      // content needs to be inserted in existing node
      // -> use replace step with collapsed selection
      throw new NotImplementedError("Transaction.inserText", true);
    }

    return this;
  }

  /**
   * Adds an {@link RemoveStep} to this transaction, which removes a node from the document.
   * @param node The node to remove, this node needs to be in the current document.
   */
  remove(node: Node) {
    stack("Transaction.remove")(this.step(new RemoveStep(node)));
    return this;
  }

  /**
   * Calls the `apply` function on the linked editor state, which adds this transaction to the editor state.
   * After calling this or the function on the editor state, changes to this transaction are not allowed.
   */
  apply() {
    return this.state.apply(this);
  }

  undo() {
    return this.state.undo(this);
  }
}

/**
 * @throws {MethodError}
 */
function createTextNode(content: string) {
  return new (NodeType.get("text").node)(content);
}

/**
 * @throws {MethodError}
 */
function getNode(node: string | Node) {
  if (typeof node === "string") return new (NodeType.get(node).node)();
  else return node;
}
