import { describe, test, expect } from "vitest";
import { doc, h1, p } from "../nodes";

// biome-ignore lint :
import { Position, AnchorPosition } from "../../src";

const document = doc(
  h1("This is a heading"), // 19
  p("This is a paragraph with some text."),
  p(),
  p("This is another paragraph."),
);

describe("AnchorPosition", () => {
  test("before", () => {
    const anchor = document.child(0);
    const pos = AnchorPosition.before(anchor).resolve(document);

    expect(pos.err).toBe(false);

    const resPos = pos.val as Position;

    expect(resPos.parent).toBe(document);
    expect(resPos.offset()).toBe(0);
    expect(resPos.index()).toBe(0);
    expect(resPos.absolute).toBe(0);
  });

  test("ater", () => {
    const anchor = document.child(0);
    const pos = AnchorPosition.after(anchor).resolve(document);

    expect(pos.err).toBe(false);

    const resPos = pos.val as Position;

    expect(resPos.parent).toBe(document);
    expect(resPos.offset()).toBe(anchor.nodeSize);
    expect(resPos.index()).toBe(1);
    expect(resPos.absolute).toBe(anchor.nodeSize);
  });

  test("child", () => {
    const anchor = document.child(0);
    const pos = AnchorPosition.child(anchor).resolve(document);

    expect(pos.err).toBe(false);

    const resPos = pos.val as Position;

    expect(resPos.parent).toBe(anchor);
    expect(resPos.offset()).toBe(anchor.contentSize);
    expect(resPos.index()).toBe(1);
    expect(resPos.absolute).toBe(anchor.contentSize + 1);
    expect(resPos.node(-1)).toBe(document);
  });
});
