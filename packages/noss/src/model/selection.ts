import type { Result } from "@noss-editor/utils";
import type { Node } from "./node";
import type { PositionLike } from "./position";
import { Position } from "./position";
import { Ok } from "@noss-editor/utils";

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

  static collapsed(pos: Position): Selection;
  static collapsed(pos: PositionLike): UnresolvedSelection;
  static collapsed(pos: PositionLike) {
    if (pos instanceof Position) return new Selection(pos, pos);
    return new UnresolvedSelection(pos, pos);
  }

  static atStart(node: Node, offset?: number): Result<UnresolvedSelection, string>;
  static atStart(node: Node, offset: number | undefined, boundary: Node): Result<Selection, string>;
  static atStart(node: Node, offset?: number, boundary?: Node): Result<Selection | UnresolvedSelection, string> {
    const pos = Position.offset(node, offset ?? 0);
    if (boundary) return pos.resolve(boundary).map((p) => new Selection(p, p));
    return Ok(new UnresolvedSelection(pos, pos));
  }

  static atEnd(node: Node, offset?: number): Result<UnresolvedSelection, string>;
  static atEnd(node: Node, offset: number | undefined, boundary: Node): Result<Selection, string>;
  static atEnd(node: Node, offset?: number, boundary?: Node): Result<Selection | UnresolvedSelection, string> {
    const pos = Position.offset(node, node.content.size - (offset ?? 0));
    if (boundary) return pos.resolve(boundary).map((p) => new Selection(p, p));
    return Ok(new UnresolvedSelection(pos, pos));
  }
}

export class UnresolvedSelection {
  constructor(
    readonly anchor: PositionLike,
    readonly focus: PositionLike,
  ) {}

  resolve(boundary: Node): Result<Selection, string> {
    return Position.softResolve(boundary, this.anchor)
      .mapErr((e) => `Failed to resolve anchor position; ${e}`)
      .try((anchor) =>
        Position.softResolve(boundary, this.focus)
          .mapErr((e) => `Failed to resolve focus position; ${e}`)
          .map((focus) => new Selection(anchor, focus)),
      )
      .trace("UnresolvedSelection.resolve", "static");
  }
}

export class Range {
  constructor(
    readonly start: Position,
    readonly end: Position,
  ) {}
}
