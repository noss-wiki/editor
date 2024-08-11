export class Result<T> {
  constructor(
    private value: T,
    private error?: string,
  ) {}

  static Ok<T>(value: T) {
    return new Result(value);
  }

  static Error(reason: string) {
    return new Result(null, reason);
  }
}
