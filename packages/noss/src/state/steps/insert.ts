import type { Node, Text } from "../../model/node";
import type { PositionLike } from "../../model/position";
import { Position } from "../../model/position";
import { Step } from "../step";
import { Result } from "../../result";

export class InsertStep extends Step {
  id = "insert";

  constructor(
    public pos: PositionLike, //
    readonly node: Node,
  ) {
    super();
  }

  apply(boundary: Node): Result<null | Node> {
    const pos = Position.softResolve(boundary, this.pos);
    if (pos === undefined) return Result.Error("Failed to resolve position");
    this.pos = pos;

    const { index, offset } = Position.offsetToIndex(pos.parent, pos.offset, true);
    if (offset !== 0)
      if (!this.node.type.schema.text && !pos.parent.type.schema.text)
        return Result.Error("Position doesn't resolve to an index, and nodes aren't text nodes");
      else {
        const res = pos.parent.insert(offset, (<Text>this.node).text);
        const c = boundary.content.replaceChildRecursive(pos.parent, res);
        return Result.Ok(boundary.copy(c));
      }

    const res = pos.parent.copy(pos.parent.content.insert(this.node, index));
    const c = boundary.content.replaceChildRecursive(pos.parent, res);
    return Result.Ok(boundary.copy(c));
  }
}
