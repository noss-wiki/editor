const activeStack: string[] = [];

export class MethodError extends Error {
  methodStack: string[];

  constructor(msg: string, method: string) {
    let log = `${msg}\n  at ${method}\n`;

    for (const i of activeStack.slice().reverse()) log += `  at ${i}\n`;

    super(log);
    this.methodStack = [...activeStack, method].reverse();
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
