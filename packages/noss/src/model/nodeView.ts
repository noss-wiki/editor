import type { View } from "./view";
import type { Node, Text } from "./node";

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
   */
  _render(node?: Node) {
    if (!this.node && node) this.bind(node);

    this.outlet = undefined;
    this.root = this.render();
    this.outlet ??= this.root;
    return { root: this.root, outlet: this.outlet };
  }

  abstract render(): T;
}

export abstract class BoundaryView<T> extends NodeView<T> {
  /**
   * This is what renders the node itself, it is part of the parent boundary.
   * Defining outlet is not still necessary, as the result of `renderBoundary` is inserted as child of the outlet.
   */
  abstract override render(): T;
  /**
   * This is the boundary of the node, it wraps the node's content,
   * but isn't part of the parent boundary in the view.
   * This will be the only child of `outlet`.
   */
  abstract renderBoundary(): T;
}

/**
 * The default text view, the render hook just returns the text content,
 * and the renderer takes care of actually creating the correct elements.
 */
export class TextView extends NodeView<string> {
  declare node: Text;
  override render() {
    return this.node.text;
  }
}
