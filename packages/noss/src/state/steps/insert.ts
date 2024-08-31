import type { Node, Text } from "../../model/node";
import type { PositionLike } from "../../model/position";
import type { Result } from "@noss-editor/utils";
import { Err, Ok, wrap } from "@noss-editor/utils";
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
    return Position.softResolve(boundary, this.pos) //
      .try((pos) => {
        this.pos = pos;

        const { index, offset } = Position.offsetToIndex(pos.parent, pos.offset, true);
        if (offset !== 0)
          if (!this.node.type.schema.text && !pos.parent.type.schema.text)
            return Err("Position doesn't resolve to an index");
          else return Err("Position resolves inside a text node, use InsertTextStep if this was intentional");

        const res = pos.parent.copy(pos.parent.content.insert(this.node, index));
        return wrap(() => boundary.content.replaceChildRecursive(pos.parent, res)) //
          .map((c) => boundary.copy(c));
      });
  }
}

export class InsertTextStep extends Step {
  id = "insertText";

  constructor(
    public pos: PositionLike, //
    readonly content: string,
  ) {
    super();
  }

  apply(boundary: Node): Result<Node, string> {
    return Position.softResolve(boundary, this.pos) //
      .try((pos) => {
        this.pos = pos;

        const parent = pos.parent as Text;
        if (!parent.type.schema.text)
          return Err("Position doesn't resolves inside a text node, use InsertStep when inserting non-text content");

        const res = parent.insert(pos.offset, this.content);
        const c = boundary.content.replaceChildRecursive(parent, res);
        return Ok(boundary.copy(c));
      });
  }
}
