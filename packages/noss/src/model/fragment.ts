import type { Node, Text, SerializedNode } from "./node";
import type { Position } from "./position";
import type { Slice } from "./slice";
import type { Serializable } from "../types";
import { MethodError, NotImplementedError } from "@noss-editor/utils";

export interface SerializedFragment {
  size: number;
  nodes: SerializedNode[];
}

export class Fragment implements Serializable<SerializedFragment> {
  readonly nodes: Node[];
  readonly size: number;

  get empty() {
    return this.nodes.length === 0;
  }

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

  private resolveIndex(index?: number, allowLength = false): number {
    if (index === undefined && allowLength) return this.nodes.length;
    else if (index === undefined) return this.nodes.length === 0 ? 0 : this.nodes.length - 1;
    else if (index < 0) return this.nodes.length + index;
    else return index;
  }

  private isValidIndex(index: number): boolean {
    return index >= 0 && index <= this.nodes.length;
  }

  /**
   * Gets the child at `index`, will throw if the index is out of range.
   *
   * @param index The index to get
   * @throws {MethodError} If the index is out of range.
   */
  child(index: number): Node {
    const res = this.softChild(index);
    if (!res) throw new MethodError(`The index ${index}, is out of range`, "Fragment.child");
    return res;
  }

  /**
   * Tries to get the child at `index`, will return undefined if the index is out of range.
   */
  softChild(index: number): Node | undefined {
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

    const i = this.resolveIndex(index, true);
    if (!this.isValidIndex(i))
      throw new MethodError(`Index ${index} (resolved to ${i}) is not in the allowed range`, "Fragment.insert");

    const content = this.nodes.slice();
    content.splice(i, 0, ...nodes);
    return new Fragment(
      content,
      nodes.reduce((a, b) => a + b.nodeSize, this.size),
    );
  }

  /**
   * Inserts a node (or nodes) at `index` in this fragment.
   *
   * @returns The modified fragment.
   * @throws {MethodError} If the index is out of bounds.
   */
  insertChild(node: Node | Node[], index?: number): Fragment {
    const i = this.resolveIndex(index, true);
    if (!this.isValidIndex(i))
      throw new MethodError(`Index ${index} (resolved to ${i}) is not in the allowed range`, "Fragment.insertChild");

    const nodes = Array.isArray(node) ? node : [node];
    const content = this.nodes.slice();
    content.splice(i, 0, ...nodes);
    return new Fragment(
      content,
      nodes.reduce((a, b) => a + b.nodeSize, this.size),
    );
  }

  // TODO: Add NodeRange option?
  /**
   * Removes the content between the given positions.
   *
   * @param from The start, from where to start removing
   * @param to The end, to where to remove
   * @returns The modified fragment.
   */
  remove(from: number, to: number): Fragment {
    // TODO: Verify if content is allowed before removing
    throw new NotImplementedError("Fragment.remove", true);
  }

  /**
   * Removes a single child from this fragment.
   *
   * @param index The index of the child to remove. Leave empty or undefined to remove the last child, or use a negative number to remove with offset from the end.
   * @returns The modified fragment.
   * @throws {MethodError} If the index is out of bounds.
   */
  removeChild(index?: number): Fragment;
  /**
   * Removes one or more child nodes from this fragment.
   *
   * @param node The node or nodes to remove
   * @returns The modified fragment.
   * @throws {MethodError} If one or more of the nodes are not part of this fragment.
   */
  removeChild(node: Node | Node[]): Fragment;
  removeChild(index?: number | Node | Node[]): Fragment {
    const content = this.nodes.slice();

    if (typeof index === "number" || index === undefined) {
      const i = this.resolveIndex(index);
      if (!this.isValidIndex(i))
        throw new MethodError(`Index ${index} (resolved to ${i}) is not in the allowed range`, "Fragment.removeChild");

      content.splice(i, 1);
      return new Fragment(content, this.size - this.child(i).nodeSize);
    } else {
      const nodes = Array.isArray(index) ? index : [index];
      let sizeOffset = 0;
      for (const n of nodes) {
        const index = content.indexOf(n);
        if (index !== -1)
          throw new MethodError("One or more of the given nodes are not part of this fragment", "Fragment.removeChild");

        content.splice(index, 1);
        sizeOffset += n.nodeSize;
      }

      return new Fragment(content, this.size - sizeOffset);
    }
  }

  /**
   * Changes this fragment's content to only include the content between the given positions.
   * This does not cut non-text nodes in half, meaning if the starting position is inside of a node, that entire node is included.
   *
   * @param from The starting position where to cut.
   * @param to The end position, leave empty to cut until the end.
   * @throws {MethodError} If the starting position is greater than the end position, or if one or more of the positions are outside of the allowed range.
   */
  cut(from: number, to: number = this.size): Fragment {
    if (from === 0 && to === this.size) return this;
    else if (from < 0 || from > to || to < 0 || to > this.size)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Fragment.cut",
      );

    let pos = 0;
    const nodes: Node[] = [];
    for (const [c, i] of this.iter()) {
      if (pos + c.nodeSize <= from) {
        pos += c.nodeSize;
        continue;
      } else if (pos >= to) break;

      if (pos < from) {
        const node = c.cut(from - pos);
        nodes.push(node);
        pos += node.nodeSize;
      } else if (pos + c.nodeSize <= to) {
        nodes.push(c);
        pos += c.nodeSize;
      } else {
        const node = c.cut(0, to - pos);
        nodes.push(node);
        pos += node.nodeSize;
      }
    }

    return new Fragment(nodes, pos);
  }

  // TODO: Figure out what to return
  /**
   * @param parent The parent node of this fragment, this is used to check if the slice's content conforms to the parent's schema.
   */
  replace(from: number, to: number, slice: Slice, parent: Node): Fragment {
    throw new Error("Not implemented");
  }

  // TODO: add overload that is consistent with replaceChildRecursive
  /**
   * Much simpler version of replace, only replaces a single child.
   * Always use this method over the more complex replace function, if possible, because this method is far more efficient.
   *
   * @param node The node to replace the child with.
   * @param index The index where to replace the child. Leave empty or undefined to insert at the end, or use a negative number to insert with offset from the end.
   * @throws {MethodError} If the index is out of bounds.
   */
  replaceChild(node: Node, index?: number /* , parent?: Node */): Fragment;
  /**
   * @param child The old node to replace
   * @param modified The node to replace `child` with.
   * @throws {MethodError} If the node is not part of this fragment
   */
  replaceChild(child: Node, modified: Node /* , parent?: Node */): Fragment;
  replaceChild(node: Node, index?: number | Node /* , parent?: Node */) {
    let i: number;
    if (typeof index === "number" || index === undefined) {
      i = this.resolveIndex(index);
      if (!this.isValidIndex(i))
        throw new MethodError(`Index ${index} is not in the allowed range`, "Fragment.replaceChild");
    } else {
      i = this.nodes.indexOf(index);
      if (i === -1)
        throw new MethodError("The provided node to be replaced is not part of this fragment", "Fragment.replaceChild");
    }

    const content = this.nodes.slice();
    content[i] = node;
    // TODO: Check if this is allowed by parent's schema
    return new Fragment(content, this.size - this.child(i).nodeSize + node.nodeSize);
  }

  /**
   * Replaces a `child` of this Fragment with `node` recursively,
   * e.g. if the node isn't a direct child of this fragment, it will search deeper.
   * But the returned result will always be from the depth of this fragment.
   *
   * @param child The child to replace
   * @param node The node to replace the child with
   * @throws {MethodError} If `child` isn't a child of this fragment, or if the new Fragment doesn't conform to the parents schema
   */
  replaceChildRecursive(child: Node, node: Node /* , parent?: Node */): Fragment {
    // TODO: Check if this is allowed by parent's schema
    if (this.contains(child, 0)) {
      // This should always be a valid index
      const index = this.nodes.indexOf(child);
      return this.replaceChild(node, index);
    } else {
      // TODO: Make bfs?
      for (const [n, i] of this.iter()) {
        const c = n.content;
        if (!c.contains(child, 0)) continue;
        const res = c.replaceChildRecursive(child, node);
        return this.replaceChild(n.copy(res), i);
      }
      throw new MethodError(
        "Failed to recursively find the specified child in the Fragment",
        "Fragment.replaceChildRecursive",
      );
    }
  }

  /**
   * Checks if this fragment contains `node`.
   * It does this by performing a breath-first search in the descending nodes.
   * This function may be quite expensive on large nodes.
   *
   * @param maxDepth The maximum depth to search for, a depth of 0 means only this fragment will be searched, etc.
   */
  contains(node: Node, maxDepth?: number, depth = 0): boolean {
    const queue: Node[] = [];

    for (const [c] of this.iter())
      if (c === node) return true;
      else queue.push(c);

    if (maxDepth === depth) return false;
    for (const c of queue) if (c.content.contains(node, maxDepth, depth + 1) === true) return true;

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

  toString() {
    let content = "";
    for (const [n, i] of this.iter())
      if (i !== 0) content += `, ${n.toString()}`;
      else content += n.toString();

    return `[${content}]`;
  }

  toJSON() {
    return {
      size: this.size,
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
