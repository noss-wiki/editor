import { MethodError } from "./error";

interface BaseResult<T, E> {
  readonly ok: boolean;
  readonly err: boolean;

  unwrap(fallback: T): T;
}

export const Ok = <T>(val: T): Ok<T> => new Ok_(val);
export const Err = <E>(val: E): Err<E> => new Err_(val);

export type Result<T, E> = Ok<T> | Err<E>;

interface Ok<T> extends BaseResult<T, never> {
  readonly val: T;
  readonly ok: true;
  readonly err: false;

  unwrap(): T;
}

class Ok_<T> implements Ok<T> {
  readonly ok = true;
  readonly err = false;

  constructor(readonly val: T) {}

  unwrap(): T {
    return this.val;
  }
}

interface Err<E> extends BaseResult<never, E> {
  readonly val: E;
  readonly ok: false;
  readonly err: true;

  unwrap<T>(fallback: T): T;
}

class Err_<E> implements Err<E> {
  readonly ok = false;
  readonly err = true;

  constructor(readonly val: E) {}

  unwrap<T>(fallback: T): T {
    throw fallback;
  }
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
