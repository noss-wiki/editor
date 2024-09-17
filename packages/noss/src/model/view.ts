import type { Selection } from "./selection";
import type { Node, Text } from "./node";
import type { EditorState } from "../state";
import type { Diff } from "../state/diff";
import type { Result } from "@noss-editor/utils";
import type { Transaction } from "../state/transaction";
import { Err, Ok } from "@noss-editor/utils";

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
 * A `NodeView` is a view that is bound to a node,
 * this is responsible for rendering the node correctly.
 */
export abstract class NodeView<T> implements View<T> {
  /**
   * The node that is bound to this view.
   */
  readonly node!: Node;
  /**
   * The name of the linked node's type, this is used for debugging purposes.
   * If not changed, the name of the node's type will be used.
   */
  public name!: string;
  /**
   * The root element of the view, this is the element that is returned from the `render` method.
   * Setting this property is optional.
   */
  public root?: T;
  /**
   * The outlet of the view, this is where the child content of the node is displayed.
   * If not specified, the root element will be used if needed.
   * Can be left empty if the node has no children.
   */
  public outlet?: T;

  /**
   * @param node The node to bind to this view, this is not required if the node is bound later in e.g. a subclass of `Node`.
   */
  constructor(node?: Node) {
    if (node) {
      this.node = node;
      this.name ??= this.node.type.name;
    }
  }

  /**
   * Binds a node to this view, it this hasn't been done in the constructor.
   */
  bind(node: Node) {
    // @ts-ignore : Assigned here instead of constructor
    this.node ??= node;
    this.name ??= this.node.type.name;
  }

  /**
   * Wraps the render hook to bind the node and save the root/outlet.
   * @internal
   */
  _render(node?: Node) {
    if (!this.node && node) this.bind(node);

    this.outlet = undefined;
    this.root = this.render();
    this.outlet ??= this.root;
    return { root: this.root, outlet: this.outlet };
  }

  abstract render(): T;

  /**
   * Defines a set of simple parse rules.
   * This and/or the parse method can be used.
   * Proper types should be provided by the editorView that is used in the environment, e.g. `noss-dom`.
   */
  static rules: Record<string | number | symbol, unknown>[];

  /**
   * This and/or the rules property can be used.
   * Proper types should be provided by the editorView that is used in the environment, e.g. `noss-dom`.
   *
   * @returns   An `Ok<true>` if it was a match or an `Ok<Node>` if additional values on the node are set,
   *            or an `Err<null>` indicating it was not a match.
   */
  static parse(e: unknown): Result<Node | true, null> {
    return Err();
  }
}

/**
 * The default text view, the render hook just returns the text content,
 * and the renderer takes care of actually creating the correct elements.
 */
export class TextView<T> extends NodeView<string> {
  public textRoot?: T;
  declare node: Text;
  override render() {
    return this.node.text;
  }
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

  update(tr: Transaction, diff: Diff) {
    this.render();
  }

  abstract render(): T;

  destroy() {}

  // Util methods are target specific

  /**
   * Gets the position that `element` represents to in the Editor document.
   */
  abstract toNode(element: R): Result<Node, string>;

  /**
   * Gets the `element` in the rendered editor, that is bound to `node`.
   */
  abstract toRendered(node: Node): Result<R, string>;

  /**
   * Gets the current selection in the editor.
   * This is for example used in transactions as the base selection,
   * to be able to restore the selection after updating the ui.
   */
  abstract getSelection(boundary: Node): Result<Selection, string>;

  /**
   * Tries to parse the given element to the corresponding node,
   * based on the view's rules.
   * This method is recursive, so it will also parse the children, etc.
   */
  abstract parse(e: R): Result<Node, string>;
}
