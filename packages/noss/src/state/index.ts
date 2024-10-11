import type { Result } from "@noss-editor/utils";
import type { Node } from "../model/node";
import type { EditorView } from "../model/view";
import type { Selection } from "../model/selection";
import type { Diff } from "./diff";
import { stack, Ok, Err } from "@noss-editor/utils";
import { Transaction } from "./transaction";
import { KeybindManager } from "./input";

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

  readonly keybinds: KeybindManager;

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

  constructor(document: Node) {
    this.original = document;
    this.mod = [this.original];

    this.keybinds = new KeybindManager(this);
  }

  bind(view: EditorView<unknown>) {
    this.view ??= view;
  }

  apply(tr: Transaction): Result<Node, string> {
    // emit some event where the transction can be modified / cancelled?
    return constructDocument(this.document, tr)
      .try((doc) => {
        return mergeDiffs(tr)
          .map((diffs) => {
            this.transactions.push(tr);
            this.mod.push(doc);

            this.view?.update(tr, diffs);
          })
          .replace(doc);
      })
      .trace("EditorState.apply");
  }

  /**
   * Gets the selection from the lined view.
   */
  getSelection(boundary?: Node): Result<Selection, string> {
    const res = this.view?.getSelection(boundary || this.document);
    if (res) return res.trace("EditorState.getSelection");
    return Err("No view is bound to the state", "EditorState.getSelection");
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
