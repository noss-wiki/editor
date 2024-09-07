import type { Position, PositionLike } from "./position";
import type { Node, Text } from "./node";
import type { EditorState } from "../state";
import type { Diff } from "../state/diff";

/**
 * A generic view where `T` represents what is rendered; what the render hook returns.
 * E.g. when defining a view for a web targeted platform `T` would be `HTMLElement` (or better `HTMLElement | Text`).
 */
export interface View<T> {
  // TODO: Maybe also allow undefined? (or `Result<T, string>` so that the error message can be used to help debugging)
  render(): T;
  /**
   * This hook is called when this view is destroyed.
   * Use this to clean up event listeners, etc.
   */
  destroy?(): void;
}

/**
 * Defines what an EditorView should look like.
 *
 * `T` defines the type that is returned from the render hook and the type of the root element of this view.
 * E.g. this will be `HTMLElement` when rendering to the DOM.
 *
 * `R` is by default the same as `T`, this defines the types of `NodeView`, that can occur in the document.
 * E.g. this will be `Node` or `Text | HTMLElement` when rendering to the DOM.
 */
export abstract class EditorView<T, R = T> implements View<T> {
  readonly editable: boolean;
  abstract root: T;

  constructor(
    readonly state: EditorState,
    root?: T,
  ) {
    this.editable = state.editable;
    // @ts-ignore : Constructor is not called in the this class
    if (root) this.root = root;

    this.state.bind(this);
  }

  mount(root: T) {
    this.root = root;
  }

  update(diff: Diff) {
    this.render();
  }

  abstract render(): T;

  destroy() {}

  // Util methods

  /**
   * Gets the position that `element` represents to in the Editor document.
   */
  abstract toNode(element: R): Node;
  /**
   * Gets the position that `element` represents to in the Editor document.
   */
  //abstract toPos(element: R): Position;
  /**
   * Gets the `element` in the rendered editor, that represents the node at pos.
   */
  //abstract fromPos(pos: PositionLike): R;
}
