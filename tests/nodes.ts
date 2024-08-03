import { Node } from "../src/model/node";
import { NodeType } from "../src/model/nodeType";
export { Node, Text } from "../src/model/node";

export class Document extends Node {
  static type = NodeType.from({
    name: "document",
    schema: {
      content: "block+",
      group: "document",
    },
  });

  get nodeSize() {
    return this.content.size; // document start and end brackets don't count, as you can't focus outside of document
  }
}

export class Paragraph extends Node {
  static type = NodeType.from({
    name: "paragraph",
    schema: {
      content: "inline*",
      group: "block",
    },
  });
}

export class Header extends Node {
  static type = NodeType.extend("paragraph", {
    name: "header",
  });
}
