import type { Result } from "@noss-editor/utils";
import type { Node } from "../../model/node";
import type { NodeRange } from "../../model/range";
import { Err } from "@noss-editor/utils";
import { Step } from "../step";
import { Diff } from "../diff";
import { Change } from "../change";

export class ReplaceNodeStep extends Step {
  id = "replaceNode";

  constructor(
    /**
     * The start position in the document where to start replacing.
     */
    readonly range: NodeRange, // TODO: Also allow `AbsoluteLike`?
    /**
     * The end position in the document where to stop replacing.
     */
    readonly modified?: Node | Node[],
  ) {
    super();
  }

  apply(boundary: Node): Result<Diff, string> {
    if (this.range.anchor.boundary !== boundary)
      return Err("Range boundary is different from this step's boundary", "ReplaceNodeStep.apply");

    const nodes = this.modified === undefined ? [] : Array.isArray(this.modified) ? this.modified : [this.modified];
    const changes = Change.fromMultiple(this.range, nodes);
    return changes.map((c) => new Diff(boundary, c));
  }
}
