import type { Result } from "@noss-editor/utils";
import type { Node } from "../../model/node";
import type { Resolvable } from "../../types";
import { Err } from "@noss-editor/utils";
import { Step } from "../step";
import { Diff } from "../diff";
import { Change } from "../change";
import { NodeRange } from "../../model/range";

export class ReplaceNodeStep extends Step {
  id = "replaceNode";

  constructor(
    /**
     * The start position in the document where to start replacing.
     */
    readonly range: Resolvable<NodeRange>, // TODO: Also allow `AbsoluteLike`?
    /**
     * The end position in the document where to stop replacing.
     */
    readonly modified?: Node | Node[],
  ) {
    super();
  }

  apply(boundary: Node): Result<Diff, string> {
    const range = NodeRange.resolve(boundary, this.range);
    if (range.err) return range.trace("ReplaceNodeStep.apply");

    if (range.val.anchor.boundary !== boundary)
      return Err("Range boundary is different from this step's boundary", "ReplaceNodeStep.apply");

    const nodes = this.modified === undefined ? [] : Array.isArray(this.modified) ? this.modified : [this.modified];
    const changes = Change.fromMultiple(range.val, nodes);
    return changes.map((c) => new Diff(boundary, c));
  }
}
