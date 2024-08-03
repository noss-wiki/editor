import type { Node, NodeJSON } from "./node";
import type { Position } from "./position";
import type { Slice } from "./slice";
import { MethodError, NotImplementedError } from "../error";

export class Fragment {
  readonly nodes: Node[];
  readonly size: number;

  get childCount() {
    return this.nodes.length;
  }

  /**
   * @param content The content of this fragment
   * @param size Optionally the size of this fragment, this prevents having to calculate it again.
   */
  constructor(content: Node[], size?: number) {
    this.nodes = content;

    this.size = size || 0;
    if (size === undefined) for (const [child, i] of this.iter()) this.size += child.nodeSize;
  }

  private resolveIndex(index?: number): number {
    if (!index) return this.nodes.length === 0 ? 0 : this.nodes.length - 1;
    else if (index < 0) return this.nodes.length + index;
    else return index;
  }

  private isValidIndex(index: number): boolean {
    return index >= 0 && index <= this.nodes.length;
  }

  child(index: number): Node {
    return this.nodes[index];
  }

  /**
   * Appends the `nodes` to the end of this fragment.
   *
   * @param nodes Single nodes, node arrays, or fragments to append.
   * @returns The modified fragment.
   */
  append(...nodes: (Node | Node[] | Fragment)[]) {
    const _nodes = nodes.flatMap((e) => (e instanceof Fragment ? e.nodes : e));
    const content = this.nodes.slice();
    content.push(..._nodes);
    return new Fragment(
      content,
      _nodes.reduce((a, b) => a + b.nodeSize, this.size),
    );
  }

  /**
   * Inserts `node` at `index` in this fragment.
   *
   * @param node The node or nodes to insert
   * @param index The index where to insert. Leave empty or undefined to insert at the end, or use a negative number to insert with offset from the end. If this value is out of bounds the value will be clamped.
   * @returns The modified fragment.
   * @throws {MethodError} If the index is out of bounds.
   */
  insert(node: Node | Node[] | Fragment, index?: number): Fragment {
    // TODO: Verify if content is allowed before inserting
    if (node instanceof Fragment) node = node.nodes;
    const nodes: readonly Node[] = Array.isArray(node) ? node : [node];

    const i = this.resolveIndex(index);
    if (!this.isValidIndex(i)) throw new MethodError(`Index ${index} is not in the allowed range`, "Fragment.insert");

    const content = this.nodes.slice();
    content.splice(i, 0, ...nodes);
    return new Fragment(
      content,
      nodes.reduce((a, b) => a + b.nodeSize, this.size),
    );
  }

  /**
   * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
   *
   * Removes a single node from this content.
   *
   * @param node The node to remove
   * @returns The modified fragment.
   * @throws {MethodError} If given the node is not part of this fragment.
   */
  remove(node: Node): Fragment;
  /**
   * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
   *
   * Removes the content between the given positions.
   *
   * @param from The start, from where to start removing
   * @param to The end, to where to remove
   * @returns The modified fragment.
   */
  remove(from: number, to: number): Fragment;
  remove(node: Node | number, to?: number): Fragment {
    // TODO: Verify if content is allowed before removing
    const content = this.nodes.slice();

    if (typeof node !== "number") {
      const index = content.indexOf(node);
      if (index === -1)
        throw new MethodError("The provided node to be removed is not part of this fragment", "Fragment.remove");

      content.splice(index, 1);
      return new Fragment(content, this.size - this.child(index).nodeSize);
    } else {
      throw new NotImplementedError("Fragment.remove", true);
    }
  }

  /**
   * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
   *
   * Changes this fragment's content to only include the content between the given positions.
   * This does not cut non-text nodes in half, meaning if the starting position is inside of a node, that entire node is included.
   *
   * @param from The starting position where to cut.
   * @param to The end position, leave empty to cut until the end.
   * @throws {MethodError} If the starting position is greater than the end position, or if one or more of the positions are outside of the allowed range.
   */
  cut(from: number, to: number = this.size): Fragment {
    if (from === 0 && to === this.size) return this;
    else if (from > to) throw new MethodError("The starting position is greater than the end position", "Fragment.cut");
    else if (from < 0 || to < 0 || to > this.size)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Fragment.cut",
      );

    const res: Node[] = [];
    let pos = 0;
    let size = 0;
    for (const [c] of this.iter())
      if (c.nodeSize < from - pos) pos += c.nodeSize;
      else if (pos > to) break;
      else {
        if (typeof c.text === "string") c.cut(Math.max(0, from - pos), Math.min(c.text.length, to - pos));
        else c.cut(Math.max(0, from - pos - 1), Math.min(c.content.size, to - pos - 1));

        res.push(c);
        size += c.nodeSize;
        pos += c.nodeSize;
      }

    return new Fragment(res, size);
  }

  // TODO: Figure out what to return
  /**
   * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
   *
   * @param parent The parent node of this fragment, this is used to check if the slice's content conforms to the parent's schema.
   */
  replace(from: number, to: number, slice: Slice, parent: Node) {
    // TODO: Verify if content of slice conforms to this parent node's content
    const $from = parent.resolve(from);
    const $to = parent.resolve(to);

    if (!$from || !$to) throw new MethodError(`Positions couldn't be resolved`, "Fragment.replace");
    else if (slice.openStart > $from.depth || slice.openEnd > $to.depth)
      throw new MethodError(
        "The insert slice's depth is greater than the depth of the position it is inserted at",
        "Fragment.replace",
      );
    else if ($from.depth - $to.depth !== slice.openStart - slice.openEnd)
      throw new MethodError("The slice and insertion position have inconsistent depths", "Fragment.replace");

    // TODO: Test if the result of this method is allowed by the parent node's schema
    return replaceOuter($from, $to, slice);
  }

  /**
   * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
   *
   * Much simpler version of replace, only replaces a single child.
   * Always use this method over the more complex replace function, because this method is far more efficient.
   *
   * @param node The node to replace the child with.
   * @param index The index where to replace the child. Leave empty or undefined to insert at the end, or use a negative number to insert with offset from the end.
   * @throws {MethodError} If the index is out of bounds.
   */
  replaceChild(node: Node, index?: number) {
    const i = this.resolveIndex(index);
    if (!this.isValidIndex(i))
      throw new MethodError(`Index ${index} is not in the allowed range`, "Fragment.replaceChild");

    const content = this.nodes.slice();
    content[i] = node;
    return new Fragment(content, this.size - this.child(i).nodeSize + node.nodeSize);
  }

  /**
   * Checks if this fragment contains `node`.
   * It does this by performing a breath-first search in the descending nodes.
   * This function may be quite expensive on large nodes.
   */
  contains(node: Node): boolean {
    const queue: Node[] = [];

    for (const [c] of this.iter())
      if (c === node) return true;
      else queue.push(c);

    for (const c of queue) if (c.content.contains(node) === true) return true;

    return false;
  }

  /**
   * Calculates the offset `node` has into this fragment.
   * Call this on the document node to get the absolute position of a node.
   * @returns The offset if found, or undefined if not found.
   */
  offset(node: Node): number | undefined {
    const queue: [Node, number][] = [];
    let offset = 0;

    for (const [c] of this.iter()) {
      if (c === node) return offset;
      else queue.push([c, offset]);

      offset += c.nodeSize;
    }

    for (const [c, o] of queue) {
      const res = c.content.offset(node);
      if (res === undefined) continue;
      return o + res + 1;
    }
  }

  /**
   * Checks if `other` is equal to this fragment
   * @param other The fragment to check
   */
  eq(other: Fragment): boolean {
    if (this === other) return true;
    else if (this.nodes.length !== other.nodes.length) return false;

    for (const [node, i] of this.iter()) if (!node.eq(other.nodes[i])) return false;

    return true;
  }

  /**
   * Creates a deep copy of this fragment, so child node references will be lost, as they will also get copied.
   * It does this by recursively calling this method on every child node.
   */
  /* copy(): Fragment {
    const children: Node[] = [];
    for (const [c] of this.iter()) children.push(c.copy());
    return new Fragment(children);
  } */

  // TODO: Maybe also just implement [Symbol.iterator] to avoid having to call iter()
  /**
   * Iterate over all nodes, yields an array with first item the node, and second item the index.
   */
  *iter(): Generator<[Node, number], void, unknown> {
    for (let i = 0; i < this.nodes.length; i++) yield [this.nodes[i], i];
  }

  toJSON(): FragmentJSON {
    return {
      nodes: this.nodes.map((e) => e.toJSON()),
    };
  }

  // TODO: Check if content can be joined (like same mark text nodes)
  static from(content: Node | Node[] | Fragment) {
    if (!content) return Fragment.empty;
    else if (content instanceof Fragment) return content;
    else if (Array.isArray(content)) return new Fragment(content);
    else return new Fragment([content]);
  }

  static empty = new Fragment([], 0);
}

export type FragmentJSON = {
  nodes: NodeJSON[];
};

// TODO: Test the replace method thoroughly
function replaceOuter(from: Position, to: Position, slice: Slice, depth = 0): Fragment {
  const node = from.node(depth);
  const index = from.index(depth);

  if (index === to.index(depth) && depth < from.depth - slice.openStart) {
    const inner = replaceOuter(from, to, slice, depth + 1);
    const child = node.content.child(index).copy(inner);
    return node.content.replaceChild(child, index);
  } else if (slice.size === 0) {
    return node.content.remove(from.relative(depth), to.relative(depth));
  } else if (slice.openStart === 0 && slice.openEnd === 0 && from.depth === depth && to.depth === depth) {
    // TODO: check for success
    return node.content.cut(0, from.relative(depth)).append(slice.content, node.content.cut(to.relative(depth)));
  } else {
    // complex case
  }

  throw new NotImplementedError("Fragment.replace", true);
}

function addNode(node: Node, target: Node[]) {
  const l = target.length - 1;
  if (node.text === null) target.push(node);
  // TODO: check for same marks
  else if (target.length > 0 && target[l].text !== null) target[l] = target[l].copy(target[l].text + node.text);
}

function addBetween(from: Position | null, to: Position | null, depth: number, target: Node[]) {
  // biome-ignore lint: either to or from must be non-null
  const node = (to || from)!.node(depth);
  let start = 0;
  const end = to ? to.index(depth) : node.childCount;

  if (from) {
    start = from.index(depth);

    if (from.depth > depth) start++;
    // cut the text if this is a text node
    else if (from.offset && from.parent.text !== null) {
      // don't add if the text is empty
      if (from.offset < from.parent.text.length) addNode(from.parent.cut(from.offset), target);
      start++;
    }
  }

  for (let i = start; i < end; i++) addNode(node.child(i), target);
  if (to?.offset && to.parent.text !== null) addNode(to.parent.cut(0, to.offset), target);
}

function getSliceOuter(slice: Slice, from: Position) {
  const depthOffset = from.depth - slice.openStart;
  let node = from.node(depthOffset).copy(slice.content);

  // replicate node structure until parent node
  for (let i = depthOffset - 1; i >= 0; i--) node = from.node(i).copy(Fragment.from(node));

  return {
    start: node.resolve(slice.openStart),
    end: node.resolve(node.content.size - slice.openEnd),
  };
}

// find different algorithm
function replaceComplex(from: Position, sliceStart: Position, sliceEnd: Position, to: Position, depth = 0) {
  const content: Node[] = [];

  addBetween(null, from, depth, content);
}

/*
Deepest common parent of the slice.
Go layer by layer, adding the content from the existing structure, the content of the slice and the content after.
*/
