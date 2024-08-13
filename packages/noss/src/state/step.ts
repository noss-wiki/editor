import type { Node } from "../model/node";
import type { Result } from "@noss-editor/utils";

export type StepJSON = {
  stepId: string;
  [x: string]: unknown;
};

export abstract class Step {
  abstract id: string;
  /**
   * @returns If the Step succeeded return true, else return false
   */
  abstract apply(boundary: Node): Result<null | Node>;

  /* abstract toJSON(): StepJSON; */
}
