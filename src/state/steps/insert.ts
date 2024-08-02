import type { Node } from '../../model/node';
import type { PositionLike } from '../../model/position';
import { Position } from '../../model/position';
import { Step, type StepJSON } from '../step';

export class InsertStep extends Step {
  id = 'insert';

  constructor(
    public pos: PositionLike, //
    readonly node: Node
  ) {
    super();
  }

  apply(boundary: Node): boolean {
    const pos = Position.resolve(boundary, this.pos);
    if (pos === undefined) return false;
    this.pos = pos;

    const index = Position.offsetToIndex(pos.parent, pos.offset);
    if (index === undefined) return false; // insert needs to not cut into nodes, TODO: allow this or create seperate step?

    //return pos.parent.content.insert(this.node, index);
    return false;
  }

  undo(boundary: Node): boolean {
    const pos = Position.resolve(boundary, this.pos);
    if (pos === undefined) return false;
    this.pos = pos;

    const index = Position.offsetToIndex(pos.parent, pos.offset);
    if (index === undefined) return false;
    else if (pos.parent.content.nodes[index] !== this.node) return false;

    //return pos.parent.content.remove(this.node);
    return false;
  }
}
