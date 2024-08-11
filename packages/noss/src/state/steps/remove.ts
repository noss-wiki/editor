import type { Node } from "../../model/node";
import type { LocateData } from "../../model/position";
import { locateNode } from "../../model/position";
import { Step } from "../step";

export class RemoveStep extends Step {
  id = "remove";

  private locate?: LocateData;

  constructor(readonly node: Node) {
    super();
  }

  apply(boundary: Node) {
    this.locate = locateNode(boundary, this.node);
    if (!this.locate) return false;

    const parent = this.locate.steps[this.locate.steps.length - 2].node;

    //return parent.content.remove(this.node);
    return false;
  }

  undo(boundary: Node): boolean {
    if (!this.locate || this.locate.boundary !== boundary) return false;

    const parent = this.locate.steps[this.locate.steps.length - 2].node;

    /* return parent.content.insert(
      this.node,
      this.locate.steps[this.locate.steps.length - 1].index
    ); */
    return false;
  }
}
