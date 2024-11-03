export type SerializedData = Record<string, unknown>;

export interface Serializable<T = SerializedData> {
  toJSON(): T;
}
