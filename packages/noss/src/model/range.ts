import { Ok, type Result } from "@noss-editor/utils";
import type { Node } from "./node";
import type { PositionLike } from "./position";
import { Position } from "./position";

export class UnresolvedRange {
  constructor(
    readonly anchor: PositionLike,
    readonly focus: PositionLike,
  ) {}

  resolve(boundary: Node): Result<Range, string> {
    return Position.softResolve(boundary, this.anchor)
      .mapErr((e) => `Failed to resolve start position of range; ${e}`)
      .try((anchor) =>
        Position.softResolve(boundary, this.focus)
          .mapErr((e) => `Failed to resolve end position of range; ${e}`)
          .map((focus) => new Range(anchor, focus)),
      )
      .trace("UnresolvedRange.resolve");
  }
}

export class Range extends UnresolvedRange {
  declare anchor: Position;
  declare focus: Position;

  readonly isCollapsed: boolean;

  constructor(anchor: Position, focus: Position) {
    super(anchor, focus);
    this.isCollapsed = anchor === focus || anchor.toAbsolute() === focus.toAbsolute();
  }

  override resolve(): Result<Range, string> {
    return Ok(this);
  }
}

/**
 * A {@link Range} that only contains whole nodes, this means that the parents of the positions are the same.
 * The content in this range, is one or more nodes.
 */
export class NodeRange extends Range {
  readonly parent: Node;

  constructor(anchor: Position, focus: Position) {
    super(anchor, focus);

    this.parent = anchor.parent;
  }

  nodesBetween() {
    const start = this.anchor.index();
    const end = this.focus.index();
    return this.parent.content.nodes.slice(start, end);
  }
}
