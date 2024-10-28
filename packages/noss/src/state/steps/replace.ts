import type { Result } from "@noss-editor/utils";
import type { Node } from "../../model/node";
import { Step } from "../step";
import { Diff } from "../diff";

export class ReplaceNodeStep extends Step {
  id = "replaceNode";

  constructor(
    /**
     * The start position in the document where to start replacing.
     */
    readonly old: Node,
    /**
     * The end position in the document where to stop replacing.
     */
    readonly modified: Node,
  ) {
    super();
  }

  apply(boundary: Node): Result<Diff, string> {
    return Diff.replaceChild(boundary, this.old, this.modified).trace("ReplaceNodeStep.apply");
  }
}
