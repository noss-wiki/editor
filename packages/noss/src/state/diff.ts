import type { Result } from "@noss-editor/utils";
import type { Node } from "../model/node";
import { Ok, Err, wrap } from "@noss-editor/utils";
import { getParentNode } from "../model/position";

/**
 * Represents a single change to a node.
 */
export type Change =
  | {
      old: undefined;
      modified: Node;
      type: ChangeType.insert;
      kind: ChangeKind;
    }
  | {
      old: Node;
      modified: undefined;
      type: ChangeType.remove;
      kind: ChangeKind;
    }
  | {
      old: Node;
      modified: Node;
      type: ChangeType.replace;
      kind: ChangeKind;
    };

export enum ChangeType {
  insert = "insert",
  remove = "remove",
  replace = "replace",
}

export enum ChangeKind {
  /**
   * Changes to a Node's attributes
   */
  attrs = "attrs",
  /**
   * Changes to a Node's content and/or attributes, this also includes changes to the text of a Text node.
   */
  content = "content",
  /**
   * Changes to a Node related to views, this is currently unused, but is usefull for when ignoring updates to views itself.
   */
  view = "view",
}

export class Diff {
  readonly empty: boolean;
  private _modified?: Result<Node, string>;

  get modified() {
    return this._modified ?? (this._modified = this.reconstruct());
  }

  constructor(
    readonly boundary: Node,
    readonly changes: Change[],
  ) {
    this.empty = this.changes.length === 0;
  }

  /**
   * Merges this diff with another diff.
   * @param other The diff to merge with, that diff needs to be directly based on the result of this diff to succeed.
   * @returns A Result containing the merged diff or an error message.
   */
  merge(other: Diff): Result<Diff, string> {
    if (this.boundary !== other.boundary) return Err("Cannot merge Diffs with different boundaries");

    if (this.empty) return Ok(other);
    else if (other.empty) return Ok(this);
    else return Ok(new Diff(this.boundary, [...this.changes, ...other.changes]));
  }

  private reconstruct(): Result<Node, string> {
    if (this.empty) return Ok(this.boundary);
    let last = this.boundary;
    for (const change of this.changes) {
      const res = this.reconstructChange(last, change);
      if (res.ok) last = res.val;
      else return res;
    }
    return Ok(last);
  }

  private reconstructChange(boundary: Node, change: Change): Result<Node, string> {
    if (change.type === ChangeType.replace) {
      if (change.kind === ChangeKind.content) {
        return wrap(() => boundary.content.replaceChildRecursive(change.old, change.modified)) //
          .map((c) => boundary.copy(c));
      }
    }
    return Err("Case not implemented");
  }

  // static initializers

  static none(boundary: Node) {
    return new Diff(boundary, []);
  }

  /**
   * Creates a diff that replaces `child` with `modified` in the given `boundary`.
   * This behaviour is that same as `Node.content.replaceChildRecursive`.
   *
   * @returns A Result containing the diff or an error if the child is not found in the boundary.
   */
  static replaceChild(boundary: Node, child: Node, modified: Node): Result<Diff, string> {
    if (!boundary.content.contains(child)) return Err("Boundary does not contain the specified child");
    // parent node has changed

    return Ok(
      new Diff(boundary, [
        {
          old: child,
          modified,
          type: ChangeType.replace,
          kind: ChangeKind.content,
        },
      ]),
    );
  }
}
