import type { Node } from "../model/node";
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
   * @internal
   */
  public hints: { old: Node; replacement: Node }[] = [];

  /**
   * @returns A result containing the new boundary node or an error message.
   */
  abstract apply(boundary: Node): Result<Node, string>;

  merge(other: Step): Result<Step, null | string> {
    return Err();
  }

  // Hint methods

  /**
   * Calls boundary.replaceChildRecursive and boundary.copy with its result while wrapping the functions and returning a result,
   * while also hinting the replace algorithm which nodes changed.
   * Only use these methods if nothing else changes, as when calling hint methods, the document won't be analyzed.
   *
   * The method body is as follows:
```ts
return wrap(() => boundary.content.replaceChildRecursive(child, node)) //
  .map((c) => boundary.copy(c));
```
   */
  hintReplaceChildRecursive(boundary: Node, child: Node, node: Node): Result<Node, string> {
    this.hints.push({ old: child, replacement: node });
    return wrap(() => boundary.content.replaceChildRecursive(child, node)) //
      .map((c) => boundary.copy(c));
  }

  /* abstract toJSON(): StepJSON; */
}
