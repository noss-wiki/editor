import type { Node, Text } from "../../model/node";
import type { LocateData } from "../../model/position";
import { locateNode } from "../../model/position";
import type { Result } from "@noss-editor/utils";
import { Ok, Err, wrap } from "@noss-editor/utils";
import { Step } from "../step";
import { Diff } from "../diff";

export class RemoveStep extends Step {
  readonly id = "remove";

  private locate?: LocateData;

  constructor(readonly node: Node) {
    super();
  }

  apply(boundary: Node): Result<Diff, string> {
    return locateNode(boundary, this.node)
      .replaceErr("The given node couldn't be located in the boundary")
      .try((locate) => {
        this.locate = locate;

        const parent = this.locate.steps[this.locate.steps.length - 2].node;
        const node = parent.removeChild(this.node);

        return Diff.replaceChild(boundary, parent, node);
      })
      .trace("RemoveStep.apply");
  }
}

export class RemoveTextStep extends Step {
  readonly id = "removeText";

  readonly to: number;

  constructor(
    readonly node: Text,
    readonly from: number,
    to?: number,
  ) {
    super();
    this.to = to || node.text.length;
  }

  apply(boundary: Node): Result<Diff, string> {
    if (this.from === 0 && this.to === this.node.text.length)
      return Err("Can't remove the entire text node, use RemoveStep instead", "RemoveTextStep.apply");
    else if (this.from === this.to) return Ok(Diff.none(boundary));

    const node = this.node.remove(this.from, this.to);
    return Diff.replaceChild(boundary, this.node, node).trace("RemoveTextStep.apply");
  }

  override merge(other: Step): Result<Step, string> {
    if (!(other instanceof RemoveTextStep)) return Err("Other step is not a RemoveTextStep", "RemoveTextStep.merge");
    else if (this.node !== other.node) return Err("Both steps must target the same text node", "RemoveTextStep.merge");

    if (this.from > other.to || other.from > this.to)
      return Err("Steps don't overlap, apply steps seperately", "RemoveTextStep.merge");

    const from = Math.min(this.from, other.from);
    const to = Math.max(this.to, other.to);
    if (from === 0 && to === this.node.text.length)
      return Err("Can't remove the entire text node, use RemoveStep instead", "RemoveTextStep.merge");

    return Ok(new RemoveTextStep(this.node, from, to));
  }
}
