import type { Result } from "@noss-editor/utils";
import type { Node } from "./model/node";
import type { Position } from "./model/position";

// Serialization
export type SerializedData = Record<string, unknown>;

export interface Serializable<T = SerializedData> {
  toJSON(): T;
}

export type Serialized<T> = T extends Serializable<infer S> ? S : never;

// Resolvables
/**
 * A collection of types that can be resolve to `T`
 */
export type Resolvable<T> = T | ResolvableClass<T> | ResolvableMarkers<T>;
type ResolvableMarkers<T> = T extends { __resolvable?: infer R }
  ? Exclude<R, undefined>
  : T extends { __resolvable?: infer R }
    ? R
    : never;

export interface ResolvableClass<T> {
  resolve(boundary: Node): Result<T, string>;
}

export type Resolver<T> = (boundary: Node, unresolved: Resolvable<T>) => Result<T, string>;
