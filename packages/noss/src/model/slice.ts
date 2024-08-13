import type { Node } from "./node";
import type { PositionLike } from "./position";
import { Position } from "./position";
import { Fragment } from "./fragment";
import { MethodError } from "@noss-editor/utils";

export class Slice {
  /**
   * @param content The content of this slice
   * @param openStart The depth in the content at the start where the slice starts
   * @param openEnd The depth in the content at the end where the slice ends
   * @param boundary The boundary the content originated from, leave empty if this slice is not part of a boundary
   */
  constructor(
    readonly content: Fragment,
    readonly openStart: number,
    readonly openEnd: number,
    readonly boundary?: Node,
  ) {
    if (this.content.size === 0 && (this.openStart > 0 || this.openEnd > 0)) this.openStart = this.openEnd = 0;
  }

  get size() {
    return this.content.size - this.openStart - this.openEnd;
  }

  eq(other: Slice) {
    return this.content.eq(other.content) && this.openStart === other.openStart && this.openEnd === other.openEnd;
  }

  insert(pos: number, insert: Fragment | Node[] | Node /*, parent?: Node */) {
    const res = insertFragment(this.content, pos, insert);
    if (!res) throw new MethodError("Failed to insert content into slice", "Slice.insert");
  }

  remove(from: number, to: number) {
    // TODO: Verify if content is allowed before removing
  }

  // static methods
  static between(from: Position, to: Position) {
    // TODO: Improve performance here (get depth of common parent and use .start and .end methods on position to get offsets)
    const cDepth = from.commonDepth(to);

    const cut = from.node(cDepth).copy();
    if (!cut.content.cut(from.relative(cDepth) + 1, to.relative(cDepth) - 1)) return;

    return new Slice(cut.content, from.depth, to.depth, from.boundary);
  }

  static get empty() {
    return new Slice(new Fragment([]), 0, 0);
  }
}

function insertFragment(
  parent: Fragment,
  pos: number,
  insert: Fragment | Node[] | Node,
  /*, parent?: Node */
) {
  // TODO: Verify if content is allowed before inserting
  // TODO: Re-implement this method
  const { index, offset } = Position.offsetToIndex(parent, pos, true);
  const node = parent.child(index);
  //if (empty) return parent;
  if (offset === 0) return parent.insert(insert, index);
  else if (node.text !== null) return;
  else return insertFragment(node.content, offset, insert);
}
