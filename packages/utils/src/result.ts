import { MethodError } from "./error";

export const Ok = <A>(val: A): Ok<A> => new Ok_(val);

export function Err(): Err<null>;
export function Err<B>(val: B, method?: string, modifier?: TraceModifier): Err<B>;
export function Err<B>(val: B, stackTrace?: Trace[]): Err<B>;
export function Err<B>(val?: B, stackTrace?: Trace[] | string, modifier?: TraceModifier) {
  if (val == null) return new Err_(null);
  const stack = typeof stackTrace === "string" ? [{ method: stackTrace, modifier: modifier || "public" }] : stackTrace;
  return new Err_(val, stack);
}

/**
 * Implements part of Gleam's Result type in typescript.
 * The `Result` type represents a value that can be either a success (`Ok`) or a failure (`Err`).
 * If you simply want to use an `Option` type, use `Result<T, null>` instead.
 */
export type Result<A, B> = Ok<A> | Err<B>;

interface BaseResult<A, B> {
  readonly val: A | B;
  readonly ok: boolean;
  readonly err: boolean;

  /**
   * Extracts the `Ok` value, returning a default value if the result is an `Err`.
   */
  unwrap(fallback: A): A;
  /**
   * Returns this value if it is `Ok`, otherwise returns `fallback`.
   */
  or(fallback: Result<A, B>): Result<A, B>;
  /**
   * 'Taps' into the result, calling `callback` with the value if this is an `Ok`.
   * This doesn't modify the result, if you want to modify the `Ok` value, use `map` instead.
   */
  tap(callback: (val: A) => void): this;
  /**
   * 'Taps' into the result, calling `callback` with the value if this is an `Err`.
   * This doesn't modify the result, if you want to modify the `Err` value, use `mapErr` instead.
   */
  tapErr(callback: (val: B) => void): this;
  /**
   * Updates the value held within the `Ok` of this result by calling `callback` with it.
   * If this is an `Err` rather than `Ok`, `callback` is not called and this `Result` stays the same.
   */
  map<C>(callback: (val: A) => C): Result<C, B>;
  /**
   * Updates the value held within the `Err` of this result by calling `callback` with it.
   * If this is an `Ok` rather than `Err`, `callback` is not called and this `Result` stays the same.
   */
  mapErr<C>(callback: (val: B) => C): Result<A, C>;
  /**
   * Updates this `Ok` result by passing its value to a function that returns a `Result`, and returning the updated result. (This may replace the `Ok` with an `Err`.)
   * If this is an `Err` rather than an `Ok`, the function is not called and the original `Err` is returned.
   */
  try<C>(callback: (val: A) => Result<C, B>): Result<C, B>;
  /**
   * Updates this `Err` result by passing its value to a function that returns a `Result`, and returning the updated result. (This may replace the `Err` with an `Ok`.)
   * If this is an `Ok` rather than an `Err`, the function is not called and the original `Ok` is returned.
   */
  tryRecover<C>(callback: (val: B) => Result<A, C>): Result<A, C>;

  replace<C>(val: C): Result<C, B>;
  replaceErr<C>(val: C): Result<A, C>;

  /**
   * Adds a method to the stack trace if this result is an `Err`.
   * This is useful for debugging.
   */
  trace(method: string, modifier?: TraceModifier): Result<A, B>;
  traceMessage(message: string, method: string, modifier?: TraceModifier): Result<A, B>;
  /**
   * Calls `callback` with a value and the stack trace if this result is an `Err`.
   * If the value of the error type is a string or null, it will be a formatted message with the stack trace.
   */
  warn(callback: (msg: string | B, trace: Trace[]) => void): Result<A, B>;
  /**
   * Throws an error if this result is an `Err`.
   */
  throw(): void;
}

interface Ok<A> extends BaseResult<A, never> {
  readonly val: A;
  readonly ok: true;
  readonly err: false;

  or(): this;
  tapErr(): this;
  mapErr(): this;
  tryRecover(): this;
  replaceErr(): this;
  trace(): this;

  unwrap(): A;
  map<C>(callback: (val: A) => C): Ok<C>;
  /**
   * @override Optionally provides `Err` type hints, so typescript simplifies to `Result<A, B>` instead of `Ok<A> | Err<B>`.
   */
  map<C, B>(callback: (val: A) => C): Result<C, B>;
  try<C, B>(callback: (val: A) => Result<C, B>): Result<C, B>;
  replace<C>(val: C): Ok<C>;
  /**
   * @override Optionally provides `Err` type hints, so typescript simplifies to `Result<A, B>` instead of `Ok<A> | Err<B>`.
   */
  replace<C, B>(val: C): Result<C, B>;
}

interface Err<B> extends BaseResult<never, B> {
  readonly val: B;
  readonly ok: false;
  readonly err: true;
  readonly stackTrace: Trace[];

  toThrowable(): MethodError;

  tap(): this;
  map(): this;
  try(): this;
  replace(): this;

  unwrap<A>(fallback: A): A;
  or<A>(fallback: A): A;
  replaceErr<C>(val: C): Err<C>;
  /**
   * @override Optionally provides `Ok` type hints, so typescript simplifies to `Result<A, B>` instead of `Ok<A> | Err<B>`.
   */
  replaceErr<A, C>(val: C): Result<A, C>;
}

class Ok_<A> implements Ok<A> {
  readonly ok = true;
  readonly err = false;

  constructor(readonly val: A) {}

  or = () => this;
  tapErr = () => this;
  mapErr = () => this;
  tryRecover = () => this;
  replaceErr = () => this;
  trace = () => this;
  traceMessage = () => this;
  warn = () => this;
  throw = () => this;

  unwrap(): A {
    return this.val;
  }

  tap(callback: (val: A) => void) {
    callback(this.val);
    return this;
  }

  map<C extends (val: A) => unknown>(callback: C) {
    return Ok(callback(this.val));
  }

  try<C, B>(callback: (val: A) => Result<C, B>) {
    return callback(this.val);
  }

  replace<C>(val: C) {
    return Ok(val);
  }
}

export type TraceModifier = "public" | "static" | "private" | "internal";

export interface Trace {
  msg?: string;
  method: string;
  modifier: TraceModifier;
}

class Err_<B> implements Err<B> {
  readonly ok = false;
  readonly err = true;
  readonly stackTrace: Trace[];

  constructor(
    readonly val: B,
    stackTrace?: Trace[],
  ) {
    this.stackTrace = stackTrace || [];
  }

  toThrowable() {
    const msg = typeof this.val === "string" ? this.val : "An error occurred with a non-string error msg";
    return new MethodError(
      msg,
      this.stackTrace.map((e) => e.method),
    );
  }

  tap = () => this;
  map = () => this;
  try = () => this;
  replace = () => this;

  unwrap<A>(fallback: A): A {
    return fallback;
  }

  or<A>(fallback: A): A {
    return fallback;
  }

  tapErr(callback: (val: B) => void) {
    callback(this.val);
    return this;
  }

  mapErr<C>(callback: (val: B) => C) {
    return Err(callback(this.val), this.stackTrace);
  }

  tryRecover<A, C>(callback: (val: B) => Result<A, C>): Result<A, C> {
    return callback(this.val);
  }

  replaceErr<C>(val: C) {
    return Err(val, this.stackTrace);
  }

  trace(method: string, modifier: TraceModifier = "public") {
    return Err(this.val, this.stackTrace.concat({ method, modifier }));
  }

  traceMessage(msg: string, method: string, modifier: TraceModifier = "public") {
    return Err(this.val, this.stackTrace.concat({ msg, method, modifier }));
  }

  warn(callback: (msg: string | B, trace: Trace[]) => void) {
    if (this.val == null || typeof this.val === "string") callback(this.createTrace(), this.stackTrace);
    else callback(this.val, this.stackTrace);
    return this;
  }

  throw() {
    this.warn((msg) => {
      if (typeof msg === "string") throw new Error(msg);
      else throw new Error(`An error occured \n${this.createTrace()}`);
    });
  }

  private createTrace() {
    return this.stackTrace
      .map(({ method, modifier, msg: _msg }, i) => {
        const msg = i === 0 ? this.val : _msg;
        let part = "";
        if (msg && typeof msg === "string") {
          if (i > 0) part += "Caused: ";
          part += `${msg}\n`;
        }
        return `${part}${formatMethod(method, modifier)}`;
      })
      .join("\n");
  }
}

/**
 * Flattens a single level of nesting in a `Result` type.
 */
export function flatten<A, B>(result: Result<Result<A, B>, B>) {
  if (result.err) return result;
  return result.val;
}

type ExtractOk<T> = T extends Ok<infer A> ? A : never;
type ExtractOkValues<T extends Result<unknown, unknown>[]> = {
  [K in keyof T]: ExtractOk<T[K]>;
};

export function all<E, T extends Result<unknown, E>[]>(...results: T): Result<ExtractOkValues<T>, E> {
  const values = [];
  for (const r of results)
    if (r.ok) values.push(r.val);
    else return r;

  return Ok(values as ExtractOkValues<T>);
}

/**
 * Wraps a function that can throw,
 * if the throwed value is a {@link MethodError} or a generic Error it will return a `Err`.
 */
export function wrap<T>(fn: () => T): Result<T, string> {
  try {
    const res = fn();
    return Ok(res);
  } catch (e) {
    if (e instanceof MethodError) {
      const err = Err(e._message);
      for (const s of e._stack) err.trace(s);
      return err.trace("wrap\n  <throwed error was caught>");
    } else if (e instanceof Error) return Err(e.message, "wrap\n  <throwed error was caught>");
    else if (typeof e === "string") return Err(e, "wrap\n  <throwed error was caught>");
    else return Err("Unknown error", "wrap\n  <throwed error was caught>");
  }
}

function formatMethod(method: string, modifier: TraceModifier) {
  if (modifier === "public") return `  at         ${method}`;
  else if (modifier === "static") return `  at static  ${method}`;
  else if (modifier === "private") return `  at private ${method}`;
  else return `  at         ${method} (internal)`;
}
