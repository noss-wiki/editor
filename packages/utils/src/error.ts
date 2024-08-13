const activeStack: string[] = [];

export class MethodError extends Error {
  _stack: string[];
  _message: string;

  constructor(msg: string, method: string | string[]) {
    let log = `${msg}\n  at ${method}\n`;

    for (const i of activeStack.slice().reverse()) log += `  at ${i}\n`;

    super(log);
    this._stack = [...activeStack, ...(Array.isArray(method) ? method : [method])].reverse();
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
 */
export function stack(method: string) {
  activeStack.push(method);

  return <T>(target: T) => {
    activeStack.pop();
    return target;
  };
}

export class NotImplementedError extends Error {
  constructor(method: string, sub?: boolean) {
    if (sub === true) super(`This case in ${method}, is not yet implemented`);
    else super(`${method} has not been implemented yet`);
  }
}
