import type { Result } from "@noss-editor/utils";
import type { Node } from "./node";
import type { Resolvable, Resolver } from "../types";
import { Range } from "./range";
import { Err, Ok } from "@noss-editor/utils";

export class Selection {
  declare readonly __resolvable?: Resolvable<Range>;

  readonly ranges: Range[];
  readonly empty: boolean;

  constructor(ranges: Range | Range[]) {
    this.ranges = Array.isArray(ranges) ? ranges : [ranges];
    this.empty = this.ranges.length === 0;
  }

  static resolve: Resolver<Selection> = (boundary, sel) => {
    if (sel instanceof Selection) return Ok(sel);
    else if (Range.resolvable(sel)) return Range.resolve(boundary, sel).map((range) => new Selection(range));
    //
    return Err("");
  };

  static empty = new Selection([]);
}
