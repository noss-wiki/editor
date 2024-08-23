import type { Node } from "../model/node";
import type { EventMap } from "@noss-editor/utils";
import { MethodError, NotImplementedError, stack, EventFull } from "@noss-editor/utils";
import { Transaction } from "./transaction";

interface EventData extends EventMap {}

export class EditorState extends EventFull<EventData> {
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
    super("EditorState");
    this.original = document;
    this.mod = [this.original];
  }

  apply(tr: Transaction) {
    // emit some event where the transction can be modified / cancelled?

    const doc = stack("EditorState.apply")(this.constructDocument(tr));
    this.transactions.push(tr);
    this.mod.push(doc);

    // Calculate updated nodes (prob from steps)
    // emit `update` event with changed nodes
    // this.emit("update", { changedNodes: [] }) or maybe just view.update

    return doc;
  }

  private constructDocument(tr: Transaction) {
    // Fast comparison first, if false the entire document structure will be checked (slow).
    if (this.document === tr.original || this.document.eq(tr.original)) return tr.modified;

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
