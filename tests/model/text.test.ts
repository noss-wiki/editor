import { test, expect, describe } from "vitest";
import { Text } from "../nodes";

test("Text.child method, should throw", () => {
  expect(() => new Text().child(0)).toThrow();
});

describe("Text.insert", () => {
  test("at the start", () => {
    expect(new Text(" world").insert(0, "hello").text).toBe("hello world");
  });

  test("inside the node", () => {
    expect(new Text("hllo").insert(1, "e").text).toBe("hello");
  });

  test("at the end", () => {
    expect(new Text("hello ").insert(6, "world").text).toBe("hello world");
  });
});

describe("Text.cut", () => {
  test("with all content selected", () => {
    expect(new Text("hello").cut(0, 5).text).toBe("hello");
  });

  test("with some content selected", () => {
    expect(new Text("hello world").cut(3, 9).text).toBe("lo wor");
  });

  test("with no content selected, should throw", () => {
    expect(() => new Text("hello").cut(0, 0)).toThrow();
  });
});
