import type { Node } from "../model/node";
import type { EventMap, Result } from "@noss-editor/utils";
import type { EditorView } from "../model/view";
import type { Diff } from "./diff";
import { MethodError, NotImplementedError, stack, EventFull, Ok, Err } from "@noss-editor/utils";
import { Transaction } from "./transaction";

interface EventData extends EventMap { }

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
    return new Transaction(this);
  }

  boundaryTr(boundary: Node) {
    return new Transaction(this, boundary);
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
      mergeDiffs(tr)
        .map((diffs) => {
          this.transactions.push(tr);
          this.mod.push(doc);

          this.view?.update(tr, diffs);
        })
        .mapErr((err) => {
          // emit error or warn event or smth
        });

      return doc;
    });
  }

  // view wrapper methods

  getSelection(boundary?: Node) {
    const res = this.view?.getSelection(boundary || this.document);
    return res ?? Err("No view is bound to the state");
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

function mergeDiffs(tr: Transaction): Result<Diff, string> {
  let diff = tr.diff[0];
  for (let i = 1; i < tr.diff.length; i++) {
    const res = diff.merge(tr.diff[i]);
    if (res.ok) diff = res.val;
    else return res;
  }
  return Ok(diff);
}
