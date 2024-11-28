import type { Result } from "@noss-editor/utils";
import type { Node } from "./model/node";
import type { Position } from "./model/position";

// Serialization
export type SerializedData = Record<string, unknown>;

export interface Serializable<T = SerializedData> {
  toJSON(): T;
}

/**
 * Gets the serialized type of `T`, if it implements the {@link Serializable} interface
 */
export type Serialized<T> = T extends Serializable<infer S> ? S : never;

// Resolvables
/**
 * A collection of types that can be resolve to `T`.
 * This includes `T` itself, classes that implement `ResolvableClass<T>`, and any other types that the property `__resolvable` specified on `T`.
 *
 * @example E.g. `Position` can be resolved from a number, so the `Position` class has this
  ```ts
  class Position {
    declare readonly __resolvable?: number; // May also include `AnchorPosition`, but this implements `ResolvableClass<Position>`, so isn't necessary.
  }
  ```
 */
export type Resolvable<T> = T | ResolvableClass<T> | ResolvableMarkers<T>;
type ResolvableMarkers<T> = T extends { __resolvable?: infer R }
  ? Exclude<R, undefined>
  : T extends { __resolvable?: infer R }
    ? R
    : never;

/**
 * The interface a class should implement to be resolvable to `T`.
 */
export interface ResolvableClass<T> {
  resolve(boundary: Node): Result<T, string>;
}

export type Resolver<T> = (boundary: Node, unresolved: Resolvable<T>) => Result<T, string>;
