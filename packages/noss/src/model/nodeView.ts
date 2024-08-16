import { MethodError, stack } from "@noss-editor/utils";
import type { RenderResult, DOMText } from "../types";
import type { Node } from "./node";

export abstract class NodeView {
  readonly node!: Node;

  /**
   * The root element of the view, this is the element that is returned from the `render` method.
   * Setting this property is optional.
   */
  public root?: HTMLElement;
  /**
   * The outlet of the view, this is where the child content of the node is displayed.
   * If not specified, the root element will be used if needed.
   * Can be left empty if the node has no children.
   */
  public outlet?: HTMLElement;

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

  abstract render(): RenderResult;

  /**
   * Allows you to construct a `NodeView` similar to how you define the `toDom` property in the schema in ProseMirror.
   */
  static from(definition: RenderDefinition) {
    return new DefintionNodeView(definition);
  }
}

export class DefintionNodeView extends NodeView {
  constructor(
    readonly definition: RenderDefinition,
    node?: Node,
  ) {
    super();
  }

  override render(): RenderResult {
    const { root, outlet } = stack("DefintionNodeView.render")(renderDefintion(this.definition));
    this.root = root;
    this.outlet = outlet;
    return root;
  }
}

export type RenderDefinition = [
  keyof HTMLElementTagNameMap,
  {
    [x: string]: unknown;
  },
  ...(RenderDefinition | RenderResult | string | number | boolean)[],
];

function renderDefintion(definition: RenderDefinition) {
  const [tag, attrs, ...children] = definition;
  const ele: HTMLElement = document.createElement(tag);
  let outlet: HTMLElement | undefined;

  const setOutlet = (n: HTMLElement) => {
    if (outlet)
      throw new MethodError("Can't have more than one outlet in a NodeDefintion", "renderDefintion");

    outlet = n;
  }

  // Attributes
  for (const attr in attrs) {
    //@ts-ignore
    const val = attrs[attr];
    if (val === "children") continue;
    else if (attr.startsWith("on") && typeof val === "function") {
      // bind event listener
      const event = attr.slice(2).toLowerCase() as keyof HTMLElementEventMap;
      ele.addEventListener(event, (e) => val(e));
    } else if (attr === "style" && typeof val !== "string") style(ele, val as { [x: string]: string });
    else ele.setAttribute(attr, val as string);
  }

  // Children
  for (const child of children) {
    if (typeof child === "string") ele.appendChild(document.createTextNode(child));
    else if (child === 0) setOutlet(ele);
    else if (typeof child === "number" || child === true || child instanceof Date || child instanceof RegExp)
      ele.appendChild(document.createTextNode(child.toString()));
    else if (child instanceof HTMLElement || child instanceof Text)
      ele.appendChild(child);
    else if (Array.isArray(child)) {
      const res = renderDefintion(child);
      if (res.outlet) setOutlet(res.outlet);
      ele.appendChild(res.root);
    }
  }

  return {
    root: ele,
    outlet
  };
}

// https://github.com/CodeFoxDev/honeyjs-core/blob/main/src/jsx-runtime.js#L83
function style(element: HTMLElement, style: { [x: string]: string }) {
  let res = {};
  for (const property in style) {
    let cssProp = property
      .replace(/[A-Z][a-z]*/g, (str) => '-' + str.toLowerCase() + '-')
      .replace('--', '-') // remove double hyphens
      .replace(/(^-)|(-$)/g, ''); // remove hyphens at the beginning and the end
    if (
      typeof style[property] === 'string' ||
      typeof style[property] === 'number'
    ) {
      //@ts-ignore
      element.style[cssProp] = style[property];
    } else console.warn('Unknown style value:', style[property]);
  }
  return res;
}
