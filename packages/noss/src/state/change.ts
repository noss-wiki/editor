import type { Result } from "@noss-editor/utils";
import type { Node } from "../model/node";
import { Ok, wrap } from "@noss-editor/utils";

export type Change = InsertChange | RemoveChange | ReplaceChange;

export enum ChangeType {
  insert = "insert",
  remove = "remove",
  replace = "replace",
}

// TODO: Add function to map nodes between changes?
interface BaseChange {
  readonly type: ChangeType;
  readonly old?: Node;
  readonly modified?: Node;
  readonly oldParent?: Node;
  readonly modifiedParent?: Node;

  reconstruct(boundary: Node): Result<Node, string>;
}

export class InsertChange implements BaseChange {
  readonly type = ChangeType.insert;
  readonly old: undefined;

  constructor(
    readonly modified: Node,
    readonly oldParent: Node,
    readonly modifiedParent: Node,
    readonly index: number,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.oldParent === boundary)
      return wrap(() => boundary.content.insert(this.modified, this.index))
        .map((c) => boundary.copy(c))
        .trace("InsertChange.reconstruct");

    return wrap(() =>
      boundary.content.replaceChildRecursive(
        this.oldParent,
        this.oldParent.copy(this.oldParent.content.insert(this.modified, this.index)),
      ),
    )
      .map((c) => boundary.copy(c))
      .trace("InsertChange.reconstruct");
  }
}

export class RemoveChange implements BaseChange {
  readonly type = ChangeType.remove;
  readonly modified: undefined;

  constructor(
    readonly old: Node,
    readonly oldParent: Node,
    readonly modifiedParent: Node,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.oldParent === boundary)
      return wrap(() => boundary.content.remove(this.old))
        .map((c) => boundary.copy(c))
        .trace("RemoveChange.reconstruct");

    return wrap(() =>
      boundary.content.replaceChildRecursive(
        this.oldParent,
        this.oldParent.copy(this.oldParent.content.remove(this.old)),
      ),
    )
      .map((c) => boundary.copy(c))
      .trace("RemoveChange.reconstruct");
  }
}

export class ReplaceChange implements BaseChange {
  readonly type = ChangeType.replace;

  constructor(
    readonly old: Node,
    readonly modified: Node,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.old === boundary) return Ok(this.modified);
    return wrap(() => boundary.content.replaceChildRecursive(this.old, this.modified)) //
      .map((c) => boundary.copy(c))
      .trace("ReplaceChange.reconstruct");
  }
}
