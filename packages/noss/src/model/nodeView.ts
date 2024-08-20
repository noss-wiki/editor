import type { View } from "./view";
import type { Node, Text } from "./node";

export abstract class NodeView<T> implements View<T> {
  readonly node!: Node;

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
    if (node) this.node = node;
  }

  /**
   * Binds a node to this view, it this hasn't been done in the constructor.
   */
  bind(node: Node) {
    // @ts-ignore : Assign here istead of constructor
    this.node ??= node;
  }

  abstract render(): T;
}

/**
 * The default text view, the render hook just returns the content,
 * and the renderer takes care of actually creating the correct elements.
 */
export class TextView extends NodeView<string> {
  declare node: Text;
  override render() {
    return this.node.text;
  }
}
