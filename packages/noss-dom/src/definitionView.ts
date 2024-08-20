import type { RenderResult } from "./types";
import { NodeView } from "noss-editor";
import { stack, MethodError } from "@noss-editor/utils";

export class DefintionNodeView extends NodeView<RenderResult> {
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

/**
 * A definition of how to render a node.
 * This can be as follows: `[tag, attrs, ...children]` or `[tag, ...children]`.
 */
export type RenderDefinition =
  | [
      keyof HTMLElementTagNameMap,
      {
        class?: string;
        id?: string;
        style?: string | CSSStyleDeclaration;
        [x: string]: unknown;
      },
      ...ChildDefintion[],
    ]
  | [keyof HTMLElementTagNameMap, ...ChildDefintion[]];

type ChildDefintion = RenderDefinition | RenderResult | string | number | boolean;

function renderDefintion(definition: RenderDefinition) {
  let [tag, attrs, ...children] = definition;
  const ele: HTMLElement = document.createElement(tag);
  let outlet: HTMLElement | undefined;

  const setOutlet = (n: HTMLElement) => {
    if (outlet) throw new MethodError("Can't have more than one outlet in a NodeDefintion", "renderDefintion");
    else outlet = n;
  };

  // @ts-ignore : `attrs.nodeType` is only to check if it's a DOM node, not to access it
  if (attrs && typeof attrs === "object" && attrs.nodeType && Array.isArray(attrs)) {
    for (const attr in attrs) {
      const val = attrs[attr] as unknown;
      if (val === "children") continue;
      else if (attr.startsWith("on") && typeof val === "function") {
        // bind event listener
        const event = attr.slice(2).toLowerCase() as keyof HTMLElementEventMap;
        ele.addEventListener(event, (e) => val(e));
      } else if (attr === "style" && typeof val !== "string") style(ele, val as { [x: string]: string });
      else ele.setAttribute(attr, val as string);
    }
  } else {
    // @ts-ignore : attrs is of the same type as children, as verified above
    children = [attrs, ...children];
  }

  // Children
  for (const child of children) {
    if (child === 0) {
      if (children.length > 1)
        throw new MethodError("Outlet must be the only child of its parent node", "renderDefintion");
      setOutlet(ele);
    } else if (typeof child === "string") ele.appendChild(document.createTextNode(child));
    else if (typeof child === "number" || child === true || child instanceof Date || child instanceof RegExp)
      ele.appendChild(document.createTextNode(child.toString()));
    else if (child instanceof HTMLElement || child instanceof Text) ele.appendChild(child);
    else if (Array.isArray(child)) {
      const res = renderDefintion(child);
      if (res.outlet) setOutlet(res.outlet);
      ele.appendChild(res.root);
    }
  }

  return {
    root: ele,
    outlet,
  };
}

// https://github.com/CodeFoxDev/honeyjs-core/blob/main/src/jsx-runtime.js#L83
function style(element: HTMLElement, style: { [x: string]: string }) {
  const res = {};
  for (const property in style) {
    const cssProp = property
      .replace(/[A-Z][a-z]*/g, (str) => `-${str.toLowerCase()}-`) // transform camelCase to kebab-case
      .replace("--", "-") // remove double hyphens
      .replace(/(^-)|(-$)/g, ""); // remove hyphens at the beginning and the end
    if (typeof style[property] === "string" || typeof style[property] === "number") {
      //@ts-ignore : This is valid, but typescript thinks it's an array
      element.style[cssProp] = style[property];
    } else console.warn("Unknown style value:", style[property]);
  }
  return res;
}
