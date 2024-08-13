import { MethodError } from "@noss-editor/utils";
import type { Node } from "../../model/node";
import type { LocateData } from "../../model/position";
import { locateNode } from "../../model/position";
import { Result, wrap } from "@noss-editor/utils";
import { Step } from "../step";

export class RemoveStep extends Step {
  id = "remove";

  private locate?: LocateData;

  constructor(readonly node: Node) {
    super();
  }

  apply(boundary: Node): Result<null | Node> {
    this.locate = locateNode(boundary, this.node);
    if (!this.locate) return Result.Error("The given node couldn't be located in the boundary");

    const parent = this.locate.steps[this.locate.steps.length - 2].node;
    const res = wrap(() => parent.content.remove(this.node)).unwrapToError();
    if (res instanceof MethodError) return Result.Error(res._message, res);

    const node = parent.copy(res);
    const c = boundary.content.replaceChildRecursive(parent, node);
    return Result.Ok(boundary.copy(c));
  }
}
