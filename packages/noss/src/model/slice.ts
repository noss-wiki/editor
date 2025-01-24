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

  private static emptySlice: Slice | undefined;
  static get empty() {
    if (!Slice.emptySlice) Slice.emptySlice = new Slice(Fragment.empty, 0, 0);

    return Slice.emptySlice;
  }
}
