import type { EditorState } from '.';
import type { Node } from '../model/node';
import type { Step } from './step';
import type { PositionLike } from '../model/position';
import { NodeType } from '../model/nodeType';
import { Position } from '../model/position';
// Steps
import { InsertStep } from './steps/insert';
import { RemoveStep } from './steps/remove';
import { MethodError } from '../error';

export class Transaction {
  readonly steps: Step[] = [];

  constructor(readonly state: EditorState, readonly boundary: Node) {}

  /**
   * Adds an {@link InsertStep} to this transaction, which inserts a node into the current document.
   * @param node The node to add, or the node type (node will be created automatically).
   * @param pos The position where to insert the node, see {@link Position}.
   */
  insert<T extends string>(node: T | Node, pos: PositionLike) {
    if (typeof node === 'string') {
      const type = NodeType.get(node);
      if (type === undefined)
        throw new MethodError(
          `Cannot get the node type ${node}`,
          'Transaction.insert'
        );

      node = new type.node();
    }

    this.steps.push(new InsertStep(pos, node));
    return this;
  }

  insertText(text: string, pos: PositionLike) {
    const resolvedPos = Position.resolve(this.boundary, pos);
    if (!resolvedPos)
      throw new MethodError(
        'Position is not resolvable in the current boundary',
        'Transaction.insertText'
      );

    const index = Position.offsetToIndex(
      resolvedPos.parent,
      resolvedPos.offset
    );

    if (index !== undefined) {
      // New node needs to be created
      const node = createTextNode(text);
      this.steps.push(new InsertStep(resolvedPos, node));
    } else {
      // content needs to be inserted in existing node
      // -> use replace step with collapsed selection
    }

    return this;
  }

  /**
   * Adds an {@link RemoveStep} to this transaction, which removes a node from the document.
   * @param node The node to remove, this node needs to be in the current document.
   */
  remove(node: Node) {
    this.steps.push(new RemoveStep(node));
    return this;
  }

  /* replace(selection: Selection, content: Node | Node[]): this;
  replace(from: Position, to: Position, content: Node | Node[]): this;
  replace(
    from: Selection | Position,
    to: Position | Node | Node[],
    content?: Node | Node[]
  ) {
    let selection: Selection;
    if (content) {
      selection = Selection.from(from as Position, to as Position);
      content = content as Node | Node[];
    } else {
      selection = from as Selection;
      content = to as Node | Node[];
    }

    if (!Array.isArray(content)) content = [content];
    // create step
    return this;
  } */

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

function createTextNode(content: string) {
  const type = NodeType.get('text');
  if (type === undefined)
    throw new MethodError(
      `Cannot get the node type text, is it defined?`,
      'Transaction.insertText'
    );

  return new type.node(content);
}
