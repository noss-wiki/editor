import type { Node } from "./node";
import type { EditorState } from "../state";

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

export abstract class DocumentView<T> implements View<T> {
  readonly editable: boolean;
  abstract root: T;

  constructor(
    readonly state: EditorState,
    root?: T,
  ) {
    this.editable = state.editable;
    // @ts-ignore : Constructor is not called in the this class
    if (root) this.root = root;
  }

  mount(root: T) {
    this.root = root;
  }

  update() {
    return this.render();
  }

  abstract render(): T;

  destroy() {}
}
