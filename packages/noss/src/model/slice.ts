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

  static readonly empty = new Slice(Fragment.empty, 0, 0);
}
