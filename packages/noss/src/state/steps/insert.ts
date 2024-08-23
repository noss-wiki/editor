import type { Node, Text } from "../../model/node";
import type { PositionLike } from "../../model/position";
import type { Result } from "@noss-editor/utils";
import { Err, Ok } from "@noss-editor/utils";
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

  apply(boundary: Node): Result<Node, string> {
    return Position.softResolve(boundary, this.pos).try((pos) => {
      this.pos = pos;

      const { index, offset } = Position.offsetToIndex(pos.parent, pos.offset, true);
      if (offset !== 0)
        if (!this.node.type.schema.text && !pos.parent.type.schema.text)
          return Err("Position doesn't resolve to an index and provided node and/or position node aren't text nodes");
        else {
          const res = pos.parent.insert(offset, (<Text>this.node).text);
          const c = boundary.content.replaceChildRecursive(pos.parent, res);
          return Ok(boundary.copy(c));
        }

      const res = pos.parent.copy(pos.parent.content.insert(this.node, index));
      const c = boundary.content.replaceChildRecursive(pos.parent, res);
      return Ok(boundary.copy(c));
    });
  }
}
