import type { Node } from "../model/node";
import type { Result } from "@noss-editor/utils";

export type StepJSON = {
  stepId: string;
  [x: string]: unknown;
};

// TODO: implement method to register custom steps
//       and to get the step corresponding to a given id.
export abstract class Step {
  abstract id: string;
  /**
   * @returns If the Step succeeded return true, else return false
   */
  abstract apply(boundary: Node): Result<Node, string>;

  /* abstract toJSON(): StepJSON; */
}
