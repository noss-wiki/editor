import type { Result } from "@noss-editor/utils";
import type { Fragment } from "./fragment";
import { Ok, Err } from "@noss-editor/utils";
import { Node, Text } from "./node";

type PositionLike = Position | number;

// TODO: Re-implement relative positions
// TODO: Add some unit tests
export class Position {
  readonly boundary: Node;
  readonly parent: Node;
  readonly absolute: number;

  constructor(
    private steps: LocateStep[],
    absolute?: number,
  ) {
    this.boundary = this.steps[0].parent;
    this.parent = this.steps[this.steps.length - 1].parent;
    this.absolute = absolute ?? this.getAbsolute();
  }

  private getAbsolute(): number {
    let abs = 0;
    for (const { offset } of this.steps) abs += offset;
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

  // Static methods

  static resolve(boundary: Node, pos: PositionLike): Result<Position, string> {
    // TODO: Cached results and use it
    if (pos instanceof Position) return Ok(pos);
    else return Position.resolveAbsolute(boundary, pos).trace("Position.resolve", "static");
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
      if (offset === 0) return Ok({ parent, index: 0, offset: 0 });
      else if (offset > parent.contentSize) return Err();

      if (parent.type.schema.text || parent instanceof Text) return Ok({ parent, index: 0, offset });
      else if (parent.type.schema.inline) return Err();

      let nodeOffset = 0;
      for (const [c, index] of parent.content.iter()) {
        if (offset === 0) return Ok({ parent, index, offset: nodeOffset });
        else if (offset === c.nodeSize) return Ok({ parent, index: index + 1, offset: 0 });
        else if (offset > c.nodeSize) {
          offset -= c.nodeSize;
          nodeOffset += c.nodeSize;
        } else {
          steps.push({ parent, index, offset: nodeOffset });
          return deepestOffset(c, offset - 1);
        }
      }

      return Err();
    };

    const result = deepestOffset(boundary, pos);
    if (result.err) return Err("Failed to resolve absolute position", "Position.resolveAbsolute", "static");
    else return Ok(new Position([...steps, result.val], pos));
  }

  /**
   * @param node The node (or fragment) in which to convert `index`
   * @param index The index to convert, undefined results in `index = node.content.childCount - 1`, and negative values are relative to the max depth. The index may also be `node.content.childCount`, this means the node after the last child.
   * @throws {RangeError} If the index is invalid.
   */
  static indexToOffset(node: Node | Fragment, index?: number): number {
    const content = node instanceof Node ? node.content : node;
    if (index === undefined) index = content.childCount - 1;
    else if (index < 0) index = content.childCount - 1 + index;

    if (index < 0 || index > content.childCount)
      throw new RangeError(`The index ${index}, is outside of the allowed range: ${0} - ${content.childCount}`);

    if (index === 0) return 0;
    else if (index === content.childCount) return content.size;

    let offset = 0;
    for (const [c, i] of content.iter())
      if (i === index) break;
      else offset += c.nodeSize;
    return offset;
  }

  /**
   * @param node The node (or fragment) in which to convert `offset`
   * @returns An object containing the index and the extra offset after the index, so this isn't the index into the node at index (this is `offset - 1`, accounting for the opening tag), but the offset from the index position.
   */
  static offsetToIndex(node: Node | Fragment, offset: number): { index: number; offset: number } {
    const content = node instanceof Node ? node.content : node;
    if (offset === 0) return { index: 0, offset: 0 };

    let o = 0;
    for (const [c, i] of content.iter()) {
      if (o === 0) return { index: i, offset: 0 };
      else if (c.nodeSize < o) o -= c.nodeSize;
      else return { index: i, offset: o };
    }

    return { index: content.childCount, offset: o };
  }
}

function resolveDepth(depth: number | undefined, max: number, min = 0) {
  if (depth === undefined) return max;

  let i: number;
  if (depth < 0) i = max + depth;
  else i = depth;

  if (i >= min && i <= max) return i;
  else throw new RangeError(`The depth ${i}, is outside of the allowed range: ${min} - ${max}`);
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
  if (search === boundary) return Err("The node is the boundary node", "locateNode");

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
