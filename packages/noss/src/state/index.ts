import { NotImplementedError } from "../error";
import type { Node } from "../model/node";
import { Transaction } from "./transaction";

export class EditorState {
  readonly transactions: Transaction[] = [];

  constructor(readonly document: Node) {}

  /**
   * Create a new transaction in the editor
   */
  get tr() {
    return new Transaction(this, this.document);
  }

  // Keep track of all transactions in the state, a transaction should have the steps required to undo and (re)do a transaction,
  // all document changes should go via a transaction
  apply(tr: Transaction) {
    throw new NotImplementedError("EditorState.apply");
  }

  undo(tr: Transaction) {
    throw new NotImplementedError("EditorState.undo");
  }

  // Node actions
  // - add, remove
}
