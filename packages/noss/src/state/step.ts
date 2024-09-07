import type { Node } from "../model/node";
import type { Diff } from "./diff";
import type { Result } from "@noss-editor/utils";
import { Err, wrap } from "@noss-editor/utils";

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
  abstract apply(boundary: Node): Result<Diff, string>;

  merge(other: Step): Result<Step, null | string> {
    return Err();
  }

  /* abstract toJSON(): StepJSON; */
}
