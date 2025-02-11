import type { Result } from "@noss-editor/utils";
import type { Node, Text } from "../model/node";
import type { FlatRange, Range } from "../model/range";
import type { Serializable, Serialized } from "../types";
import { AbsoluteRange, NodeRange } from "../model/range";
import { AnchorPosition, Position, type AbsoluteLike } from "../model/position";
import { Err, Ok, wrap, all } from "@noss-editor/utils";

// TODO: Remove this entirely or maybe include smth similar for easier change tracking? like what exactly change (attrs, content, etc.)
export enum ChangeType {
  insert = "insert",
  remove = "remove",
  replace = "replace",
}

interface SerializedChange {
  readonly range: Serialized<Range>;
  readonly modified?: Serialized<Node>;
}

export class Change implements Serializable<SerializedChange> {
  /**
   * The diffence in size if this Change is applied.
   * Can be negative, if the removed node is larger than the added node.
   */
  readonly size: number;
  public rangeIsCollapsed = false;
  public range!: NodeRange;
  public mappedRange!: NodeRange;

  constructor(range: NodeRange | AbsoluteRange, modified?: Node, changeIsTextReplacement?: boolean);
  constructor(
    private unresolvedRange: NodeRange | AbsoluteRange,
    readonly modified?: Node,
    /**
     * This flag is set to true if the change is a text replacement. So replacing a text node.
     * Setting this, will allow the map method to preserve cursor position.
     */
    public changeIsTextReplacement = false,
  ) {
    this.size = (this.modified?.nodeSize ?? 0) - this.unresolvedRange.size;
    if (unresolvedRange instanceof NodeRange && unresolvedRange.node?.type.schema.text && modified?.type.schema.text)
      this.changeIsTextReplacement = true;
  }

  reconstruct(boundary: Node): Result<Node, string> {
    const res = this.unresolvedRange.resolve(boundary).try((range) => range.asNodeRange());
    if (res.err) return res.trace("Change.reconstruct");
    this.range = res.val;
    this.rangeIsCollapsed = this.range.isCollapsed;

    if (this.range.anchor.boundary !== boundary)
      return Err("The boundary of the range is different from the provided boundary", "Change.reconstruct");

    const parent = this.range.anchor.parent;
    if (parent.type.schema.text) {
      if (this.modified && !this.modified.type.schema.text)
        return Err("Can't insert non-text node into a text node", "Change.reconstruct");

      this.changeIsTextReplacement = true;

      return wrap(() => {
        const text = parent as Text;
        const offset = this.range.first.offset();
        const mod = this.range.isCollapsed ? text : text.remove(offset, this.range.last.offset());
        const insert = !this.modified ? mod : mod.insert(offset, (this.modified as Text).text);
        return boundary.copy(boundary.content.replaceChildRecursive(text, insert));
      });
    }

    const index = this.range.first.index();
    return wrap(() => {
      const mod = this.range.isCollapsed ? parent : parent.removeChild(index);
      const insert = !this.modified ? mod : mod.insertChild(this.modified, index);
      if (parent === boundary) return insert;
      else return boundary.copy(boundary.content.replaceChildRecursive(parent, insert));
    }).trace("Change.reconstruct");
  }

  reconstructRange(modifiedBoundary: Node): Result<NodeRange, string> {
    const res = Position.resolve(modifiedBoundary, this.range.first.absolute).try((first) => {
      if (!this.modified) return Ok(new NodeRange(first));

      const lastAbs = this.range.last.absolute + this.size;
      return Position.resolve(modifiedBoundary, lastAbs).map((last) => {
        if (this.range.first === this.range.anchor) return new NodeRange(first, last);
        else return new NodeRange(last, first);
      });
    });

    if (res.ok) this.mappedRange = res.val;
    return res.trace("Change.reconstructRange");
  }

  // TODO: Add special behavior for text replacement, to keep selection correct

  /**
   * Maps the given position through this change.
   */
  map(pos: number): Result<number, never>;
  map(pos: Position, modifiedBoundary: Node): Result<Position, string>;
  map<T extends AbsoluteLike>(pos: T, modifiedBoundary?: Node): Result<T, string> {
    const absPos = typeof pos === "number" ? pos : pos.absolute;
    const anchor = Position.absolute(this.unresolvedRange.first);
    let abs: number;
    if (absPos <= anchor) abs = absPos;
    else abs = Math.max(absPos + this.size, anchor);

    if (typeof pos === "number") return Ok(abs as T);
    else return Position.resolve(modifiedBoundary as Node, abs).trace("Change.map") as Result<T, string>;
  }

  /**
   * Maps the given range through this change.
   */
  mapRange(range: AbsoluteRange): Result<AbsoluteRange, never>;
  mapRange<T extends Range>(range: T, modifiedBoundary: Node): Result<T, string>;
  mapRange(range: AbsoluteRange | Range, modifiedBoundary?: Node) {
    // TODO: Custom behaviour if replacing text nodes? to keep selection
    const { anchor, focus } = range.absolute;

    if (typeof range.anchor === "number") return Ok(new AbsoluteRange(this.map(anchor).val, this.map(focus).val));
    else if (!modifiedBoundary)
      return Err("Modified boundary is required to map a non-absolute range", "Change.mapRange");

    return all(
      Position.resolve(modifiedBoundary, this.map(anchor).val),
      Position.resolve(modifiedBoundary, this.map(focus).val),
    ) //
      .map(([a, f]) => (range as Range).copy(a, f))
      .trace("Change.mapRange");
  }

  //split // split the change into two ranges if it's a replace change

  toJSON(): SerializedChange {
    return {
      range: this.unresolvedRange.toJSON(),
      modified: this.modified?.toJSON(),
    };
  }

  // TODO: Can't create a new range form existing range.anchor, as it's boundary is different, so map the range through previous change
  static fromMultiple(range: FlatRange, nodes: Node[]): Result<Change[], string> {
    const changes: Change[] = [];
    let pos = range.first.absolute;
    if (range.text !== null) {
      const singleRange = range.asNodeRange();
      if (singleRange.err) return singleRange.trace("Change.fromMultiple", "static");

      changes.push(new Change(singleRange.val));
      for (const n of nodes) {
        if (!n.type.schema.text)
          return Err("Can't insert non-text node into a text node", "Change.fromMultiple", "static");
        changes.push(new Change(new AbsoluteRange(range.first.absolute), n));
      }

      return Ok(changes);
    }

    for (const n of range.nodesBetween()) changes.push(new Change(new AbsoluteRange(pos, (pos += n.nodeSize))));
    for (const n of nodes) changes.push(new Change(new AbsoluteRange(range.first.absolute), n));
    return Ok(changes);
  }
}
