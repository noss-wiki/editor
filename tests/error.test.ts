import { test, expect, describe } from "vitest";
import { MethodError, stack, NotImplementedError } from "../src/error";

test("The stack method should add methods to the error stack", () => {
  expect(() => {
    stack("method1")(
      stack("method2")(
        (() => {
          throw new MethodError("Method error", "method3");
        })()
      )
    );
  }).toThrow("Method error\n  at method3\n  at method2\n  at method1");
});
