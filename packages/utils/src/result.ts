import { MethodError } from "./error";

export class Result<T> {
  /**
   * Use the `Result.Ok` and `Result.Error` methods instead of this constructor.
   *
   * @internal
   */
  constructor(
    private value: T,
    private error?: string,
    private methodError?: MethodError,
  ) {}

  /**
   * Unwraps the value of this Result,
   * may return null if this Result has no value.
   */
  unwrap(): T;
  /**
   * Unwraps the value of this Result,
   * or returns the fallback if this Result has no value.
   *
   * @param fallback
   *   The fallback value to use, if this Result has no value.
   *   Must be of the same type as this Result can return.
   */
  unwrap<F extends NonNullable<T>>(fallback: F): F;
  unwrap(fallback?: T): T | null {
    if (this.error === undefined) return this.value;
    else if (fallback !== undefined) return fallback;
    return null;
  }

  /**
   * Unwraps the Result to either the value or a {@link MethodError}.
   */
  unwrapToError(method?: string) {
    method ??= "anonymous";
    if (this.error === undefined) return this.value;
    // biome-ignore lint: Either value or error is defined
    else if (!this.methodError) return new MethodError(this.error!, [method, "Result.unwrapToError"]);
    else return this.methodError.extend(undefined, [method, "Result.unwrapToError"]);
  }

  isError(): boolean {
    if (this.error === undefined) return false;
    else return true;
  }

  static Ok<T>(value: T) {
    return new Result(value);
  }

  static Error(reason: string, err?: MethodError) {
    return new Result(null, reason, err);
  }
}

/**
 * Wraps a function that can throw,
 * if the throwed value is a {@link MethodError} or a generic Error it will return a `Result.Error`.
 * If the value is unknown it will still be thrown.
 */
export function wrap<T extends () => ReturnType<T>>(fn: T): Result<null | ReturnType<T>> {
  try {
    return Result.Ok(fn());
  } catch (e) {
    if (e instanceof MethodError) return Result.Error(e._message, e);
    else if (e instanceof Error) return Result.Error(e.message);
    else throw e;
  }
}
