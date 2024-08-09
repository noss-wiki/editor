import { test, expect, describe } from "vitest";
import { NodeType } from "../../src/";

// To register the text type, and reference the value to avoid tree-shaking it
import { Text } from "../../src/model/node";
Text.type;

const testType = NodeType.from({
  name: "test",
  schema: {
    group: "inline",
    inline: true,
  },
});

describe("Creating a new nodeType", () => {
  test("that already exists, should throw", () => {
    expect(() =>
      NodeType.from({
        name: "test",
        schema: {},
      }),
    ).toThrow();
  });
});

describe("Extending an existing nodeType", () => {
  test("should keep same schema", () => {
    const extended = NodeType.extend("test", {
      name: "strong",
    });

    expect(extended.schema).toEqual(testType.schema);
  });

  test("that doesn't exist, should throw", () => {
    expect(() => NodeType.extend("non-existing", { name: "strong" })).toThrow();
  });
});

describe("Overriding an existing nodeType", () => {
  test("that doesn't exist, should throw", () => {
    expect(() => NodeType.override({ name: "non-existing", schema: {} })).toThrow();
  });
});

describe("Getting", () => {
  test("the text nodeType, should return the built-in text nodeType, if not overwritten", () => {
    expect(NodeType.get("text")).not.toBeUndefined();
  });
});
