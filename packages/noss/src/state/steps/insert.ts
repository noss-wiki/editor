import type { Node, Text } from "../../model/node";
import type { AbsoluteLike, PositionLike } from "../../model/position";
import type { Result } from "@noss-editor/utils";
import { Err, Ok, wrap } from "@noss-editor/utils";
import { Position } from "../../model/position";
import { Step } from "../step";

export class InsertStep extends Step {
  readonly id = "insert";

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
  readonly id = "insertText";

  readonly offset: number;

  constructor(
    readonly node: Text,
    readonly content: string,
    offset?: number,
  ) {
    super();
    this.offset = offset || node.text.length;
  }

  apply(boundary: Node): Result<Node, string> {
    const res = this.node.insert(this.offset, this.content);
    const c = boundary.content.replaceChildRecursive(this.node, res);
    return Ok(boundary.copy(c));
  }

  /**
   * Tries to merge two `InsertTextStep` steps.
   * If this position resolves to the same postion as the other step,
   * the content of the this step takes priority, and the content of the other step will be concatenated to the end.
   */
  override merge(other: Step): Result<Step, string> {
    if (!(other instanceof InsertTextStep)) return Err("Other step is not a RemoveTextStep");
    else if (this.node !== other.node) return Err("Both steps must target the same text node");

    if (this.offset + this.content.length < other.offset || other.offset + other.content.length < this.offset)
      return Err("Steps don't overlap, apply steps seperately");

    if (this.offset === other.offset)
      return Ok(new InsertTextStep(this.node, this.content + other.content, this.offset));
    else if (this.offset > other.offset) {
      const content =
        other.content.slice(0, this.offset - other.offset) +
        this.content +
        other.content.slice(this.offset - other.offset);
      return Ok(new InsertTextStep(this.node, content, other.offset));
    } else {
      const content =
        this.content.slice(0, other.offset - this.offset) +
        other.content +
        this.content.slice(other.offset - this.offset);
      return Ok(new InsertTextStep(this.node, content, this.offset));
    }
  }
}
