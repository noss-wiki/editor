import { MethodError, Ok, wrap, type Result } from "@noss-editor/utils";
import type { Node } from "./node";
import type { PositionLike } from "./position";
import type { Serializable } from "../types";
import { AnchorPosition, Position } from "./position";

export class UnresolvedRange {
  readonly focus: PositionLike;

  constructor(
    readonly anchor: PositionLike,
    focus?: PositionLike,
  ) {
    this.focus = focus ?? this.anchor;
  }

  protected resolvePositions(boundary: Node): Result<
    {
      anchor: Position;
      focus: Position;
    },
    string
  > {
    return Position.resolve(boundary, this.anchor)
      .mapErr((e) => `Failed to resolve start position of range; ${e}`)
      .try((anchor) =>
        Position.resolve(boundary, this.focus)
          .mapErr((e) => `Failed to resolve end position of range; ${e}`)
          .map((focus) => ({ anchor, focus })),
      )
      .trace("UnresolvedRange.resolvePositions", "private");
  }

  resolve(boundary: Node): Result<Range, string> {
    return this.resolvePositions(boundary).map(({ anchor, focus }) => new Range(anchor, focus));
  }
}

export interface SerializedRange {
  readonly type: "range" | "node" | "single" | "absolute";
  readonly anchor: number;
  readonly focus: number;
}

export class Range implements Serializable<SerializedRange> {
  readonly focus: Position;

  /**
   * The `anchor` or `focus` position, depending on which comes first.
   */
  readonly first: Position;
  /**
   * The `anchor` or `focus` position, depending on which comes last.
   */
  readonly last: Position;

  readonly isCollapsed: boolean;
  readonly size: number;

  constructor(
    readonly anchor: Position,
    focus?: Position,
  ) {
    this.focus = focus || this.anchor;

    this.isCollapsed = !focus || this.anchor === this.focus || this.anchor.absolute === this.focus.absolute;
    this.size = this.isCollapsed ? 0 : Math.abs(this.focus.absolute - this.anchor.absolute);

    if (this.anchor.absolute < this.focus.absolute) {
      this.first = this.anchor;
      this.last = this.focus;
    } else {
      this.first = this.focus;
      this.last = this.anchor;
    }
  }

  resolve(): Result<this, never> {
    return Ok(this);
  }

  toNodeRange(): Result<NodeRange, string> {
    return wrap(() => new NodeRange(this.anchor, this.focus)).trace("Range.toNodeRange");
  }

  toSingleNodeRange(): Result<SingleNodeRange, string> {
    return wrap(() => new SingleNodeRange(this.anchor, this.focus)).trace("Range.toSingleNodeRange");
  }

  toJSON(): SerializedRange {
    return {
      type: "range",
      anchor: this.anchor.absolute,
      focus: this.focus.absolute,
    };
  }

  copy(anchor: Position, focus?: Position) {
    return new (this.constructor as typeof Range)(anchor, focus) as this;
  }

  static resolve(boundary: Node, range: Range | UnresolvedRange): Result<Range, string> {
    if (range instanceof Range) return Ok(range);
    return range.resolve(boundary).trace("Range.resolve", "static");
  }
}

export class AbsoluteRange extends UnresolvedRange implements Serializable<SerializedRange> {
  declare anchor: number;
  declare focus: number;
  readonly first: number;
  readonly last: number;

  readonly isCollapsed: boolean;
  readonly size: number;

  constructor(anchor: number, focus?: number) {
    super(anchor, focus);
    this.first = Math.min(this.anchor, this.focus);
    this.last = Math.max(this.anchor, this.focus);

    this.isCollapsed = this.anchor === this.focus;
    this.size = this.last - this.first;
  }

  toJSON(): SerializedRange {
    return {
      type: "absolute",
      anchor: this.anchor,
      focus: this.focus,
    };
  }
}

export interface SerializedNodeRange extends SerializedRange {
  readonly type: "node" | "single";
}

export class UnresolvedNodeRange extends UnresolvedRange {
  override resolve(boundary: Node): Result<NodeRange, string> {
    return this.resolvePositions(boundary).map(({ anchor, focus }) => new NodeRange(anchor, focus));
  }

  static select(node: Node) {
    return new UnresolvedNodeRange(AnchorPosition.before(node), AnchorPosition.after(node));
  }
}

/**
 * A {@link Range} that only contains whole nodes, this means that the parents of the positions are the same.
 * The content in this range, is one or more nodes.
 */
export class NodeRange extends Range implements Serializable<SerializedNodeRange> {
  readonly parent: Node;
  readonly childCount: number;

  constructor(anchor: Position, focus?: Position) {
    super(anchor, focus);

    if (this.anchor.parent !== this.focus.parent)
      throw new MethodError(
        "NodeRange can only be created with positions that have the same parent",
        "NodeRange.constructor",
      );

    this.parent = this.anchor.parent;
    this.childCount = this.first.index() - this.last.index() + 1;
  }

  nodesBetween() {
    return this.parent.content.nodes.slice(this.first.index(), this.last.index());
  }

  override toNodeRange(): Result<this, never> {
    return Ok(this);
  }

  override toJSON(): SerializedNodeRange {
    return {
      type: "node",
      anchor: this.anchor.absolute,
      focus: this.focus.absolute,
    };
  }

  static override resolve(boundary: Node, range: NodeRange | UnresolvedNodeRange): Result<NodeRange, string> {
    if (range instanceof NodeRange) return Ok(range);
    return range.resolve(boundary).trace("NodeRange.resolve", "static");
  }

  static select(boundary: Node, node: Node): Result<SingleNodeRange, string> {
    return AnchorPosition.before(node)
      .resolve(boundary)
      .try((anchor) =>
        AnchorPosition.after(node)
          .resolve(boundary)
          .map((focus) => new SingleNodeRange(anchor, focus)),
      )
      .traceMessage("Failed to create NodeRange", "NodeRange.select", "static");
  }

  /**
   * Creates a new NodeRange, selecting the content between the given indices in the parent node.
   */
  static selectContent(boundary: Node, parent: Node, startIndex = 0, endIndex?: number): Result<NodeRange, string> {
    endIndex ??= parent.content.childCount - 1;

    return AnchorPosition.child(parent, startIndex)
      .resolve(boundary)
      .try((anchor) => {
        if (startIndex === endIndex) return Ok(new NodeRange(anchor));

        return AnchorPosition.child(parent, endIndex)
          .resolve(boundary)
          .map((focus) => new NodeRange(anchor, focus));
      })
      .traceMessage("Failed to create NodeRange", "NodeRange.selectContent", "static");
  }
}

export interface SerializedSingleNodeRange extends SerializedRange {
  readonly type: "single";
}

/**
 * A {@link NodeRange} that contains a max of one node, so the content in this range, is either none, or a single node.
 */
export class SingleNodeRange extends NodeRange implements Serializable<SerializedSingleNodeRange> {
  readonly node?: Node;

  /**
   * @internal
   */
  constructor(anchor: Position, focus?: Position) {
    super(anchor, focus);

    if (this.childCount > 1)
      throw new MethodError(
        "SingleNodeRange can only 'select' none, or a single node, but this range contains multiple nodes",
        "SingleNodeRange.constructor",
      );

    if (!this.isCollapsed) this.node = this.parent.content.softChild(this.first.index());
  }

  override toSingleNodeRange(): Result<SingleNodeRange, never> {
    return Ok(this);
  }

  override toJSON(): SerializedSingleNodeRange {
    return {
      type: "single",
      anchor: this.anchor.absolute,
      focus: this.focus.absolute,
    };
  }
}
