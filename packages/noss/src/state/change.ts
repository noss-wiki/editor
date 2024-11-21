import type { MethodError, Result } from "@noss-editor/utils";
import type { Node, SerializedNode } from "../model/node";
import type { NodeRange, Range, SerializedRange } from "../model/range";
import type { Serializable } from "../types";
import { SingleNodeRange, AbsoluteRange } from "../model/range";
import { Position, type AbsoluteLike } from "../model/position";
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
  readonly rangeIsCollapsed: boolean;
  public resolvedRange!: SingleNodeRange;

  constructor(
    readonly range: SingleNodeRange | AbsoluteRange,
    readonly modified?: Node,
  ) {
    this.rangeIsCollapsed = range instanceof SingleNodeRange ? range.isCollapsed : true;
  }

  reconstruct(boundary: Node): Result<Node, string> {
    const res = this.range.resolve(boundary).try((range) => range.toSingleNodeRange());
    if (res.err) return res.trace("Change.reconstruct");
    this.resolvedRange = res.val;

    if (this.resolvedRange.anchor.boundary !== boundary)
      return Err("The boundary of the range is different from the provided boundary", "Change.reconstruct");

    const parent = this.resolvedRange.anchor.parent;
    const index = this.resolvedRange.anchor.index();

    return wrap(() => {
      const mod = this.range.isCollapsed ? parent : parent.removeChild(index);
      const insert = !this.modified ? mod : mod.insertChild(this.modified, index);
      if (parent === boundary) return insert;
      else return boundary.copy(boundary.content.replaceChildRecursive(parent, insert));
    }).trace("Change.reconstruct");
  }

  /**
   * Maps a position through a change.
   *
   * @throws {MethodError} If `pos` is a {@link Position} and it cannot be resolved.
   */
  map<T extends AbsoluteLike>(pos: T): Result<T, string> {
    const absPos = typeof pos === "number" ? pos : pos.absolute;
    const anchor = Position.absolute(this.range.first);
    const size = this.range.size;
    let abs: number;
    if (absPos <= anchor) abs = absPos;
    else abs = absPos + size;

    if (typeof pos === "number") return Ok(abs as T);
    else return Position.resolve(pos.boundary, abs) as Result<T, string>;
  }

  mapRange<T extends Range | AbsoluteRange>(range: T): Result<T, string> {
    return this.map(range.anchor).try((anchor) =>
      this.map(range.focus).map((focus) => {
        if (typeof anchor === "number") return new AbsoluteRange(anchor, focus as number) as T;
        else return (range as Range).copy(anchor, focus as Position) as T;
      }),
    );
  }

  //split // split the change into two ranges if it's a replace change

  toJSON(): SerializedChange {
    return {
      range: this.range.toJSON(),
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
