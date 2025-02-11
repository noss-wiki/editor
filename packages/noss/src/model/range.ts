import { MethodError, Ok, wrap, type Result } from "@noss-editor/utils";
import type { Node, Text } from "./node";
import type { Resolvable, Serializable, Serialized } from "../types";
import { AnchorPosition, Position } from "./position";
import { Slice } from "./slice";

export class UnresolvedRange {
  readonly focus: Resolvable<Position>;

  constructor(
    readonly anchor: Resolvable<Position>,
    focus?: Resolvable<Position>,
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

  static fromStart(node: Node, offset?: number) {
    return new UnresolvedRange(AnchorPosition.offset(node, offset ?? 0));
  }

  static fromEnd(node: Node, offset?: number) {
    return new UnresolvedRange(AnchorPosition.offset(node, node.nodeSize - (offset ?? 0)));
  }
}

interface SerializedRange {
  readonly type: "range" | "node" | "single" | "absolute";
  readonly anchor: Serialized<Position>;
  readonly focus: Serialized<Position>;
}

export class Range implements Serializable<SerializedRange> {
  /** @internal */
  declare readonly __resolvable?: UnresolvedRange | Resolvable<Position>;

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
  readonly direction: "forward" | "backward";
  readonly absolute: AbsoluteRange;

  readonly commonDepth: number;
  readonly commonParent: Node;

  constructor(
    readonly anchor: Position,
    focus?: Position,
  ) {
    this.focus = focus || this.anchor;

    this.isCollapsed = !focus || this.anchor === this.focus || this.anchor.absolute === this.focus.absolute;
    this.size = this.isCollapsed ? 0 : Math.abs(this.focus.absolute - this.anchor.absolute);
    this.absolute = new AbsoluteRange(this.anchor.absolute, this.focus.absolute);

    this.commonDepth = Position.commonDepth(this.anchor, this.focus);
    this.commonParent = this.anchor.node(this.commonDepth);

    if (this.anchor.absolute < this.focus.absolute) {
      this.direction = "forward";
      this.first = this.anchor;
      this.last = this.focus;
    } else {
      this.direction = "backward";
      this.first = this.focus;
      this.last = this.anchor;
    }
  }

  content(): Slice {
    if (this.isCollapsed) return Slice.empty;

    const start = this.first.offset() - this.first.start(this.commonDepth);
    const content = this.commonParent.content.cut(start, start + this.size);
    return new Slice(content, this.first.depth - this.commonDepth, this.last.depth - this.commonDepth);
  }

  resolve(): Result<this, never> {
    return Ok(this);
  }

  asFlatRange(): Result<FlatRange, string> {
    return wrap(() => new FlatRange(this.anchor, this.focus)).trace("Range.toNodeRange");
  }

  asNodeRange(): Result<NodeRange, string> {
    return wrap(() => new NodeRange(this.anchor, this.focus)).trace("Range.toSingleNodeRange");
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

  // Resolver<Range>
  static resolve(boundary: Node, range: Resolvable<Range>): Result<Range, string> {
    if (range instanceof Range) return Ok(range);
    else if (Position.resolvable(range)) return Position.resolve(boundary, range).map((pos) => new Range(pos));

    return range.resolve(boundary).trace("Range.resolve", "static");
  }

  static resolvable(range: unknown): range is Resolvable<Range> {
    return range instanceof Range || range instanceof UnresolvedRange || Position.resolvable(range);
  }
}

export class AbsoluteRange extends UnresolvedRange implements Serializable<SerializedRange> {
  declare anchor: number;
  declare focus: number;
  readonly first: number;
  readonly last: number;

  readonly isCollapsed: boolean;
  readonly size: number;
  readonly absolute = this;

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
// TODO: Just use `UnresolvedRange`?
export class UnresolvedFlatRange extends UnresolvedRange {
  override resolve(boundary: Node): Result<FlatRange, string> {
    return this.resolvePositions(boundary).map(({ anchor, focus }) => new FlatRange(anchor, focus));
  }

  static select(node: Node) {
    return new UnresolvedFlatRange(AnchorPosition.before(node), AnchorPosition.after(node));
  }

  static between(node: Node, start: number, end: number) {
    return new UnresolvedFlatRange(AnchorPosition.offset(node, start), AnchorPosition.offset(node, end));
  }
}

interface SerializedFlatRange extends SerializedRange {
  readonly type: "node" | "single";
}

// TODO: Rename to `FlatRange`?
// - than rename `SingleNodeRange` to `NodeRange`
/**
 * A {@link Range} that only contains whole nodes, this means that the parents of the positions are the same.
 * The content in this range, is one or more nodes.
 */
export class FlatRange extends Range implements Serializable<SerializedFlatRange> {
  /** @internal */
  declare readonly __resolvable?: UnresolvedFlatRange;

  /**
   * The common parent node between the anchor and focus positions.
   */
  readonly parent: Node;
  /**
   * The text content of this range, if the parent node is a text node.
   */
  readonly text: string | null = null;
  readonly childCount: number;

  constructor(anchor: Position, focus?: Position) {
    super(anchor, focus);

    if (this.anchor.parent !== this.focus.parent)
      throw new MethodError(
        "FlatRange can only be created with positions that have the same parent",
        "FlatRange.constructor",
      );

    this.parent = this.anchor.parent;
    this.childCount = this.last.index() - this.first.index();

    if (this.parent.type.schema.text)
      this.text = (this.parent as Text).text.slice(this.first.offset(), this.last.offset());
  }

  nodesBetween() {
    return this.parent.content.nodes.slice(this.first.index(), this.last.index());
  }

  override asFlatRange(): Result<this, never> {
    return Ok(this);
  }

  override toJSON(): SerializedFlatRange {
    return {
      type: "node",
      anchor: this.anchor.absolute,
      focus: this.focus.absolute,
    };
  }

  static override resolve(boundary: Node, range: Resolvable<FlatRange>): Result<FlatRange, string> {
    if (range instanceof FlatRange) return Ok(range);
    return range.resolve(boundary).trace("FlatRange.resolve", "static");
  }

  static select(boundary: Node, node: Node): Result<NodeRange, string> {
    return AnchorPosition.before(node)
      .resolve(boundary)
      .try((anchor) =>
        AnchorPosition.after(node)
          .resolve(boundary)
          .map((focus) => new NodeRange(anchor, focus)),
      )
      .traceMessage("Failed to create FlatRange", "FlatRange.select", "static");
  }

  /**
   * Creates a new NodeRange, selecting the content between the given indices in the parent node.
   */
  static selectContent(boundary: Node, parent: Node, startIndex = 0, endIndex?: number): Result<FlatRange, string> {
    endIndex ??= parent.content.childCount - 1;

    return AnchorPosition.child(parent, startIndex)
      .resolve(boundary)
      .try((anchor) => {
        if (startIndex === endIndex) return Ok(new FlatRange(anchor));

        return AnchorPosition.child(parent, endIndex)
          .resolve(boundary)
          .map((focus) => new FlatRange(anchor, focus));
      })
      .traceMessage("Failed to create FlatRange", "FlatRange.selectContent", "static");
  }
}

interface SerializedNodeRange extends SerializedRange {
  readonly type: "single";
}

/**
 * A {@link FlatRange} that contains a max of one node, so the content in this range, is either none, or a single node.
 */
export class NodeRange extends FlatRange implements Serializable<SerializedNodeRange> {
  readonly node?: Node;

  /**
   * @internal
   */
  constructor(anchor: Position, focus?: Position) {
    super(anchor, focus);

    if (this.childCount > 1)
      throw new MethodError(
        "NodeRange can only 'select' none, or a single node, but this range contains multiple nodes",
        "NodeRange.constructor",
      );

    if (!this.isCollapsed) this.node = this.parent.content.softChild(this.first.index());
  }

  override asNodeRange(): Result<NodeRange, never> {
    return Ok(this);
  }

  override toJSON(): SerializedNodeRange {
    return {
      type: "single",
      anchor: this.anchor.absolute,
      focus: this.focus.absolute,
    };
  }
}
