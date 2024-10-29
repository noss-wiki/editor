import type { Result } from "@noss-editor/utils";
import type { Node } from "../model/node";
import { Position, type AbsoluteLike } from "../model/position";
import type { NodeRange } from "../model/range";
import { MethodError, Ok, wrap } from "@noss-editor/utils";

export type Change = InsertChange | RemoveChange | ReplaceChange;

export enum ChangeType {
  insert = "insert",
  remove = "remove",
  replace = "replace",
}

// TODO: Add changeNodes map? for easier access to the nodes that are changed. this is just the nodes of the range position steps.
// TODO: Allow to insert multiple nodes on `InsertChange` and `ReplaceChange`.
interface BaseChange {
  readonly type: ChangeType;
  readonly modified?: Node;
  /**
   * The range where to apply the change, so this range is in the old document.
   * In the case of the `RemoveChange` and the `ReplaceChange` will the nodes in this range be removed.
   */
  readonly range: NodeRange;

  reconstruct(boundary: Node): Result<Node, string>;
  map<T extends AbsoluteLike>(pos: T): Result<T, string>;
}

export class InsertChange implements BaseChange {
  readonly type = ChangeType.insert;
  readonly old: undefined;

  constructor(
    readonly range: NodeRange,
    readonly modified: Node,
  ) {
    if (!range.isCollapsed)
      throw new MethodError("Range is not collapsed, but this is needed", "InsertChange.constructor");
  }

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.range.parent === boundary)
      return wrap(() => boundary.content.insert(this.modified, this.range.anchor.index()))
        .map((c) => boundary.copy(c))
        .trace("InsertChange.reconstruct");

    return wrap(() =>
      boundary.content.replaceChildRecursive(
        this.range.parent,
        this.range.parent.copy(this.range.parent.content.insert(this.modified, this.range.anchor.index())),
      ),
    )
      .map((c) => boundary.copy(c))
      .trace("InsertChange.reconstruct");
  }

  map<T extends AbsoluteLike>(pos: T): Result<T, string> {
    const absPos = typeof pos === "number" ? pos : pos.absolute;
    let abs: number;
    if (absPos <= this.range.anchor.absolute) abs = absPos;
    else abs = absPos + this.range.size;

    if (typeof pos === "number") return Ok(abs as T);
    else return Position.resolve(pos.boundary, abs) as Result<T, string>;
  }
}

export class RemoveChange implements BaseChange {
  readonly type = ChangeType.remove;
  readonly modified: undefined;

  constructor(readonly range: NodeRange) {}

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.range.parent === boundary)
      return wrap(() => boundary.content.remove(this.range.nodesBetween()))
        .map((c) => boundary.copy(c))
        .trace("RemoveChange.reconstruct");

    return wrap(() =>
      boundary.content.replaceChildRecursive(
        this.range.parent,
        this.range.parent.copy(this.range.parent.content.remove(this.range.nodesBetween())),
      ),
    )
      .map((c) => boundary.copy(c))
      .trace("RemoveChange.reconstruct");
  }

  map<T extends AbsoluteLike>(pos: T): Result<T, string> {
    const absPos = typeof pos === "number" ? pos : pos.absolute;
    let abs: number;
    if (absPos <= this.range.first.absolute) abs = absPos;
    else abs = absPos - this.range.size;

    if (typeof pos === "number") return Ok(abs as T);
    else return Position.resolve(pos.boundary, abs) as Result<T, string>;
  }
}

export class ReplaceChange implements BaseChange {
  readonly type = ChangeType.replace;

  constructor(
    readonly range: NodeRange,
    readonly modified: Node,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.range.parent === boundary)
      return wrap(() =>
        boundary.content //
          .remove(this.range.nodesBetween())
          .insert(this.modified, this.range.first.index()),
      )
        .map((c) => boundary.copy(c))
        .trace("ReplaceChange.reconstruct");

    return wrap(() =>
      boundary.content.replaceChildRecursive(
        this.range.parent,
        this.range.parent.copy(
          this.range.parent.content //
            .remove(this.range.nodesBetween())
            .insert(this.modified, this.range.first.index()),
        ),
      ),
    )
      .map((c) => boundary.copy(c))
      .trace("ReplaceChange.reconstruct");
  }

  map<T extends AbsoluteLike>(pos: T): Result<T, string> {
    const absPos = typeof pos === "number" ? pos : pos.absolute;
    let abs: number;
    if (absPos <= this.range.first.absolute) abs = absPos;
    else abs = absPos - this.range.size + this.modified.nodeSize;

    if (typeof pos === "number") return Ok(abs as T);
    else return Position.resolve(pos.boundary, abs) as Result<T, string>;
  }
}
