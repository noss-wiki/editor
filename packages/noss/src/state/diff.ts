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
    }
  | {
      old: Node;
      modified: undefined;
      type: ChangeType.remove;
    }
  | {
      old: Node;
      modified: Node;
      type: ChangeType.replace;
    };

export enum ChangeType {
  insert = "insert",
  remove = "remove",
  replace = "replace",
}

enum ChangeKind {
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
      return wrap(() => boundary.content.replaceChildRecursive(change.old, change.modified)) //
        .map((c) => boundary.copy(c));
    }
    return Err("Case not implemented");
  }

  // static initializers

  static none(boundary: Node) {
    return new Diff(boundary, []);
  }

  static diff(boundary: Node, old?: Node, modified?: Node): Result<Diff, string> {
    return compareNodes(old, modified).map((c) => new Diff(boundary, c));
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
    const mod = boundary.copy(boundary.content.replaceChildRecursive(child, modified));
    return Diff.diff(boundary, boundary, mod);
  }
}

/**
 * Comapres two nodes and returns a list of changes between them.
 */
export function compareNodes(old?: Node, modified?: Node): Result<Change[], string> {
  if (!old && !modified) return Ok([]);
  // simple cases
  if (!old && modified) return Ok([<Change>{ old, modified, type: ChangeType.insert }]);
  else if (old && !modified) return Ok([<Change>{ old, modified, type: ChangeType.remove }]);
  else if (!old || !modified || old.eq(modified)) return Ok([]);

  const nodeEq = old.eq(modified, true);
  // text nodes
  if (old.type.schema.text)
    if (old.text === modified.text && nodeEq) return Ok([]);
    else return Ok([<Change>{ old, modified, type: ChangeType.replace }]);

  if (!nodeEq) return Ok([<Change>{ old, modified, type: ChangeType.replace }]);

  // non-text nodes
  return constructLcs(old.content.nodes, modified.content.nodes)
    .replaceErr("Failed to construct calculate the longest common subsequence.")
    .try((lcs) => {
      const oldIndices = lcs.map((l) => old.content.nodes.indexOf(l.old));
      const modifiedIndices = lcs.map((l) => modified.content.nodes.indexOf(l.modified));
      const changes: Change[] = [];

      for (const [c, i] of old.content.iter())
        if (!oldIndices.includes(i)) changes.push({ old: c, modified: undefined, type: ChangeType.remove });

      for (const [c, i] of modified.content.iter())
        if (!modifiedIndices.includes(i)) changes.push({ old: undefined, modified: c, type: ChangeType.insert });

      for (const l of lcs) {
        const res = compareNodes(l.old, l.modified);
        if (res.err) return res;
        changes.push(...res.val);
      }

      return Ok(changes);
    });
}

interface LCSItem {
  old: Node;
  modified: Node;
}

function constructLcs(oldNodes: Node[], newNodes: Node[]): Result<LCSItem[], null> {
  // Construct lcs matrix (new on top, old on left)
  const matrix: number[][] = [];
  for (let o = 0; o <= oldNodes.length; o++) {
    matrix[o] = [];
    for (let n = 0; n <= newNodes.length; n++) {
      // fill the top and left edges with 0
      if (o === 0 || n === 0) matrix[o][n] = 0;
      // if the nodes are equal, increment the diagonal value
      else if (oldNodes[o - 1].eq(newNodes[n - 1], true)) matrix[o][n] = matrix[o - 1][n - 1] + 1;
      // otherwise, take the maximum of the top and left values
      else matrix[o][n] = Math.max(matrix[o - 1][n], matrix[o][n - 1]);
    }
  }

  // Backtrack to find the longest common subsequence
  const common: LCSItem[] = [];
  let o = matrix.length - 1;
  let n = matrix[0].length - 1;
  for (;;) {
    // check if we can go left (left value is same as current value)
    if (o > 0 && matrix[o][n] === matrix[o][n - 1]) n--;
    else if (n > 0 && matrix[o][n] === matrix[o - 1][n]) o--;
    else if (o > 0 && n > 0 && matrix[o][n] === matrix[o - 1][n - 1] + 1) {
      common.unshift({ old: oldNodes[o - 1], modified: newNodes[n - 1] });
      o--;
      n--;
    } else if (o === 0 || n === 0) break;
    else return Err();
  }

  return Ok(common);
}
