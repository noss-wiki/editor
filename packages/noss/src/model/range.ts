import { MethodError, Ok, type Result } from "@noss-editor/utils";
import type { Node } from "./node";
import type { PositionLike } from "./position";
import { Position } from "./position";

export class UnresolvedRange {
  constructor(
    readonly anchor: PositionLike,
    readonly focus: PositionLike,
  ) {}

  resolve(boundary: Node): Result<Range, string> {
    return Position.resolve(boundary, this.anchor)
      .mapErr((e) => `Failed to resolve start position of range; ${e}`)
      .try((anchor) =>
        Position.resolve(boundary, this.focus)
          .mapErr((e) => `Failed to resolve end position of range; ${e}`)
          .map((focus) => new Range(anchor, focus)),
      )
      .trace("UnresolvedRange.resolve");
  }
}

export class Range extends UnresolvedRange {
  declare anchor: Position;
  declare focus: Position;

  /**
   * The `anchor` or `focus` position, depending on which comes first.
   */
  readonly first: Position;

  readonly isCollapsed: boolean;
  readonly size: number;

  constructor(anchor: Position, focus?: Position) {
    super(anchor, focus || anchor);
    this.isCollapsed = !focus || this.anchor === this.focus || this.anchor.absolute === this.focus.absolute;
    this.size = this.isCollapsed ? 0 : Math.abs(this.focus.absolute - this.anchor.absolute);

    if (this.anchor.absolute < this.focus.absolute) this.first = this.anchor;
    else this.first = this.focus;
  }

  override resolve(): Result<Range, never> {
    return Ok(this);
  }
}

/**
 * A {@link Range} that only contains whole nodes, this means that the parents of the positions are the same.
 * The content in this range, is one or more nodes.
 */
export class NodeRange extends Range {
  readonly parent: Node;

  constructor(anchor: Position, focus?: Position) {
    super(anchor, focus);

    if (this.anchor.parent !== this.focus.parent)
      throw new MethodError(
        "NodeRange can only be created with positions that have the same parent",
        "NodeRange.constructor",
      );

    this.parent = this.anchor.parent;
  }

  nodesBetween() {
    const start = this.anchor.index();
    const end = this.focus.index();
    return this.parent.content.nodes.slice(start, end);
  }
}
