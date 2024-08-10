import type { Node, Text } from "../../model/node";
import type { PositionLike } from "../../model/position";
import { Position } from "../../model/position";
import { Step } from "../step";

export class InsertStep extends Step {
  id = "insert";

  constructor(
    public pos: PositionLike, //
    readonly node: Node,
  ) {
    super();
  }

  apply(boundary: Node): boolean {
    const pos = Position.resolve(boundary, this.pos);
    if (pos === undefined) return false;
    this.pos = pos;

    const { index, offset } = Position.offsetToIndex(pos.parent, pos.offset, true);
    if (offset !== 0)
      if (!this.node.type.schema.text && !pos.parent.type.schema.text) return false;
      else {
        const res = pos.parent.insert(offset, (<Text>this.node).text);
        // TODO: save result
        return true;
      }

    const res = pos.parent.content.insert(this.node, index);
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
