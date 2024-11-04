import { MethodError, Ok, type Result } from "@noss-editor/utils";
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
    this.focus = focus || this.anchor;
  }

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

export interface SerializedRange {
  readonly type: "range" | "node";
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

  toJSON(): SerializedRange {
    return {
      type: "range",
      anchor: this.anchor.absolute,
      focus: this.focus.absolute,
    };
  }
}

export interface SerializedNodeRange extends SerializedRange {
  readonly type: "node";
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

  override toJSON(): SerializedNodeRange {
    return {
      type: "node",
      anchor: this.anchor.absolute,
      focus: this.focus.absolute,
    };
  }

  static select(boundary: Node, node: Node): Result<NodeRange, string> {
    return AnchorPosition.before(node)
      .resolve(boundary)
      .try((anchor) =>
        AnchorPosition.after(node)
          .resolve(boundary)
          .map((focus) => new NodeRange(anchor, focus)),
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

// TODO: Maybe create a `NodeSelect` class that only holds a single node.
