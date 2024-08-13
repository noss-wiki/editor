import type { Node } from "../model/node";
import { NotImplementedError } from "@noss-editor/utils";
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

  apply(tr: Transaction) {
    throw new NotImplementedError("EditorState.apply");
  }

  undo(tr: Transaction) {
    throw new NotImplementedError("EditorState.undo");
  }
}
