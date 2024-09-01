import type { Node } from "../model/node";
import type { Result } from "@noss-editor/utils";
import { Err } from "@noss-editor/utils";

export type StepJSON = {
  stepId: string;
  [x: string]: unknown;
};

// TODO: implement method to register custom steps
//       and to get the step corresponding to a given id.
export abstract class Step {
  abstract readonly id: string;
  /**
   * @returns A result containing the new boundary node or an error message.
   */
  abstract apply(boundary: Node): Result<Node, string>;

  merge(other: Step): Result<Step, null> {
    return Err();
  }

  /* abstract toJSON(): StepJSON; */
}
