import { MethodError } from "./error";

interface BaseResult<T, E> {
  readonly ok: boolean;
  readonly err: boolean;

  unwrap(fallback: T): T;
}

export const Ok = <T>(val: T) => new Ok_(val);
export const Err = <E>(val: E) => new Err_(val);

export type Ok<T> = Ok_<T>;
export type Err<E> = Err_<E>;
export type Result<T, E> = Ok<T> | Err<E>;

class Ok_<T> implements BaseResult<T, never> {
  readonly ok = true;
  readonly err = false;

  constructor(readonly val: T) {}

  unwrap(): T {
    return this.val;
  }
}

class Err_<E> implements BaseResult<never, E> {
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
