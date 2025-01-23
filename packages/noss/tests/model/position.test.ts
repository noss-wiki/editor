import { describe, test, expect } from "vitest";
import { doc, h1, p } from "../nodes";
import { Position, AnchorPosition } from "../../src";

const document = doc(
  h1("This is a heading"), // 0 <h1>This is a heading</h1> 19
  p("This is a paragraph with some text."), // 19 <p>This is a paragraph with some text.</p> 56
  p(), // 56 <p></p> 58
  p("This is another paragraph."), // 58 <p>This is another paragraph.</p> 86
);

describe("Position", () => {
  describe("node, index, and offset methods", () => {
    test("should return correct values at different depths", () => {
      const pos = Position.resolve(document, 23).val as Position;

      expect(pos.node(0)).toBe(document);
      expect(pos.node(1)).toBe(document.child(1));
      expect(pos.node()).toBe(document.child(1).child(0));

      expect(pos.index(0)).toBe(1);
      expect(pos.index(1)).toBe(0);

      expect(pos.offset(0)).toBe(19);
      expect(pos.offset(1)).toBe(0);
      expect(pos.offset(2)).toBe(3);
    });

    test("should handle negative depth values", () => {
      const pos = Position.resolve(document, 23).val as Position;

      expect(pos.node(-2)).toBe(document);
      expect(pos.node(-1)).toBe(document.child(1));
      expect(pos.index(-1)).toBe(0);
      expect(pos.offset(-1)).toBe(0);
    });

    test("should throw RangeError for invalid depths", () => {
      const pos = Position.resolve(document, 23).val as Position;

      expect(() => pos.node(10)).toThrow(RangeError);
      expect(() => pos.index(-10)).toThrow(RangeError);
      expect(() => pos.offset(5)).toThrow(RangeError);
    });
  });

  describe("start and end methods", () => {
    test("should return correct start positions", () => {
      const pos = Position.resolve(document, 23).val as Position;

      expect(pos.start(0)).toBe(0);
      expect(pos.start(1)).toBe(19); // Start of paragraph
      expect(pos.start()).toBe(20); // Start of text node
    });

    test("should return correct end positions", () => {
      const pos = Position.resolve(document, 23).val as Position;

      expect(pos.end(0)).toBe(document.nodeSize);
      expect(pos.end(1)).toBe(56); // End of first paragraph
    });
  });

  describe("Position.commonAncestor", () => {
    test("should find common ancestor between two positions", () => {
      const pos1 = Position.resolve(document, 23).val as Position;
      const pos2 = Position.resolve(document, 25).val as Position;
      const pos3 = Position.resolve(document, 60).val as Position;

      expect(pos1.commonAncestor(pos2)).toBe(document.child(1).child(0));
      expect(Position.commonAncestor(pos1, pos3)).toBe(document);
    });

    test("should throw error for positions with different boundaries", () => {
      const pos1 = Position.resolve(document, 23).val as Position;
      const differentDoc = doc(p("Different"));
      const pos2 = Position.resolve(differentDoc, 3).val as Position;

      expect(() => pos1.commonAncestor(pos2)).toThrow();
    });
  });

  describe("Position.indexToOffset and offsetToIndex", () => {
    test("should correctly convert between index and offset", () => {
      const paragraph = document.child(1);

      const offset = Position.indexToOffset(paragraph, 0).val as number;
      expect(offset).toBe(0);

      const { index, offset: extraOffset } = Position.offsetToIndex(paragraph, 5);
      expect(index).toBe(0);
      expect(extraOffset).toBe(5);
    });

    test("should handle edge cases", () => {
      const paragraph = document.child(1);

      expect(Position.indexToOffset(paragraph).val).toBe(paragraph.contentSize);
      expect(Position.indexToOffset(paragraph, -1).val).toBe(0);

      const result = Position.indexToOffset(paragraph, paragraph.childCount);
      expect(result.ok).toBe(true);
      expect(result.val).toBe(paragraph.contentSize);
    });

    test("should return error for invalid indices", () => {
      const paragraph = document.child(1);

      expect(Position.indexToOffset(paragraph, 100).err).toBe(true);
      expect(Position.indexToOffset(paragraph, -10).err).toBe(true);
    });
  });

  describe("Position absolute values", () => {
    test("should correctly resolve absolute positions", () => {
      const pos = 23;
      const position = Position.resolve(document, pos).val as Position;

      expect(Position.absolute(position)).toBe(pos);
      expect(Position.absolute(pos)).toBe(pos);
    });

    test("should handle invalid absolute positions", () => {
      expect(Position.resolveAbsolute(document, -1).err).toBe(true);
      expect(Position.resolveAbsolute(document, 1000).err).toBe(true);
    });
  });

  describe("Position.resolvable", () => {
    test("should correctly identify resolvable values", () => {
      expect(Position.resolvable(23)).toBe(true);
      expect(Position.resolvable(Position.resolve(document, 23).val)).toBe(true);
      expect(Position.resolvable(AnchorPosition.before(document.child(0)))).toBe(true);

      expect(Position.resolvable("not a position")).toBe(false);
      expect(Position.resolvable({})).toBe(false);
      expect(Position.resolvable(null)).toBe(false);
    });
  });

  describe("Position.resolve", () => {
    test("It should correctly resolves inside nodes", () => {
      const _pos = Position.resolve(document, 23);
      expect(_pos.ok).toBe(true);

      const pos = _pos.val as Position;
      expect(pos.parent).toBe(document.child(1).child(0));
      expect(pos.offset()).toBe(3);
      expect(pos.index()).toBe(0);
      expect(pos.absolute).toBe(23);
    });

    test("It should nest as deep as possible", () => {
      const _pos = Position.resolve(document, 20);
      expect(_pos.ok).toBe(true);

      const pos = _pos.val as Position;
      expect(pos.parent).toBe(document.child(1).child(0));
      expect(pos.offset()).toBe(0);
      expect(pos.index()).toBe(0);
      expect(pos.absolute).toBe(20);
    });
  });
});

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
