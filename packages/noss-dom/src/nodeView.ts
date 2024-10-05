import type { DOMNode, NodeRoot } from "./types";
import type { NodeAttrs, ParseResult } from "noss-editor";
import type { Result } from "@noss-editor/utils";
import { NodeView } from "noss-editor";
import { stack, MethodError, Err, Ok } from "@noss-editor/utils";

export type DOMTagParseRule = {
  /**
   * The lowercase tag name of the node.
   */
  tag?: string;
  style?: string;
};

// @ts-ignore : It gives weird error but it works just fine
export abstract class DOMNodeView extends NodeView<DOMNode> {
  /**
   * If true, a `<br>` element will be rendered if the node is empty.
   * This fixes some DOM issues, where e.g. an empty paragraph will have a height of zero, and therefore is invisible to the user.
   *
   * Set this to true, on text-holding nodes, e.g. paragraphs, headers, etc.
   */
  emptyBreak = false;

  /**
   * A shorthand for creating parse functions based on a set of rules.
   * This assumes the view renders a single tag element. (e.g. a paragraph `<p>`)
   * @usage
    ```ts
    class ParagraphView extends DOMNodeView {
        static override parse = DOMNodeView.rules([{ tag: "p" }]);
    }
    ```
   */
  static rules(rules: DOMTagParseRule[]) {
    return (e: HTMLElement): Result<ParseResult<HTMLElement> | true, null> => {
      for (const rule of rules) {
        if (rule.tag?.toLowerCase() === e.tagName.toLowerCase()) return Ok(true);
      }
      return Err();
    };
  }

  /**
   * Given an HTMLElement, check if it is a valid node for this view.
   * For simple usage, use `DOMNodeView.rules`
   */
  static override parse(e: HTMLElement): Result<ParseResult<HTMLElement> | true, null> {
    return Err();
  }
}

// TODO: Add support for parse (rules)
export class SimpleNodeView extends NodeView<NodeRoot> {
  constructor(readonly definition: RenderDefinition) {
    super();
  }

  override render(): NodeRoot {
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

type ChildDefintion = RenderDefinition | NodeRoot | string | number | boolean;

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
