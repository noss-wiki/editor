import type { MethodError, Result } from "@noss-editor/utils";
import type { Node, SerializedNode } from "../model/node";
import type { NodeRange, Range, SerializedRange } from "../model/range";
import type { Serializable } from "../types";
import { AbsoluteRange, SingleNodeRange } from "../model/range";
import { AnchorPosition, Position, type AbsoluteLike } from "../model/position";
import { Err, Ok, wrap } from "@noss-editor/utils";

// TODO: Remove this entirely or maybe include smth similar for easier change tracking? like what exactly change (attrs, content, etc.)
export enum ChangeType {
  insert = "insert",
  remove = "remove",
  replace = "replace",
}

export interface SerializedChange {
  readonly range: SerializedRange;
  readonly modified?: SerializedNode;
}

export class Change implements Serializable<SerializedChange> {
  public rangeIsCollapsed = false;
  public range!: SingleNodeRange;
  public mappedRange!: SingleNodeRange;

  constructor(range: SingleNodeRange | AbsoluteRange, modified?: Node);
  constructor(
    private unresolvedRange: SingleNodeRange | AbsoluteRange,
    readonly modified?: Node,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    const res = this.unresolvedRange.resolve(boundary).try((range) => range.toSingleNodeRange());
    if (res.err) return res.trace("Change.reconstruct");
    this.range = res.val;
    this.rangeIsCollapsed = this.range.isCollapsed;

    if (this.range.anchor.boundary !== boundary)
      return Err("The boundary of the range is different from the provided boundary", "Change.reconstruct");

    const parent = this.range.anchor.parent;
    const index = this.range.anchor.index();

    return wrap(() => {
      const mod = this.range.isCollapsed ? parent : parent.removeChild(index);
      const insert = !this.modified ? mod : mod.insertChild(this.modified, index);
      if (parent === boundary) return insert;
      else return boundary.copy(boundary.content.replaceChildRecursive(parent, insert));
    }).trace("Change.reconstruct");
  }

  reconstructRange(boundary: Node, modifiedBoundary: Node) {
    const res = Position.resolve(modifiedBoundary, this.range.first.absolute).try((first) => {
      if (!this.modified) return Ok(new SingleNodeRange(first));

      const lastAbs = this.range.last.absolute + (this.modified?.nodeSize ?? 0) - this.range.size;
      return Position.resolve(modifiedBoundary, lastAbs).map((last) => {
        if (this.range.first === this.range.anchor) return new SingleNodeRange(first, last);
        else return new SingleNodeRange(last, first);
      });
    });

    if (res.ok) this.mappedRange = res.val;
    return res;
  }

  /**
   * Maps a position through a change.
   */
  map(pos: number): Result<number, never>;
  map(pos: Position, modifiedBoundary: Node): Result<Position, string>;
  map<T extends AbsoluteLike>(pos: T, modifiedBoundary?: Node): Result<T, string> {
    const absPos = typeof pos === "number" ? pos : pos.absolute;
    const anchor = Position.absolute(this.unresolvedRange.first);
    let abs: number;
    if (absPos <= anchor) abs = absPos;
    else abs = absPos + this.unresolvedRange.size;

    if (typeof pos === "number") return Ok(abs as T);
    else return Position.resolve(modifiedBoundary as Node, abs) as Result<T, string>;
  }

  //split // split the change into two ranges if it's a replace change

  toJSON(): SerializedChange {
    return {
      range: this.unresolvedRange.toJSON(),
      modified: this.modified?.toJSON(),
    };
  }

  // TODO: Can't create a new range form existing range.anchor, as it's boundary is different, so map the range through previous change
  static fromMultiple(range: NodeRange, nodes: Node[]): Result<Change[], string> {
    const changes: Change[] = [];
    let pos = range.first.absolute;
    for (const n of range.nodesBetween()) changes.push(new Change(new AbsoluteRange(pos, (pos += n.nodeSize))));
    for (const n of nodes) changes.push(new Change(new AbsoluteRange(range.first.absolute), n));
    return Ok(changes);
  }
}
