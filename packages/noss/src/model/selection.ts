import type { Node } from "./node";
import type { Position } from "./position";

// TODO: Make immutable
export class Selection {
  get isCollapsed() {
    // Check if same instance, or if it resolves to same position
    return this.anchor === this.focus || this.anchor.toAbsolute() === this.focus.toAbsolute();
  }

  constructor(
    /**
     * The position of the selection's anchor, this is the part that can't be moved.
     */
    readonly anchor: Position,
    /**
     * The position of the selection's anchor, this is the part that can be moved.
     */
    readonly focus: Position,
  ) {}

  /**
   * Create a new collapsed selection based off this one,
   * if no arguments are provided the selection is collapsed at the position of the focus (the part that can be moved).
   */
  collapse(pos?: Position) {
    return Selection.collapsed(pos || this.focus);
  }

  static collapsed(pos: Position) {
    return new Selection(pos, pos);
  }
}

export class Range {
  constructor(
    readonly start: Position,
    readonly end: Position,
  ) {}
}
