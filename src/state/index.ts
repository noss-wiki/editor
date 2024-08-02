import { LoggerClass } from '@/composables/classes/logger';
import type { Node } from '../model/node';
import { Transaction } from './transaction';
import type { Step } from './step';

export class EditorState extends LoggerClass {
  readonly transactions: Transaction[] = [];

  constructor(readonly document: Node) {
    super();
  }

  /**
   * Create a new transaction in the editor
   */
  get tr() {
    return new Transaction(this, this.document);
  }

  // Keep track of all transactions in the state, a transation should have the steps required to undo and (re)do a transaction,
  // all document changes should go via a transaction
  apply(tr: Transaction) {
    const applied: Step[] = [];
    let failed = false;

    for (const s of tr.steps)
      if (s.apply(tr.boundary)) applied.push(s);
      else {
        failed = true;
        break;
      }

    if (!failed) {
      this.transactions.push(tr);
      return true;
    }

    // try to undo previous steps in this transaction
    let undoFailed = false;
    for (const s of applied) if (!s.undo(tr.boundary)) undoFailed = true;

    if (undoFailed) {
    } // TODO: trow special error
    return false;
  }

  undo(tr: Transaction) {
    const index = this.transactions.indexOf(tr);
    if (index === -1 || index !== this.transactions.length - 1) return false;

    const applied: Step[] = [];
    let failed = false;

    for (const s of invert(tr.steps))
      if (s.undo(tr.boundary)) applied.push(s);
      else {
        failed = true;
        break;
      }

    if (!failed) {
      this.transactions.splice(index, 1);
      return true;
    }

    // try to undo previous steps in this transaction
    let undoFailed = false;
    for (const s of applied) if (!s.apply(tr.boundary)) undoFailed = true;

    if (undoFailed) {
    } // TODO: trow special error
    return false;
  }

  // Node actions
  // - add, remove
}

function* invert<T extends any>(arr: T[]): Generator<T, void, unknown> {
  for (let i = 0; i < arr.length; i++) yield arr[arr.length - 1 - i];
}
