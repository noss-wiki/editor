import { Fragment, Node, Text, NodeType } from "noss-editor";
import { SimpleNodeView, DOMNodeView } from "../src/nodeView";
export { Node, Text };

class DocumentView extends DOMNodeView {
  override render() {
    const div = document.createElement("div");
    div.className = "noss-document";
    // Fixes issues with trailing spaces
    div.style.setProperty("white-space", "pre-wrap");
    return div;
  }
}

export class Document extends Node {
  static override type = NodeType.from({
    name: "document",
    schema: {
      content: "block+",
      group: "document",
    },
  });

  override view = new DocumentView();

  override get nodeSize() {
    return this.content.size; // document start and end brackets don't count, as you can't focus outside of document
  }
}

class ParagraphView extends DOMNodeView {
  override emptyBreak = true;
  declare node: Paragraph;

  override render() {
    const p = document.createElement("p");
    return p;
  }

  static override parse = DOMNodeView.rules([{ tag: "p" }]);
}

export class Paragraph extends Node {
  static override type = NodeType.from({
    name: "paragraph",
    schema: {
      content: "inline*",
      group: "block",
    },
    default: true,
  });

  override view = new ParagraphView();
}

class HeaderView extends DOMNodeView {
  override emptyBreak = true;
  declare node: Header;

  override render() {
    return document.createElement("h1");
  }

  static override parse = DOMNodeView.rules([{ tag: "h1" }]);
}

export class Header extends Node {
  static override type = NodeType.extend("paragraph", {
    name: "header",
  });

  override view = new HeaderView();
}

class HardBreakView extends DOMNodeView {
  declare node: HardBreak;

  override render() {
    return document.createElement("br");
  }

  static override parse = DOMNodeView.rules([{ tag: "br" }]);
}

export class HardBreak extends Node {
  static override type = NodeType.from({
    name: "hardBreak",
    schema: {
      group: "inline",
      leaf: true,
      inline: true,
    },
  });

  override view = new HardBreakView();
}

NodeType.register(Document, Paragraph, Header, HardBreak);

export function doc(...content: (Node | string)[]) {
  return new Document(parseContent(content));
}

export function p(...content: (Node | string)[]) {
  return new Paragraph(parseContent(content));
}

export function h1(...content: (Node | string)[]) {
  return new Header(parseContent(content));
}

export function text(content: string) {
  return new Text(content);
}

function parseContent(content: (Node | string)[]) {
  const nodes: Node[] = [];
  for (const n of content) nodes.push(typeof n === "string" ? new Text(n) : n);

  return Fragment.from(nodes);
}
