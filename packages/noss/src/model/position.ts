import type { Fragment } from "./fragment";
import { Node } from "./node";
import { MethodError } from "@noss-editor/utils";
import type { Result } from "@noss-editor/utils";
import { Err, Ok } from "@noss-editor/utils";

/**
 * A position or a resolvable position in a boundary.
 */
export type PositionLike = number | RelativePosition | Position;
/**
 * An absolute position or a position that can be resolved to an absolute position.
 */
export type AbsoluteLike = number | Position;

export type IsPosition<T> = T extends Position ? true : false;

type RelativePositionLocation = "before" | "after" | "childIndex" | "childOffset";

export class RelativePosition {
  private offset = 0;

  constructor(
    readonly anchor: Node,
    private readonly location: RelativePositionLocation,
    offset?: number,
  ) {
    if (typeof offset === "number") this.offset = offset;
    else if (location === "childIndex") this.offset = anchor.content.nodes.length;
    else if (location === "childOffset") this.offset = anchor.content.size;
  }

  resolve(boundary: Node): Result<Position, string> {
    return locateNode(boundary, this.anchor)
      .replaceErr("Failed to locate node in the provided boundary")
      .try((locate) => {
        const parent = locate.steps[locate.steps.length - 2];
        const found = locate.steps[locate.steps.length - 1];
        let offset = 0;

        if (this.location === "after" || this.location === "before") {
          if (found.node === locate.boundary) return Err("Can't resolve a position before or after the boundary node");

          if (found.index > 0)
            for (const [child, i] of parent.node.content.iter())
              if (i === found.index) break;
              else offset += child.nodeSize;

          if (this.location === "after") offset += this.anchor.nodeSize;

          return Ok(new Position(boundary, found.depth - 1, parent.node, offset, popSteps(locate)));
        } else if (this.location === "childIndex" || this.location === "childOffset") {
          if (this.location === "childIndex") offset = Position.indexToOffset(this.anchor, this.offset);
          else offset = this.offset;

          if (offset > this.anchor.contentSize)
            return Err("Offset is greater than the size of the anchor node's content");
          else if (offset < 0) return Err("Negative offsets aren't allowed");

          // TODO: Actually calculate the deepest possible node instead of just giving the offset
          return Ok(new Position(boundary, found.depth, this.anchor, offset, locate));
        }

        return Err("Failed to resolve position in the provided boundary");
      })
      .trace("RelativePosition.resolve");
  }
}

export class Position {
  constructor(
    /**
     * The boundary this position was resolved in
     */
    readonly boundary: Node,
    /**
     * The depth the position is relative to the boundary, 0 means it is the boundary, 1 means it is a direct child of the boundary, etc.
     * This is the depth of the deepest node to this position, so it this pos resolves inside a text node, it will be the depth of the text node itself.
     */
    readonly depth: number,
    /**
     * The parent node of this position
     */
    readonly parent: Node,
    /**
     * The offset this position has into its parent node
     */
    readonly offset: number,
    /**
     * The result from the `locateNode` function.
     */
    readonly locate: LocateData,
  ) {}

  private resolveDepth(depth?: number) {
    if (depth === undefined) return this.depth;
    else if (depth < 0) return this.depth + depth;
    else return depth;
  }

  private validateDepth(depth: number) {
    if (depth >= 0 && depth <= this.locate.steps.length) return;
    throw new RangeError(`Invalid depth value; ${depth}`);
  }

  /**
   * Returns the node at `depth`.
   *
   * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
   * @throws {RangeError} If the depth is invalid or the depth is the same as the current depth.
   */
  node(depth?: number) {
    depth = this.resolveDepth(depth);
    this.validateDepth(depth);
    if (depth === this.depth)
      throw new RangeError("Invalid depth value; can't get the node at the same depth as the position itself.");

    return this.locate.steps[depth].node;
  }

  /**
   * The index in the parent node at `depth`.
   *
   * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
   */
  index(depth?: number) {
    depth = this.resolveDepth(depth);
    this.validateDepth(depth);
    if (depth === this.depth) {
      const i = Position.offsetToIndex(this.parent, this.offset);
      if (i) return i;
      throw new RangeError(
        "Failed to get the index of the position in the parent node; the position doesn't resolve to an index of parent",
      );
    }

    return this.locate.steps[depth].index;
  }

  /**
   * Returns the absolute position, where the parent node at `depth` starts.
   *
   * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
   */
  start(depth?: number) {
    depth = this.resolveDepth(depth);
    this.validateDepth(depth);

    const existing = this.locate.steps[depth];
    if (existing.pos !== undefined) return existing.pos;

    const res = this.boundary.content.offset(this.node(depth));
    if (!res) throw new MethodError(`Failed to get the absolute position of node at depth ${depth}`, "Position.start");

    return res;
  }

  /**
   * Returns the absolute position, where the parent node at `depth` ends.
   *
   * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
   */
  end(depth?: number) {
    return this.start(depth) + this.node(depth).content.size;
  }

  /**
   * Returns the relative offset to `node`.
   * @param node The depth of a parent node of this position, or a node in this boundary.
   * @returns The relative position to node, will be undefined if this position is before `node`. Or undefined if node cannot be resolved in the same document as this position.
   */
  relative(node: Node | number) {
    let pos: number | undefined;
    if (typeof node === "number") pos = this.start(node);
    else pos = this.boundary.content.offset(node);
    if (!pos)
      throw new MethodError("Failed to get the absolute position of node in the current boundary", "Position.relative");

    return this.toAbsolute() - pos;
  }

  /**
   * Gets the depth of the deepest common parent between two positions.
   * @returns The depth of the deepest common parent.
   * @throws If the two positions are in different boundaries.
   */
  commonDepth(pos: Position) {
    const common = findCommonParent(this, pos);
    if (!common)
      throw new MethodError("Failed to find a common parent between the two positions", "Position.commonDepth");

    return common.depth;
  }

  /**
   * Gets the deepest common parent between two positions.
   * @returns The common parent node, or undefind if it failed.
   * @throws If the two positions are in different boundaries.
   */
  commonParent(pos: Position) {
    const d = this.commonDepth(pos);
    return d === undefined ? d : this.node(d);
  }

  private _cachedAbsolute?: number;

  /**
   * Converts this position to an absolute position in the Position's boundary.
   * @returns The absolute position
   */
  toAbsolute(): number {
    if (this._cachedAbsolute) return this._cachedAbsolute;

    const fn = () => {
      const existing = this.locate.steps[this.locate.steps.length - 1];
      if (existing?.pos) return existing.pos + this.offset + 1;

      let pos = 0;

      for (let i = 1; i < this.locate.steps.length; i++) {
        const parent = this.locate.steps[i - 1];
        const step = this.locate.steps[i];
        if (i > 1) pos += 1; // start tag
        pos += Position.indexToOffset(parent.node, step.index);
      }

      if (pos === 0) return pos + this.offset;
      else return pos + 1 + this.offset;
    };

    return (this._cachedAbsolute = fn());
  }

  /**
   * Resolves the position in the given boundary,
   * will throw if resolving the position failed.
   *
   * @param boundary The boundary to resolve the position in
   * @param pos The PositionLike to resolve, can be a absolute position (number), relative position or an already resolved position
   * @throws {MethodError} If resolving the position failed
   */
  static resolve(boundary: Node, pos: PositionLike) {
    const res = Position.softResolve(boundary, pos);
    if (res.err) throw new MethodError("Failed to resolve the position in the given boundary", "Position.resolve");
    return res.val;
  }

  /**
   * Tries to resolve the position in the given boundary,
   * will return undefined if it failed.
   *
   * @param boundary The boundary to resolve the position in
   * @param pos The PositionLike to resolve, can be a absolute position (number), relative position or an already resolved position.
   */
  static softResolve(boundary: Node, pos: PositionLike): Result<Position, string> {
    if (pos instanceof Position) return Ok(pos);
    else if (pos instanceof RelativePosition) return pos.resolve(boundary);
    else return Position.absoluteToPosition(boundary, pos);
  }

  /**
   * Converts an absolute position to a resolved `Position`
   * @param boundary The boundary where to resolve the absolute position
   * @param pos The absolute position to resolve
   * @returns The resolved position, or undefined if it failed.
   */
  static absoluteToPosition(boundary: Node, pos: number): Result<Position, string> {
    if (pos < 0 || pos > boundary.nodeSize)
      return Err(`The position ${pos}, is outside of the allowed range`).trace("Position.absoluteToPosition", "static");
    else if (pos === 0)
      return Ok(
        new Position(boundary, 0, boundary, 0, {
          boundary,
          steps: [{ node: boundary, depth: 0, index: 0 }],
        }),
      );

    const steps: LocateStep[] = [];

    interface DeepestFound {
      depth: number;
      parent: Node;
      offset: number;
    }

    const deepestOffset = (node: Node, depth: number, offset: number): DeepestFound | undefined => {
      if (offset === 0) return { depth, parent: node, offset: 0 };
      else if (node.content.nodes.length === 0 && offset === 1) return { depth, parent: node, offset: 1 };

      let nodeOffset = 0;
      // TODO: Check if node can hold content before trying to loop over children
      // aka, when a text node is found just subtract the content length, instead of looping over the (non-existent) content
      for (const [c, i] of node.content.iter()) {
        if (offset > c.nodeSize) {
          offset -= c.nodeSize;
          nodeOffset += offset;
          continue;
        } else if (offset === 0) return { depth, parent: node, offset: nodeOffset };
        else if (offset === c.nodeSize) return { depth, parent: node, offset: nodeOffset + c.nodeSize };

        // this node is a parent of the position, so push it to the stack
        steps.push({ node: c, index: i, depth, pos: pos - offset });
        return deepestOffset(c, depth + 1, offset - 1);
      }

      return;
    };

    steps.push({ node: boundary, index: 0, depth: 0, pos: 0 });
    const res = deepestOffset(boundary, 1, pos);
    if (!res)
      return Err("Failed to resolve the position in the given boundary").trace("Position.absoluteToPosition", "static");

    const locate: LocateData = { boundary, steps };
    return Ok(new Position(boundary, res.depth, res.parent, res.offset, locate));
  }

  /**
   * Converts a position to an absolute position in the Position's boundary.
   * @returns The absolute position, or undefined if it failed.
   */
  static positionToAbsolute(pos: Position | number) {
    return typeof pos === "number" ? pos : pos.toAbsolute();
  }

  /**
   * Converts an index to an offset in a node
   * @param parent The node to use as parent
   * @param index The index to convert to an offset
   */
  static indexToOffset(parent: Node | Fragment, index?: number) {
    const content = parent instanceof Node ? parent.content : parent;

    if (index === undefined) index = content.nodes.length;
    else if (index < 0) index = content.nodes.length + index;

    if (index === 0) return 0;

    let offset = 0;
    for (const [child, i] of content.iter())
      if (i === index) break;
      else offset += child.nodeSize;

    return offset;
  }

  /**
   * Tries to convert an offset to an index.
   *
   * @param parent The node to use as parent
   * @param offset The offset to convert to an index
   * @returns
   *    The index or undefined if it doesn't resolve as a direct child.
   *    The index may also be the length of the content, this means the offset directly after the last child.
   */
  // prettier-ignore
  static offsetToIndex(parent: Node | Fragment, offset: number, advanced?: false): number | undefined;
  /**
   * Tries to convert an offset to an index.
   *
   * @param parent The node to use as parent
   * @param offset The offset to convert to an index
   * @returns
   *    An object with the index and the offset into the node.
   *    The index may also be the length of the content, this means the offset directly after the last child.
   */
  // prettier-ignore
  static offsetToIndex(parent: Node | Fragment, offset: number, advanced: true): { index: number; offset: number };
  static offsetToIndex(parent: Node | Fragment, offset: number, advanced?: boolean) {
    const decide = (a: number | undefined, b: { index: number; offset: number }) => (advanced === true ? b : a);

    if (offset === 0) return decide(0, { index: 0, offset: 0 });

    const content = parent instanceof Node ? parent.content : parent;
    if (offset < 0 || offset > content.size)
      throw new MethodError(`The offset ${offset}, is outside of the allowed range`, "Position.offsetToIndex");

    let pos = 0;
    for (const [child, i] of content.iter()) {
      if (offset === pos) return decide(i, { index: i, offset: 0 });
      pos += child.nodeSize;

      if (pos > offset) return decide(undefined, { index: i, offset: pos - offset });
    }

    if (offset === pos)
      return decide(content.nodes.length, {
        index: content.nodes.length,
        offset: 0,
      });
  }

  /**
   * Returns a boolean indicating wheter or not `pos` is a resolved Position
   */
  static is(pos: PositionLike): boolean {
    if (pos instanceof Position) return true;
    else return false;
  }

  // static init methods
  /**
   * Creates a position that resolves before `anchor`
   */
  static before(anchor: Node) {
    return new RelativePosition(anchor, "before");
  }

  /**
   * Creates a position that resolves after `anchor`
   */
  static after(anchor: Node) {
    return new RelativePosition(anchor, "after");
  }

  /**
   * Creates a position that resolves as a child of `anchor` at index `index`, this is guaranteed to resolve as a direct child of the `anchor` (it cannot cut an existing node in half)
   * @param index The index where to resolve, leave empty for last item, and negative index to start from the last child
   */
  static child(anchor: Node, index?: number) {
    return new RelativePosition(anchor, "childIndex", index);
  }

  /**
   * Creates a position that resolves as a child of `anchor` at offset `offset`
   * @param offset The offset into the parent
   */
  static offset(anchor: Node, offset: number) {
    return new RelativePosition(anchor, "childOffset", offset);
  }

  // TODO: Figure out how to implement to and from json, as we need a reference to the boundary node (probably via the id, and create a function that creates or finds a node with same id in document)
}

export interface IndexPosData {
  boundary: Node;
  /**
   * The parent node of this position
   */
  node: Node;
  /**
   * The depth the parent is relative to the boundary root
   */
  depth: number;
  /**
   * The index of the node in the parent's content
   */
  index: number;
}

export interface LocateData {
  boundary: Node;
  steps: LocateStep[];
}

export interface LocateStep {
  node: Node;
  /**
   * The depth this node is at, 0 means it is the boundary, 1 means it is a direct child of the document, etc.
   */
  depth: number;
  /**
   * The index this node has in its parents content.
   */
  index: number;
  /**
   * The absolute position of the node of this step.
   */
  pos?: number;
}

/**
 * Removes the last step from the result of the `locateNode` function.
 */
function popSteps(data: LocateData) {
  data.steps = data.steps.slice(0, -1);
  return data;
}

export function getParentNode(boundary: Node, child: Node): Result<Node, string> {
  return locateNode(boundary, child)
    .replaceErr("Failed to locate the child node in the boundary")
    .try((locate) => {
      if (locate.steps.length <= 1) return Err("Child doesn't have a parent node");
      return Ok(locate.steps[locate.steps.length - 2].node);
    })
    .trace("getParentNode");
}

export function getNodeById(boundary: Node, id: string): Result<Node, null> {
  if (boundary.id === id) return Ok(boundary);
  else if (boundary.type.schema.text) return Err().trace("getNodeById");

  for (const [c] of boundary.content.iter()) {
    const res = getNodeById(c, id);
    if (res.ok) return res;
  }
  return Err().trace("getNodeById");
}

/**
 * Performs a breath-first search on the boundary to try to find the provided node
 * @param boundary The boundary node to search in
 * @param node The node to search for
 * @returns Info about the node if found, else it returns undefined
 */
export function locateNode(boundary: Node, node: Node): Result<LocateData, null> {
  if (boundary === node) {
    const step = {
      depth: 0,
      index: 0,
      node: boundary,
    };
    return Ok({
      boundary,
      steps: [step],
    });
  }
  return bfsSteps(boundary, 0, 0, node)
    .map((steps) => ({ boundary, steps }))
    .trace("locateNode");
}

function bfsSteps(node: Node, nodeIndex: number, depth: number, search: Node): Result<LocateStep[], null> {
  const a: [Node, number][] = [];

  for (const [child, i] of node.content.iter()) {
    if (search === child)
      return Ok([
        { depth, node, index: nodeIndex },
        { depth: depth + 1, node: child, index: i },
      ]);
    else a.push([child, i]);
  }

  for (const [c, i] of a) {
    const res = bfsSteps(c, i, depth + 1, search);
    if (res.ok) {
      res.val.unshift({
        depth: depth,
        node,
        index: nodeIndex,
      });
      return res;
    }
  }

  return Err(null);
}

/**
 * Tries to find the deepest possible common parent between two positions.
 * @returns The common parent between the two positions, or undefined it failed
 */
function findCommonParent(from: Position, to: Position) {
  if (from.boundary !== to.boundary) return;

  // can probably skip depth 0, as it is always the document node
  const depth = findDeepestCommonParent(from, to, 0);
  if (!depth) return;

  return {
    ...depth,
    boundary: from.boundary,
  } as IndexPosData;
}

function findDeepestCommonParent(from: Position, to: Position, depth: number): LocateStep | undefined {
  if (!from.locate.steps[depth] || !to.locate.steps[depth]) return undefined;
  else if (from.locate.steps[depth].node === to.locate.steps[depth].node) {
    const res = findDeepestCommonParent(from, to, depth + 1);
    if (res) return res;
    else return from.locate.steps[depth];
  }

  return undefined;
}
