export interface Memo<T> {
  val: T;
}

/**
 * Creates a lazy memoized value.
 * The callback is only called when the value is needed, and is memoized for future calls, so `callback` is only called once.
 *
 * @returns A `Memo<T>` object, which has the returned value as the property `val`.
 */
export function useLazyMemo<T>(callback: () => T): Memo<T> {
  let val: T | undefined;
  const handler: ProxyHandler<Memo<T>> = {
    get(_, key) {
      if (key === "val") {
        if (!val) val = callback();
        return val;
      }
      return Reflect.get(_, key);
    },
  };

  return new Proxy({} as Memo<T>, handler);
}
