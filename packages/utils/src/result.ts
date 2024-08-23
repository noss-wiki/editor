import { MethodError } from "./error";

interface BaseResult<T, E> {
  readonly val: T | E;
  readonly ok: boolean;
  readonly err: boolean;

  isOk(): boolean;
  isErr(): boolean;

  /**
   * Extracts the `Ok` value, returning a default value if the result is an `Err`.
   */
  unwrap(fallback: T): T;
  /**
   * Returns this value if it is `Ok`, otherwise returns `fallback`.
   */
  or(fallback: Result<T, E>): Result<T, E>;
  /**
   * Updates the value held within the `Ok` of this result by calling `callback` with it.
   * If this is an `Err` rather than `Ok` `callback` is not called and this `Result` stays the same.
   */
  map<C>(callback: (val: T) => C): Result<C, E>;
  /**
   * Updates this `Ok` result by passing its value to a function that returns a `Result`, and returning the updated result. (This may replace the `Ok` with an `Err`.)
   * If this is an `Err` rather than an `Ok`, the function is not called and the original `Err` is returned.
   */
  try<C>(callback: (val: T) => Result<C, E>): Result<C, E>;
}

export const Ok = <T>(val: T): Ok<T> => new Ok_(val);
export const Err = <E>(val: E): Err<E> => new Err_(val);

/**
 * Implements part of Gleam's Result type in typescript.
 */
export type Result<T, E> = Ok<T> | Err<E>;

interface Ok<T> extends BaseResult<T, never> {
  readonly val: T;
  readonly ok: true;
  readonly err: false;

  isOk(): true;
  isErr(): false;

  unwrap(): T;
  or(): this;
  map<C>(callback: (val: T) => C): Ok<C>;
  /**
   * Updates a value held within the `Ok` of a result by calling `callback` with it.
   * If this is an `Error` rather than `Ok` `callback` is not called and the result stays the same.
   *
   * @override Optionally provide the Err type, so typescript simplifies to `Result<A, B>` instead of `Ok<A> | Err<B>`.
   */
  map<C, E>(callback: (val: T) => C): Result<C, E>;
  try<C, E>(callback: (val: T) => Result<C, E>): Result<C, E>;
}

class Ok_<T> implements Ok<T> {
  readonly ok = true;
  readonly err = false;

  constructor(readonly val: T) {}

  isOk = () => true as const;
  isErr = () => false as const;

  unwrap(): T {
    return this.val;
  }

  or() {
    return this;
  }

  map<C extends (val: T) => unknown>(callback: C) {
    const res = callback(this.val) as ReturnType<C>;
    return Ok(res);
  }

  try<C, E>(callback: (val: T) => Result<C, E>) {
    return callback(this.val);
  }
}

interface Err<E> extends BaseResult<never, E> {
  readonly val: E;
  readonly ok: false;
  readonly err: true;

  isOk(): false;
  isErr(): true;

  unwrap<T>(fallback: T): T;
  or<T>(fallback: T): T;
  map(): this;
  try(): this;
}

class Err_<E> implements Err<E> {
  readonly ok = false;
  readonly err = true;

  constructor(readonly val: E) {}

  isOk = () => false as const;
  isErr = () => true as const;

  unwrap<T>(fallback: T): T {
    throw fallback;
  }

  or<T>(fallback: T): T {
    return fallback;
  }

  map() {
    return this;
  }

  try() {
    return this;
  }
}

export function flatten<A, B>(result: Result<Result<A, B>, B>) {
  if (result.err) return result;
  return result.val;
}

/**
 * Wraps a function that can throw,
 * if the throwed value is a {@link MethodError} or a generic Error it will return a `Result.Error`.
 * If the value is unknown it will still be thrown.
 */
export function wrap<T extends () => ReturnType<T>>(fn: T): Result<ReturnType<T>, string> {
  try {
    return Ok(fn());
  } catch (e) {
    if (e instanceof MethodError) return Err(e._message);
    else if (e instanceof Error) return Err(e.message);
    else throw e;
  }
}
