import { useLazyMemo } from "@noss-editor/utils";
import { Fragment } from "./fragment";

export class Slice {
  readonly size: number;

  constructor(
    readonly content: Fragment,
    readonly startDepth: number,
    readonly endDepth: number,
  ) {
    this.size = this.content.size - this.startDepth - this.endDepth;
  }

  static get empty() {
    return useLazyMemo(() => new Slice(Fragment.empty, 0, 0)).val;
  }
}
