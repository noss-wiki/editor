import { Fragment, Node, Text, NodeType, NodeView } from "../src";
export { Node, Text };

export class Document extends Node {
  static override type = NodeType.from({
    name: "document",
    schema: {
      content: "block+",
      group: "document",
    },
  });

  override readonly view = NodeView.from(["div", { class: "document" }, 0]);

  get nodeSize() {
    return this.content.size; // document start and end brackets don't count, as you can't focus outside of document
  }
}

export class Paragraph extends Node {
  static override type = NodeType.from({
    name: "paragraph",
    schema: {
      content: "inline*",
      group: "block",
    },
  });

  override readonly view = NodeView.from(["p", 0]);
}

export class Header extends Node {
  static override type = NodeType.extend("paragraph", {
    name: "header",
  });

  override readonly view = NodeView.from(["h1", 0]);
}

export function doc(...content: (Node | string)[]) {
  return new Document(parseContent(content));
}

export function p(...content: (Node | string)[]) {
  return new Paragraph(parseContent(content));
}

export function h1(...content: (Node | string)[]) {
  return new Header(parseContent(content));
}

function parseContent(content: (Node | string)[]) {
  const nodes: Node[] = [];
  for (const n of content) nodes.push(typeof n === "string" ? new Text(n) : n);

  return Fragment.from(nodes);
}
