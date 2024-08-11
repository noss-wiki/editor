import type { Node } from "../model/node";
import type { Result } from "../result";

export type StepJSON = {
  stepId: string;
  [x: string]: unknown;
};

export abstract class Step {
  abstract id: string;
  // TODO: Improve results maybe? to be a bit more descriptive
  /**
   * @returns If the Step succeeded return true, else return false
   */
  abstract apply(boundary: Node): Result<unknown>;

  /**
   * Tries to undo the step done by the `apply` hook,
   * the current state needs to be the same as the state created by the `apply` hook.
   * For example the inserted node needs to be at the same position to undo succesfully.
   */
  abstract undo(boundary: Node): boolean;

  /* abstract toJSON(): StepJSON; */
}
