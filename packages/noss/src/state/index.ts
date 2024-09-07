import type { Node } from "../model/node";
import type { EventMap, Result } from "@noss-editor/utils";
import type { ChangedNode } from "./step";
import type { EditorView } from "../model/view";
import { MethodError, NotImplementedError, stack, EventFull, Ok, Err } from "@noss-editor/utils";
import { Transaction } from "./transaction";
import { ChangeType } from "./step";

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

  public view?: EditorView<unknown>;

  get document() {
    return this.mod[this.mod.length - 1];
  }

  /**
   * Creates a new transaction in the document.
   * The transaction will be created in the document boundary, and with history enabled.
   */
  get tr() {
    return new Transaction(this.document);
  }

  constructor(document: Node) {
    super("EditorState");
    this.original = document;
    this.mod = [this.original];
  }

  bind(view: EditorView<unknown>) {
    this.view ??= view;
  }

  apply(tr: Transaction): Result<Node, string> {
    // emit some event where the transction can be modified / cancelled?
    return constructDocument(this.document, tr).map((doc) => {
      this.transactions.push(tr);
      this.mod.push(doc);

      const changes = calculateUpdated(tr);
      this.view?.update(changes);
      // Calculate updated nodes (prob from steps)
      // emit `update` event with changed nodes
      // this.emit("update", { changedNodes: [] }) or maybe just view.update

      return doc;
    });
  }
}

export function constructDocument(document: Node, tr: Transaction): Result<Node, string> {
  // Fast comparison first, if false the entire document structure will be checked (slow).
  if (document === tr.original || document.eq(tr.original)) return Ok(tr.modified);

  if (!document.content.contains(tr.original))
    return Err("The boundary of the provided transaction, is not part of this document");

  const content = stack("EditorState.constructDocument")(
    document.content.replaceChildRecursive(tr.original, tr.modified),
  );
  return Ok(document.copy(content));
}

function calculateUpdated(tr: Transaction) {
  const changes: ChangedNode[] = [];

  for (const step of tr.steps) {
    if (step.hints) {
      for (const hint of step.hints) changes.push(hint);
      //continue;
    }
    // analyze documents for changes
  }

  return changes;
}
