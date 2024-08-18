import type { Node } from "../../model/node";
import type { PositionLike } from "../../model/position";
import type { Slice } from "../../model/slice";
import type { Position } from "../../model/position";
import { Step } from "../step";
import type { Result } from "@noss-editor/utils";
import { Err } from "@noss-editor/utils";

export class ReplaceStep extends Step {
  id = "replace";

  private $from?: Position;
  private $to?: Position;

  constructor(
    /**
     * The start position in the document where to start replacing.
     */
    readonly from: PositionLike,
    /**
     * The end position in the document where to stop replacing.
     */
    readonly to: PositionLike,
    /**
     * The content to replace the selection with.
     */
    readonly slice: Slice,
  ) {
    super();
  }

  apply(boundary: Node): Result<never, string> {
    return Err("Not implemented");
    /* this.$from ??= Position.softResolve(boundary, this.from);
    this.$to ??= Position.softResolve(boundary, this.to);
    if (!this.$from || !this.$to) return false;
    else if (
      this.$from.depth - this.$to.depth !== this.slice.openStart - this.slice.openEnd ||
      this.$from.depth - this.slice.openStart < 0
    )
      return false;

    const parent = this.$from.node(this.$from.depth - this.slice.openStart);
    // TODO: Verify if content is allowed before replacing

    return false; */
  }
}
