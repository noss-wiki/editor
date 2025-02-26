/**
 * A simple `Map` wrapper, that allows setting a maximum size, and will remove the first entry when the size exceeds the maximum.
 */
export class Cache<K, T> extends Map<K, T> {
  constructor(readonly max: number = 10) {
    super();
  }

  override set(key: K, value: T) {
    super.set(key, value);
    if (this.size > this.max) {
      const firstKey = this.keys().next().value;
      if (firstKey) this.delete(firstKey);
    }
    return this;
  }
}
