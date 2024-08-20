import type { View } from "noss-editor";

export class EditorView implements View<HTMLElement> {
  render(): HTMLElement {
    return document.createElement("div");
  }
}
