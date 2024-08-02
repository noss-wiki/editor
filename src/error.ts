export class MethodError extends Error {
  constructor(msg: string, method: string) {
    super(`${msg}\n  at ${method}`);
  }
}

export class NotImplementedError extends Error {
  constructor(method: string, sub?: boolean) {
    if (sub === true) super(`This case in ${method}, is not yet implemented`);
    else super(`${method} has not been implemented yet`);
  }
}
