import type { MethodError, Result } from "@noss-editor/utils";
import type { Node, SerializedNode } from "../model/node";
import type { NodeRange, SerializedSingleNodeRange } from "../model/range";
import type { Serializable } from "../types";
import { SingleNodeRange } from "../model/range";
import { Position, type AbsoluteLike } from "../model/position";
import { Err, Ok, wrap } from "@noss-editor/utils";

// TODO: Remove this entirely or maybe include smth similar for easier change tracking? like what exactly change (attrs, content, etc.)
export enum ChangeType {
  insert = "insert",
  remove = "remove",
  replace = "replace",
}

export interface SerializedChange {
  readonly range: SerializedSingleNodeRange;
  readonly modified?: SerializedNode;
}

export class Change implements Serializable<SerializedChange> {
  constructor(
    readonly range: SingleNodeRange | AbsoluteLike,
    readonly modified?: Node,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    const isRange = this.range instanceof SingleNodeRange;
    const anchor = isRange ? Ok(this.range.anchor) : Position.resolve(boundary, this.range);
    if (anchor.err) return anchor.traceMessage("Failed to reconstruct Change", "Change.reconstruct");

    if (anchor.val.boundary !== boundary)
      return Err("The boundary of the range is different from the provided boundary", "Change.reconstruct");

    return (!isRange ? Ok(boundary) : removeRange(boundary, this.range)).try((mod) => {
      const modParent = anchor.val.parent.removeChild(anchor.val.index());
      return wrap(() => boundary.copy(boundary.content.replaceChildRecursive(anchor.val.parent, modParent)));
    });
  }

  /**
   * Maps a position through a change.
   *
   * @throws {MethodError} If `pos` is a {@link Position} and it cannot be resolved.
   */
  map<T extends AbsoluteLike>(pos: T): Result<T, string> {
    const absPos = typeof pos === "number" ? pos : pos.absolute;
    const isRange = this.range instanceof SingleNodeRange;
    const anchor = isRange ? this.range.anchor.absolute : Position.absolute(this.range);
    const size = isRange ? this.range.size : 0;
    let abs: number;
    if (absPos <= anchor) abs = absPos;
    else abs = absPos + size;

    if (typeof pos === "number") return Ok(abs as T);
    else return Position.resolve(pos.boundary, abs) as Result<T, string>;
  }

  //split // split the change into two ranges if it's a replace change

  toJSON(): SerializedChange {
    return {
      range: getSerializedRange(this.range),
      modified: this.modified?.toJSON(),
    };
  }

  static fromMultiple(range: NodeRange, nodes: Node[]): Result<Change[], string> {
    const boundary = range.anchor.boundary;
    const changes: Change[] = [];
    for (const n of range.nodesBetween()) {
      const singleRange = SingleNodeRange.select(boundary, n);
      if (singleRange.ok) changes.push(new Change(singleRange.val));
      else return singleRange.traceMessage("Failed to construct Change array", "Change.fromMultiple", "static");
    }

    for (const n of nodes) changes.push(new Change(new SingleNodeRange(range.anchor), n));
    return Ok(changes);
  }
}

function getSerializedRange(range: SingleNodeRange | AbsoluteLike): SerializedSingleNodeRange {
  return range instanceof SingleNodeRange
    ? range.toJSON()
    : {
        type: "single",
        anchor: Position.absolute(range),
        focus: Position.absolute(range),
      };
}

function removeRange(boundary: Node, range: SingleNodeRange) {
  const parent = range.anchor.parent;
  if (range.size === 0) return Ok(boundary);

  const node = parent.child(range.anchor.index());
  return wrap(() => boundary.copy(boundary.content.replaceChildRecursive(parent, parent.removeChild(node))));
}
