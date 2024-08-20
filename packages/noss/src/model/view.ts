/**
 * A generic view where `T` represents what is rendered; what the render hook returns.
 * E.g. when defining a view for a web targeted platform `T` would be `HTMLElement` (or better `HTMLElement | Text`).
 */
export interface View<T> {
  render(): T;
}
