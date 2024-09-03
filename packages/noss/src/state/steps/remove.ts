import type { Node, Text } from "../../model/node";
import type { LocateData } from "../../model/position";
import { locateNode } from "../../model/position";
import type { Result } from "@noss-editor/utils";
import { Ok, Err, wrap } from "@noss-editor/utils";
import { Step } from "../step";

export class RemoveStep extends Step {
  readonly id = "remove";

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
          .try((node) => wrap(() => boundary.content.replaceChildRecursive(parent, node)))
          .map((c) => boundary.copy(c));
      });
  }
}

export class RemoveTextStep extends Step {
  readonly id = "removeText";

  private locate?: LocateData;

  readonly to: number;

  constructor(
    readonly node: Text,
    readonly from: number,
    to?: number,
  ) {
    super();
    this.to = to || node.text.length;
  }

  apply(boundary: Node): Result<Node, string> {
    if (this.from === 0 && this.to === this.node.text.length)
      return Err("Can't remove the entire text node, use RemoveStep instead");
    else if (this.from === this.to) return Ok(boundary);

    const node = this.node.remove(this.from, this.to);
    return wrap(() => boundary.content.replaceChildRecursive(this.node, node)) //
      .map((c) => boundary.copy(c));
  }

  override merge(other: Step): Result<Step, string> {
    if (!(other instanceof RemoveTextStep)) return Err("Other step is not a RemoveTextStep");
    else if (this.node !== other.node) return Err("Both steps must target the same text node");

    if (this.from > other.to || other.from > this.to) return Err("Steps don't overlap, apply steps seperately");

    const from = Math.min(this.from, other.from);
    const to = Math.max(this.to, other.to);
    if (from === 0 && to === this.node.text.length)
      return Err("Can't remove the entire text node, use RemoveStep instead");

    return Ok(new RemoveTextStep(this.node, from, to));
  }
}
