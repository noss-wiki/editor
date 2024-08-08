import { test, expect, describe } from "vitest";
import { doc, h1, p } from "../nodes";

describe("Node.textContent", () => {
  test("single node", () => {
    expect(p("test").textContent).toBe("test");
  });

  test("child nodes", () => {
    expect(doc(p("nested")).textContent).toBe("nested");
  });

  test("multiple nested nodes", () => {
    expect(doc(p("nested"), h1("header")).textContent).toBe("nestedheader");
  });
});

describe("Node.toString", () => {
  test("empty node", () => {
    expect(doc().toString()).toBe("document");
  });

  test("single paragraph", () => {
    expect(p("test").toString()).toBe('paragraph("test")');
  });

  test("nested nodes", () => {
    expect(doc(p("nested"), h1("header")).toString()).toBe('document(paragraph("nested"), header("header"))');
  });
});
