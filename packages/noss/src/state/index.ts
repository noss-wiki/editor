import type { Node } from "../model/node";
import { MethodError, NotImplementedError, stack } from "@noss-editor/utils";
import { Transaction } from "./transaction";

export class EditorState {
  /**
   * The initial document node that this editor was instantiated with.
   */
  readonly original: Node;
  /**
   * The changed documents after each transaction.
   * This array's length is always one more than the amount of transactions, as the first element is the original document.
   */
  readonly mod: Node[];
  /**
   * The transactions that have been applied to this editor.
   */
  readonly transactions: Transaction[] = [];
  /**
   * Whether the editor is editable or not.
   * @default true
   */
  readonly editable = true;

  get document() {
    return this.mod[this.mod.length - 1];
  }

  /**
   * Creates a new transaction in the document.
   * The transaction will be created in the document boundary, and with history enabled.
   */
  get tr() {
    return new Transaction(this, this.document);
  }

  constructor(document: Node) {
    this.original = document;
    this.mod = [this.original];
  }

  apply(tr: Transaction) {
    const doc = stack("EditorState.apply")(this.constructDocument(tr));
    this.transactions.push(tr);
    this.mod.push(doc);

    // Calculate updated nodes
    // emit `update` event with changed nodes

    return doc;
  }

  private constructDocument(tr: Transaction) {
    if (this.document === tr.original) return tr.modified;

    if (!this.document.content.contains(tr.original))
      throw new MethodError(
        "The boundary of the provided transaction, is not part of this document",
        "EditorState.constructDocument",
      );

    const content = stack("EditorState.constructDocument")(
      this.document.content.replaceChildRecursive(tr.original, tr.modified),
    );
    return this.document.copy(content);
  }
}
