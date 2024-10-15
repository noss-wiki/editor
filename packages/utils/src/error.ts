import type { Trace } from "./result";

const activeStack: string[] = [];

export class MethodError extends Error {
  _stack: string[];
  _message: string;

  // TODO: Add support for the Trace type
  constructor(msg: string, method: string | string[]) {
    let log = `${msg}\n  at ${method}\n`;

    for (const i of activeStack.slice().reverse()) log += `  at ${i}\n`;

    super(`${log}\n`);
    this._stack = [...(Array.isArray(method) ? method : [method]), ...activeStack];
    this._message = msg;
  }

  /**
   * Extends this error to add new methods to the stack and updates the message,
   * @param msg The new message, or set to undefined to keep old message
   * @param method The method or methods to add to the stack
   */
  extend(msg: string | undefined, method: string | string[]) {
    msg ??= this._message;
    return new MethodError(msg, [...this._stack, ...(Array.isArray(method) ? method : [method])]);
  }
}

/**
 * Adds a method to the error stack, which gets logged if an error is thrown inside the called method.
 *
 * @usage
    ```ts
    const res = stack("EditorState.apply")(functionThatCanThrow());
    ```
 * If `functionThatCanThrow` throws a {@link MethodError}, the provided name will be added to the stack, and show up in the error message.
 * The only thing the function does is add the method to the stack when called initially,
 * and remove it when the returned function is called (and return the parameter to allow easy inlining).
 * If you want to wrap an entire section of code, you can use the second overload, like this:
    ```ts
    stack("EditorState.apply", () => {
        functionThatCanThrow();
        anotherFunctionThatCanThrow();
    });
    ```
 * This will call the method that wass passed to the second argument and return its result, while wrapping the entire section.
 */
export function stack(method: string): <T>(target: T) => T;
export function stack<T>(method: string, target: () => T): T;
export function stack<T>(method: string, callback?: () => T) {
  let same = false;
  if (activeStack[activeStack.length - 1] === method) same = true;
  else activeStack.unshift(method);

  if (callback !== undefined) {
    const res = callback();
    if (!same) activeStack.shift();
    return res;
  }

  return <T>(target: T) => {
    if (!same) activeStack.shift();
    return target;
  };
}

export class NotImplementedError extends Error {
  constructor(method: string, sub?: boolean) {
    if (sub === true) super(`This case in ${method}, is not yet implemented`);
    else super(`${method} has not been implemented yet`);
  }
}
