import { MethodError } from "@noss-editor/utils";
import type { Node } from "../../model/node";
import type { LocateData } from "../../model/position";
import { locateNode } from "../../model/position";
import type { Result } from "@noss-editor/utils";
import { Ok, Err, wrap } from "@noss-editor/utils";
import { Step } from "../step";

export class RemoveStep extends Step {
  id = "remove";

  private locate?: LocateData;

  constructor(readonly node: Node) {
    super();
  }

  apply(boundary: Node): Result<Node, string> {
    return locateNode(boundary, this.node)
      .replaceErr("The given node couldn't be located in the boundary")
      .try((locate) => {
        this.locate = locate;

        const parent = this.locate.steps[this.locate.steps.length - 2].node;
        return wrap(() => parent.content.remove(this.node)).map((res) => {
          const node = parent.copy(res);
          const c = boundary.content.replaceChildRecursive(parent, node);
          return boundary.copy(c);
        });
      });
  }
}
