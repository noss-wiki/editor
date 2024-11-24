import type { Result } from "@noss-editor/utils";
import type { Node } from "../model/node";
import type { Change } from "./change";
import { Ok, Err } from "@noss-editor/utils";

export class Diff {
  readonly empty: boolean;
  readonly modified: Result<Node, string>;

  constructor(
    readonly boundary: Node,
    readonly changes: Change[],
    modifiedBoundary?: Node,
  ) {
    this.empty = this.changes.length === 0;
    this.modified = modifiedBoundary ? Ok(modifiedBoundary) : this.reconstruct();
  }

  /**
   * Merges this diff with another diff.
   * @param other The diff to merge with, that diff needs to be directly based on the result of this diff to succeed.
   * @returns A Result containing the merged diff or an error message.
   */
  merge(other: Diff): Result<Diff, string> {
    // TODO: Check if changes overlap before merging
    if (this.empty) return Ok(other);
    else if (other.empty) return Ok(this);
    else return Ok(new Diff(this.boundary, [...this.changes, ...other.changes]));
  }

  private reconstruct(): Result<Node, string> {
    if (this.empty) return Ok(this.boundary);
    let last = this.boundary;
    for (const change of this.changes) {
      const res = change.reconstruct(last);
      if (res.ok) {
        last = res.val;
        change.reconstructRange(last);
      } else return res.trace("Diff.reconstruct", "private");
    }
    return Ok(last);
  }

  // static initializers

  static none(boundary: Node) {
    return new Diff(boundary, []);
  }

  // // TODO: Add diff method where old or modified can be undefined
  // static diff(boundary: Node, old: Node, modified: Node, modifiedBoundary?: Node): Result<Diff, string> {
  //   if (!old.eq(modified, true)) return Ok(new Diff(boundary, [new ReplaceChange(old, modified)], modifiedBoundary));

  //   return compareContents(old, modified)
  //     .map((c) => new Diff(boundary, c, modifiedBoundary))
  //     .trace("Diff.diff", "static");
  // }

  // static diffBoundary(oldBoundary: Node, modifiedBoundary: Node): Result<Diff, string> {
  //   return Diff.diff(oldBoundary, oldBoundary, modifiedBoundary).trace("Diff.diffBoundary");
  // }

  // /**
  //  * Creates a diff that replaces `child` with `modified` in the given `boundary`.
  //  * This behaviour is that same as `Node.content.replaceChildRecursive`.
  //  *
  //  * @returns A Result containing the diff or an error if the child is not found in the boundary.
  //  */
  // static replaceChild(boundary: Node, child: Node, modified: Node): Result<Diff, string> {
  //   if (boundary === child)
  //     return Diff.diff(boundary, boundary, modified, modified).trace("Diff.replaceChild", "static");
  //   else if (!boundary.content.contains(child))
  //     return Err("Boundary does not contain the specified child", "Diff.replaceChild", "static");

  //   const mod = boundary.copy(boundary.content.replaceChildRecursive(child, modified));
  //   return Diff.diff(boundary, boundary, mod).trace("Diff.replaceChild", "static");
  // }
}

// /**
//  * Comapres two nodes and returns a list of changes between them.
//  */
// export function compareNodes(
//   old: Node | undefined,
//   modified: Node | undefined,
//   oldParent: Node,
//   modifiedParent: Node,
// ): Result<Change[], string> {
//   if (!old && !modified) return Ok([]);
//   // simple cases
//   if (!old && modified) {
//     const index = modifiedParent.content.nodes.indexOf(modified);
//     if (index === -1) return Err("Failed to get index of modified node", "compareNodes");
//     return Ok([new InsertChange(modified, oldParent, modifiedParent, index)]);
//   } else if (old && !modified) return Ok([new RemoveChange(old, oldParent, modifiedParent)]);
//   else if (!old || !modified || old.eq(modified)) return Ok([]);

//   const nodeEq = old.eq(modified, true);
//   // text nodes
//   if (old.type.schema.text)
//     if (old.text === modified.text && nodeEq) return Ok([]);
//     else return Ok([new ReplaceChange(old, modified)]);

//   if (!nodeEq) return Ok([new ReplaceChange(old, modified)]);

//   // non-text nodes
//   return compareContents(old, modified).trace("compareNodes");
// }

// interface LCSItem {
//   old: Node;
//   modified: Node;
// }

// function compareContents(old: Node, modified: Node): Result<Change[], string> {
//   return constructLcs(old.content.nodes, modified.content.nodes)
//     .replaceErr("Failed to calculate the longest common subsequence.")
//     .try((lcs) => {
//       const oldIndices = lcs.map((l) => old.content.nodes.indexOf(l.old));
//       const modifiedIndices = lcs.map((l) => modified.content.nodes.indexOf(l.modified));
//       const changes: Change[] = [];

//       for (const [c, i] of old.content.iter())
//         if (!oldIndices.includes(i)) changes.push(new RemoveChange(c, old, modified));

//       for (const [c, i] of modified.content.iter())
//         if (!modifiedIndices.includes(i)) changes.push(new InsertChange(c, old, modified, i));

//       for (const l of lcs) {
//         const res = compareNodes(l.old, l.modified, old, modified);
//         if (res.err) return res;
//         changes.push(...res.val);
//       }

//       return Ok(changes);
//     })
//     .trace("compareContents");
// }

// function constructLcs(oldNodes: Node[], newNodes: Node[]): Result<LCSItem[], null> {
//   // Construct lcs matrix (new on top, old on left)
//   const matrix: number[][] = [];
//   for (let o = 0; o <= oldNodes.length; o++) {
//     matrix[o] = [];
//     for (let n = 0; n <= newNodes.length; n++) {
//       // fill the top and left edges with 0
//       if (o === 0 || n === 0) matrix[o][n] = 0;
//       // if the nodes are equal, increment the diagonal value
//       else if (oldNodes[o - 1].strictEq(newNodes[n - 1], true)) matrix[o][n] = matrix[o - 1][n - 1] + 1;
//       // otherwise, take the maximum of the top and left values
//       else matrix[o][n] = Math.max(matrix[o - 1][n], matrix[o][n - 1]);
//     }
//   }

//   // Backtrack to find the longest common subsequence
//   const common: LCSItem[] = [];
//   let o = matrix.length - 1;
//   let n = matrix[0].length - 1;
//   for (;;) {
//     // check if we can go left (left value is same as current value)
//     if (n > 0 && matrix[o][n] === matrix[o][n - 1]) n--;
//     else if (o > 0 && matrix[o][n] === matrix[o - 1][n]) o--;
//     else if (o > 0 && n > 0 && matrix[o][n] === matrix[o - 1][n - 1] + 1) {
//       common.unshift({ old: oldNodes[o - 1], modified: newNodes[n - 1] });
//       o--;
//       n--;
//     } else if (o === 0 || n === 0) break;
//     else return Err();
//   }

//   return Ok(common);
// }
