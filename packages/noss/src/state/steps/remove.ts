import type { Node, Text } from "../../model/node";
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
        return wrap(() => parent.removeChild(this.node)) //
          .map((node) => {
            const c = boundary.content.replaceChildRecursive(parent, node);
            return boundary.copy(c);
          });
      });
  }
}

export class RemoveTextStep extends Step {
  id = "removeText";

  private locate?: LocateData;

  constructor(
    readonly node: Text,
    readonly content: string,
  ) {
    super();
  }

  apply(boundary: Node): Result<Node, string> {
    if (!this.node.text.includes(this.content))
      return Err(`Can't remove string ${this.content}, from text node with content ${this.node.content}`);

    const node = this.node.copy(this.node.text.replace(this.content, ""));
    return wrap(() => boundary.content.replaceChildRecursive(this.node, node)) //
      .map((c) => boundary.copy(c));
  }
}
