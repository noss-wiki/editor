import type { Node } from "./node";
import type { EditorState } from "../state";

/**
 * A generic view where `T` represents what is rendered; what the render hook returns.
 * E.g. when defining a view for a web targeted platform `T` would be `HTMLElement` (or better `HTMLElement | Text`).
 */
export interface View<T> {
  // TODO: Maybe also allow undefined?
  render(): T;
  /**
   * This hook is called when this view is destroyed.
   * Use this to clean up event listeners, etc.
   */
  destroy?(): void;
}

export abstract class DocumentView<T> implements View<T> {
  constructor(readonly state: EditorState) {}

  abstract render(): T;

  //call render when update returns null or something (result? / option?)
  //update() {
  //  return null;
  //}

  destroy() {}
}
