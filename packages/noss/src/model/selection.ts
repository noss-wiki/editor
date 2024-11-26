import type { Result } from "@noss-editor/utils";
import type { Node } from "./node";
import type { PositionLike } from "./position";
import type { Range } from "./range";
import { AnchorPosition, Position } from "./position";
import { Ok } from "@noss-editor/utils";

export class Selection {
  readonly ranges: Range[];
  readonly empty: boolean;

  constructor(ranges: Range | Range[]) {
    this.ranges = Array.isArray(ranges) ? ranges : [ranges];
    this.empty = this.ranges.length === 0;
  }

  static empty = new Selection([]);
}
