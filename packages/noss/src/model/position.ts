import type { Resolvable, Resolver, Serializable } from "../types";
import type { Result } from "@noss-editor/utils";
import type { Fragment } from "./fragment";
import { Ok, Err, MethodError } from "@noss-editor/utils";
import { Node, Text } from "./node";

export type AbsoluteLike = Position | number;

// TODO: Add some unit tests
export class Position implements Serializable<number> {
  /** @internal */
  declare readonly __resolvable?: number | AnchorPosition;

  readonly boundary: Node;
  readonly parent: Node;
  readonly absolute: number;
  readonly depth: number;

  constructor(
    private steps: LocateStep[],
    absolute?: number,
  ) {
    this.boundary = this.steps[0].parent;
    this.depth = this.steps.length - 1;
    this.parent = this.steps[this.depth].parent;
    this.absolute = absolute ?? this.getAbsolute();
  }

  private getAbsolute(): number {
    let abs = this.steps[0].offset; // document doesn't have opening tag
    for (const { offset, parent } of this.steps.slice(1))
      if (parent.type.schema.text) abs += offset;
      else abs += offset + 1;

    return abs;
  }

  /**
   * Returns the parent node at `depth`, this method follows the following constraints:
   *```ts
    pos.node(pos.depth) === pos.parent && pos.node(0) === pos.boundary;
    ```
   * @param depth The depth of the node, undefined results in the max depth, and negative values are relative to the max depth.
   * @throws {RangeError} If the depth is invalid.
   */
  node(depth?: number) {
    return this.steps[resolveDepth(depth, this.steps.length - 1)].parent;
  }

  /**
   * Returns the index of the position at `depth`, into that depth's parent node.
   * @param depth The depth of the node, undefined results in the max depth, and negative values are relative to the max depth.
   * @throws {RangeError} If the depth is invalid.
   */
  index(depth?: number) {
    return this.steps[resolveDepth(depth, this.steps.length - 1)].index;
  }

  /**
   * Returns the offset of the position at `depth`, into that depth's parent node.
   * @param depth The depth of the node, undefined results in the max depth, and negative values are relative to the max depth.
   * @throws {RangeError} If the depth is invalid.
   */
  offset(depth?: number) {
    return this.steps[resolveDepth(depth, this.steps.length - 1)].offset;
  }

  /**
   * Gets the absolute position of the start of the node at `depth`.
   * @param depth The depth of the node, undefined results in the max depth, and negative values are relative to the max depth.
   * @throws {RangeError} If the depth is invalid.
   */
  start(depth?: number) {
    const d = resolveDepth(depth, this.steps.length - 1);
    if (d === 0) return 0;

    let abs = 0;
    for (const { offset } of this.steps.slice(0, d - 1)) abs += offset;
    return abs;
  }

  /**
   * Gets the absolute position of the end of the node at `depth`.
   * @param depth The depth of the node, undefined results in the max depth, and negative values are relative to the max depth.
   * @throws {RangeError} If the depth is invalid.
   */
  end(depth?: number) {
    return this.start(depth) + this.node(depth).nodeSize;
  }

  /**
   * Gets the common ancestor of this position and the given position.
   * @throws {MethodError} If the positions have different boundaries.
   */
  commonAncestor(other: Position) {
    return Position.commonAncestor(this, other);
  }

  toJSON(): number {
    return this.absolute;
  }

  // Static methods

  // TODO: When pos at and of text node, parent node is selected, but text node should still be active (deepest possible)

  static resolve: Resolver<Position> = (boundary: Node, pos: Resolvable<Position>): Result<Position, string> => {
    // TODO: Cached results and use it
    if (pos instanceof Position) return Ok(pos);
    else if (typeof pos === "number")
      return Position.resolveAbsolute(boundary, pos).trace("Position.resolve", "static");

    return pos.resolve(boundary).trace("Position.resolve", "static");
  };

  /**
   * Returns a boolean indicating whether the given value is resolvable to a position.
   */
  static resolvable(pos: unknown): pos is Resolvable<Position> {
    return pos instanceof Position || typeof pos === "number" || pos instanceof AnchorPosition;
  }

  static resolveAbsolute(boundary: Node, pos: number): Result<Position, string> {
    if (pos < 0 || pos > boundary.contentSize)
      return Err(
        `The position ${pos}, is outside of the allowed range: ${0} - ${boundary.contentSize}`,
        "Position.absoluteToPosition",
        "static",
      );
    else if (pos === 0) return Ok(new Position([{ parent: boundary, index: 0, offset: 0 }], 0));

    const steps: LocateStep[] = [];

    const deepestOffset = (parent: Node, offset: number): Result<LocateStep, null> => {
      if (offset > parent.contentSize) return Err();
      else if (parent.type.schema.text || parent instanceof Text) return Ok({ parent, index: 0, offset });
      else if (parent.type.schema.inline) return Err();

      let nodeOffset = 0;
      for (const [c, index] of parent.content.iter()) {
        if (offset === 0) {
          if (c.type.schema.text) {
            steps.push({ parent, index, offset: nodeOffset });
            return Ok({ parent: c, index: 0, offset: 0 });
          }
          return Ok({ parent, index, offset: nodeOffset });
        } else if (offset === c.nodeSize) {
          if (c.type.schema.text) {
            steps.push({ parent, index, offset: nodeOffset });
            return Ok({ parent: c, index: 0, offset: c.nodeSize });
          }
          return Ok({ parent, index: index + 1, offset: nodeOffset + c.nodeSize });
        } else if (offset > c.nodeSize) {
          offset -= c.nodeSize;
          nodeOffset += c.nodeSize;
        } else {
          steps.push({ parent, index, offset: nodeOffset });
          if (c.type.schema.text) return deepestOffset(c, offset);

          return deepestOffset(c, offset - 1);
        }
      }

      return Err();
    };

    const result = deepestOffset(boundary, pos);
    if (result.err) return Err("Failed to resolve absolute position", "Position.resolveAbsolute", "static");

    return Ok(new Position([...steps, result.val]));
  }

  static absolute(pos: AbsoluteLike) {
    return pos instanceof Position ? pos.absolute : pos;
  }

  /**
   * @param node The node (or fragment) in which to convert `index`
   * @param index The index to convert, undefined results in `index = node.content.childCount - 1`, and negative values are relative to the max depth. The index may also be `node.content.childCount`, this means the node after the last child.
   */
  static indexToOffset(node: Node | Fragment, index?: number): Result<number, string> {
    if (node instanceof Node && node.type.schema.text)
      return Err("Can't convert index to offset for text nodes", "Position.indexToOffset", "static");

    const content = node instanceof Node ? node.content : node;
    if (index === undefined) index = content.childCount - 1;
    else if (index < 0) index = content.childCount - 1 + index;

    if (index < 0 || index > content.childCount)
      return Err(
        `The index ${index}, is outside of the allowed range: ${0} - ${content.childCount}`,
        "Position.indexToOffset",
        "static",
      );

    if (index === 0) return Ok(0);
    else if (index === content.childCount) return Ok(content.size);

    let offset = 0;
    for (const [c, i] of content.iter())
      if (i === index) break;
      else offset += c.nodeSize;
    return Ok(offset);
  }

  /**
   * @param node The node (or fragment) in which to convert `offset`
   * @returns An object containing the index and the extra offset after the index, so this isn't the index into the node at index (this is `offset - 1`, accounting for the opening tag), but the offset from the index position.
   */
  static offsetToIndex(node: Node | Fragment, offset: number): { index: number; offset: number } {
    if (node instanceof Node && node.type.schema.text) return { index: 0, offset };

    const content = node instanceof Node ? node.content : node;
    if (offset === 0) return { index: 0, offset: 0 };

    let o = offset;
    for (const [c, i] of content.iter()) {
      if (o === 0) return { index: i, offset: 0 };
      else if (c.nodeSize <= o) o -= c.nodeSize;
      else return { index: i, offset: o };
    }

    return { index: content.childCount, offset: o };
  }

  /**
   * Gets the common ancestor of the two given positions.
   * @throws {MethodError} If the positions have different boundaries.
   */
  static commonAncestor(pos: Position, other: Position): Node {
    return pos.node(Position.commonDepth(pos, other));
  }

  /**
   * Gets the common depth of the two given positions, i.e. the depth of the common ancestor.
   * @throws {MethodError} If the positions have different boundaries.
   */
  static commonDepth(pos: Position, other: Position): number {
    if (pos.boundary !== other.boundary)
      throw new MethodError("Positions have different boundaries", "Position.commonAncestor");

    let depth = 0;
    while (depth <= pos.depth && pos.node(depth) === other.node(depth)) depth++;
    return Math.max(depth - 1, 0);
  }
}

export class AnchorPosition {
  constructor(
    readonly anchor: Node,
    private relative: "before" | "after" | "child" | "offset",
    private offset = 0,
  ) {}

  resolve(boundary: Node): Result<Position, string> {
    if (this.relative === "after" || this.relative === "before")
      return locateNode(boundary, this.anchor, false)
        .map((steps) => {
          if (this.relative === "before") return new Position(steps);

          steps[steps.length - 1].index++;
          steps[steps.length - 1].offset += this.anchor.nodeSize;
          return new Position(steps);
        })
        .trace("AnchorPosition.resolve");
    else
      return locateNode(boundary, this.anchor, true)
        .try((steps) => {
          if (this.offset === 0) return Ok(new Position(steps));

          if (this.relative === "child")
            return Position.indexToOffset(this.anchor, this.offset).map((offset) => {
              steps[steps.length - 1].index = this.offset;
              steps[steps.length - 1].offset = offset;
              return new Position(steps);
            });

          // TODO: Search deeper if possible
          // offset
          const { index } = Position.offsetToIndex(this.anchor, this.offset);
          steps[steps.length - 1].index = index;
          steps[steps.length - 1].offset = this.offset;
          return Ok(new Position(steps));
        })
        .trace("AnchorPosition.resolve");
  }

  // static init methods

  static before(anchor: Node) {
    return new AnchorPosition(anchor, "before");
  }

  static after(anchor: Node) {
    return new AnchorPosition(anchor, "after");
  }

  static child(anchor: Node, index?: number) {
    return new AnchorPosition(anchor, "child", index ?? anchor.childCount);
  }

  static offset(anchor: Node, offset: number) {
    return new AnchorPosition(anchor, "offset", offset);
  }
}

function resolveDepth(depth: number | undefined, max: number, min = 0) {
  if (depth === undefined) return max;

  let i: number;
  if (depth < 0) i = max + depth;
  else i = depth;

  if (i >= min && i <= max) return i;
  else throw new RangeError(`The depth ${depth} (resolved to ${i}), is outside of the allowed range: ${min} - ${max}`);
}

interface LocateStep {
  /**
   * The parent node of the position.
   */
  parent: Node;
  /**
   * The index of the position into `this.parent`.
   * If the parent node is a text node, this will be `0`.
   */
  index: number;
  /**
   * The offset of the position into `this.parent`.
   * This is not the absolute position, but rather the offset to the index position.
   * So it's the same as `Position.indexToOffset(this.parent, this.index)`.
   */
  offset: number;
}

/**
 * Locates the given node in a boundary, returning the steps to reach it.
 * @param boundary The boundary in which to locate `search`
 * @param search The node to locate
 * @param search If set to true, this will include a step for the node itself, with index and offset `0`, defaults to `false`.
 */
export function locateNode(boundary: Node, search: Node, inside = false): Result<LocateStep[], string> {
  if (search === boundary)
    if (inside === false) return Err("The node is the boundary node", "locateNode");
    else return Ok([{ parent: boundary, index: 0, offset: 0 }]);

  const locate = (parent: Node): Result<LocateStep[], null> => {
    let offset = 0;
    for (const [c, i] of parent.content.iter()) {
      if (c === search) {
        const p = { parent, index: i, offset } as LocateStep;
        if (inside) return Ok([p, { parent: c, index: 0, offset: 0 }]);
        else return Ok([p]);
      } else {
        const result = locate(c);
        if (result.ok) return Ok([{ parent, index: i, offset }, ...result.val]);
        else offset += c.nodeSize;
      }
    }
    return Err();
  };

  return locate(boundary).replaceErr("Failed to locate node").trace("locateNode", "static");
}

export function getParentNode(boundary: Node, node: Node): Result<Node, string> {
  return locateNode(boundary, node, false)
    .map((steps) => steps[steps.length - 1].parent)
    .traceMessage("Failed to get parent node", "getParentNode");
}
