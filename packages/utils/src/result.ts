import { MethodError } from "./error";

export const Ok = <A>(val: A): Ok<A> => new Ok_(val);
export const Err = <B>(val: B): Err<B> => new Err_(val);

/**
 * Implements part of Gleam's Result type in typescript.
 * The `Result` type represents a value that can be either a success (`Ok`) or a failure (`Err`).
 * If you simply want to use an `Option` type, use `Result<T, never>` instead.
 */
export type Result<A, B> = Ok<A> | Err<B>;

interface BaseResult<A, B> {
  readonly val: A | B;
  readonly ok: boolean;
  readonly err: boolean;

  isOk(): boolean;
  isErr(): boolean;

  /**
   * Extracts the `Ok` value, returning a default value if the result is an `Err`.
   */
  unwrap(fallback: A): A;
  /**
   * Returns this value if it is `Ok`, otherwise returns `fallback`.
   */
  or(fallback: Result<A, B>): Result<A, B>;
  /**
   * Updates the value held within the `Ok` of this result by calling `callback` with it.
   * If this is an `Err` rather than `Ok` `callback` is not called and this `Result` stays the same.
   */
  map<C>(callback: (val: A) => C): Result<C, B>;
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
}

interface Ok<A> extends BaseResult<A, never> {
  readonly val: A;
  readonly ok: true;
  readonly err: false;

  isOk(): true;
  isErr(): false;

  or(): this;
  mapErr(): this;
  tryRecover(): this;
  replaceErr(): this;

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

  isOk(): false;
  isErr(): true;

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

  isOk = () => true as const;
  isErr = () => false as const;

  or = () => this;
  mapErr = () => this;
  tryRecover = () => this;
  replaceErr = () => this;

  unwrap(): A {
    return this.val;
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

class Err_<B> implements Err<B> {
  readonly ok = false;
  readonly err = true;

  constructor(readonly val: B) {}

  isOk = () => false as const;
  isErr = () => true as const;

  map = () => this;
  try = () => this;
  replace = () => this;

  unwrap<A>(fallback: A): A {
    throw fallback;
  }

  or<A>(fallback: A): A {
    return fallback;
  }

  mapErr<C>(callback: (val: B) => C) {
    return Err(callback(this.val));
  }

  tryRecover<A, C>(callback: (val: B) => Result<A, C>): Result<A, C> {
    return callback(this.val);
  }

  replaceErr<C>(val: C) {
    return Err(val);
  }
}

/**
 * Flattens a single level of nesting in a `Result` type.
 */
export function flatten<A, B>(result: Result<Result<A, B>, B>) {
  if (result.err) return result;
  return result.val;
}

/**
 * Wraps a function that can throw,
 * if the throwed value is a {@link MethodError} or a generic Error it will return a `Result.Error`.
 * If the value is unknown it will still be thrown.
 */
export function wrap<T>(fn: () => T): Result<T, string> {
  try {
    return Ok(fn());
  } catch (e) {
    if (e instanceof MethodError) return Err(e._message);
    else if (e instanceof Error) return Err(e.message);
    else throw e;
  }
}
