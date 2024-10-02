import type { Result } from "@noss-editor/utils";
import type { FragmentJSON } from "./fragment";
import type { Slice } from "./slice";
import type { NodeView } from "./view";
import { Err, MethodError, NotImplementedError, stack } from "@noss-editor/utils";
import { TextView } from "./view";
import { NodeType } from "./nodeType";
import { Fragment } from "./fragment";
import { Position } from "./position";

export type NodeAttrs = {
  readonly [x: string]: unknown;
};

export type NodeConstructor = new (content?: Fragment | string) => Node;

/**
 * The base Node class
 */
export abstract class Node {
  static readonly type: NodeType;

  /**
   * The type of this node, this is inferred automatically from the static type property.
   */
  readonly type: NodeType;

  readonly id: string;

  /**
   * The view that is responsible for rendering this node.
   * Use `getView()` wherever possible to ensure this node is bound to the view.
   */
  readonly view?: NodeView<unknown>;

  /**
   * This node's attributes, if you want to define that a node has attributes,
   * you should extend `AttrNode` instead of the normal `Node` class.
   */
  readonly attrs: NodeAttrs | null = null;
  /**
   * This node's children
   */
  readonly content: Fragment;
  /**
   * The text content if this node is a text node, or `null` otherwise.
   * This is used to determine if a node is a text node or not.
   */
  readonly text: string | null = null;
  /**
   * The string representation of the content
   */
  get textContent(): string {
    let content = "";
    for (const [n] of this.content.iter()) content += n.textContent;

    return content;
  }

  get nodeSize() {
    if (this.type.schema.text) return (<Text>this).text.length;
    else if (this.type.schema.inline === true)
      return 1; // non-text leaf nodes always have a length of 1
    else return this.content.size + 2; // the size of the content + 2 (the start and end tokens)
  }

  get childCount() {
    return this.content.childCount;
  }

  // also add marks later
  constructor(content?: Fragment | string);
  constructor(attrs: NodeAttrs, content?: Fragment | string);
  constructor(attrs?: Fragment | string | NodeAttrs, content?: Fragment | string) {
    this.type = (<typeof Node>this.constructor).type;

    if (typeof attrs === "string" || attrs instanceof Fragment) {
      content = attrs;
      attrs = undefined;
    }

    if (typeof content === "string")
      throw new MethodError(
        `The node type ${this.type.name}, needs to override the constructor method to support inserting text content, as the default implementation does not support it`,
        "Node.constructor",
      );

    // Link this node class to the provided nodeType
    if (this.type.node !== undefined && this.type.node !== <typeof Node>this.constructor)
      throw new MethodError(
        `A different node definition for the type ${this.type.name}, already exists`,
        "Node.constructor",
      );

    this.type.node = <typeof Node>this.constructor;
    this.id = Math.random().toString(36).slice(2);
    this.content = content || Fragment.empty;
    if (attrs) this.attrs = attrs;
  }

  /**
   * Returns the view that belongs to this node, or undefined if not set.
   * This also binds this node to the view, if not done already.
   */
  getView(): this["view"] {
    if (!this.view) return;
    else if (!this.view.node) this.view.bind(this);
    return this.view;
  }

  child(index: number): Node {
    return this.content.child(index);
  }

  /**
   * Inserts the content at the given offset.
   *
   * @returns The modified node
   * @throws {MethodError} If the node type doesn't support text content and the content argument is of type string.
   */
  insert(offset: number, content: string | Node | Node[] | Fragment) {
    if (typeof content === "string")
      throw new MethodError(
        `The node type ${this.type.name}, needs to override the insert method to support inserting text content, as the default implementation does not support it`,
        "Node.insert",
      );

    const { index, offset: o } = Position.offsetToIndex(this, offset, true);
    if (o === 0) return this.copy(this.content.insert(content, index));
    throw new NotImplementedError("Node.insert", true);
  }

  /**
   * Changes this nodes content to only include the content between the given positions.
   * This does not cut non-text nodes in half, meaning if the starting position is inside of a node, that entire node is included.
   */
  cut(from: number, to: number = this.content.size) {
    if (from === 0 && to === this.content.size) return this;
    return this.copy(this.content.cut(from, to));
  }

  /**
   * Removes the content between the given positions.
   *
   * @returns The modified node
   * @throws {MethodError} If one or more of the positions are outside of the allowed range.
   */
  remove(from: number, to: number = this.content.size) {
    if (from < 0 || to > this.content.size)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Node.remove",
      );
    if (from === to) return this;

    return this.copy(this.content.remove(from, to));
  }

  removeChild(child: Node) {
    return this.copy(this.content.remove(child));
  }

  /**
   * Replaces the selection with the provided slice, if it fits.
   *
   * @param slice The slice to replace the selection with, or a string if this node is a text node.
   * @throws {MethodError} If the node type doesn't support text content and the slice argument is of type string.
   */
  replace(from: number, to: number, slice: Slice | string) {
    if (typeof slice === "string")
      throw new MethodError(
        `The node type ${this.type.name}, needs to override the replace method to support inserting text content, as the default implementation does not support it`,
        "Node.replace",
      );

    if (slice.size === 0 && from === to) return this;
    else return this.copy(this.content.replace(from, to, slice, this));
  }

  private resolveCache: { [pos: number]: Position } = {};

  /**
   * Resolves a position inside this nodes, using `Position.resolve`.
   * The result is cached, so calling this method multiple times with the same position will return the cached position.
   *
   * @param pos The absolute position inside this node to resolve
   * @returns The resolved position if successful, or `undefined` if resolving failed.
   * @throws {MethodError} If the position is outside of the allowed range or it could not be resolved by `Position.resolve`.
   */
  resolve(pos: number) {
    if (pos < 0 || pos > this.nodeSize)
      throw new MethodError(`The position ${pos}, is outside of the allowed range`, "Node.resolve");

    if (this.resolveCache[pos] !== undefined) return this.resolveCache[pos];

    const res = stack("Node.resolve")(Position.resolve(this, pos));
    return (this.resolveCache[pos] = res);
  }

  /**
   * Resolves a position inside this nodes, using `Position.resolve`.
   * Unlike `Node.resolve`, this method does not cache the result,
   * so calling this multiple times with the same position is more expensive.
   *
   * @param pos The absolute position inside this node to resolve
   * @returns The resolved position if successful, or `undefined` if resolving failed.
   * @throws {MethodError} If the position is outside of the allowed range or it could not be resolved by `Position.resolve`.
   */
  resolveNoCache(pos: number) {
    if (pos < 0 || pos > this.nodeSize)
      throw new MethodError(`The position ${pos}, is outside of the allowed range`, "Node.resolveNoCache");

    return stack("Node.resolveNoCache")(Position.resolve(this, pos));
  }

  /**
   * Checks if `other` is equal to this node
   * @param other The node to check
   * @param ignoreContent If true, only the type, attributes and markup is checked, not the content
   */
  eq(other: Node, ignoreContent = false): boolean {
    if (this === other) return true;
    if (this.type.name !== other.type.name) return false;
    // TODO: also check if markup is the same
    if (ignoreContent === true) return true;
    else return this.content.eq(other.content);
  }

  strictEq(other: Node, ignoreContent = false): boolean {
    return this.id === other.id && this.eq(other, ignoreContent);
  }

  /**
   * Creates a deep copy of this node.
   * It does this by calling the copy method on the content fragment,
   * if this node has different behaviour it should override this function.
   */
  copy(content?: Fragment | string) {
    if (content === this.content) return this;
    return this.new(content, true);
  }

  /**
   * Creates a new instance of this node type.
   * E.g when calling this on a Paragraph, it creates a new Paragraph node.
   * @throws {MethodError} If the node type doesn't support text content and the content argument is of type string.
   */
  new(content?: Fragment | string, keepId?: boolean) {
    if (typeof content === "string" && !this.type.schema.text)
      throw new MethodError(`The node type ${this.type.name}, doesn't support text content`, "Node.new");

    const Class = <typeof Node>this.constructor;
    // TODO: Also include other things, like marks, etc.
    // @ts-ignore : `Class` will never be the direct Node instance, but a subclass of it.
    const inst = new Class(content) as Node;
    // @ts-ignore : id shouldn't be settable from outside the class, but it still needs to be copied.
    if (keepId) inst.id = this.id;
    return inst;
  }

  toString(): string {
    if (this.content.size === 0) return this.type.name;

    return `${this.type.name}(${this.content.toString().slice(1, -1)})`;
  }

  toJSON(): NodeJSON {
    return {
      id: this.id,
      type: this.type.name,
      content: this.content.toJSON(),
    };
  }
}

/**
 * A node that can have attributes.
 * This class is purely for type safety, and setting the attrs property, so you don't have to.
 * Everything else is handled by the `Node` class.
 */
export class AttrNode<A extends NodeAttrs = NodeAttrs> extends Node {
  declare attrs: A;

  constructor(attrs: A, content?: Fragment | string) {
    super(attrs, content);
  }
}

export class Text extends Node {
  static override type = NodeType.from({
    name: "text",
    schema: {
      group: "inline",
      inline: true,
      text: true,
    },
  });

  declare readonly text: string;

  override readonly view = new TextView();

  override get textContent() {
    return this.text;
  }

  override get nodeSize() {
    return this.text.length;
  }

  constructor(content?: string) {
    super();
    if (!content) throw new MethodError("Empty text nodes are not allowed", "Text.constructor");
    this.text = content;
    this.view.bind(this);
  }

  override child(index: number): Node {
    throw new MethodError("Can't call the Node.child method on a text node", "Text.child");
  }

  override insert(offset: number, content: string) {
    return this.replace(offset, offset, content);
  }

  override cut(from: number, to?: number) {
    if (from < 0 || (to && to > this.text.length))
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Text.cut",
      );

    return this.copy(this.text.slice(from, to));
  }

  override remove(from: number, to: number = this.text.length) {
    if (from < 0 || to > this.text.length)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Text.remove",
      );

    return this.copy(this.text.slice(0, from) + this.text.slice(to));
  }

  override replace(from: number, to: number, slice: string) {
    if (from < 0 || to > this.text.length)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Text.replace",
      );

    return this.copy(this.text.slice(0, from) + slice + this.text.slice(to));
  }

  override resolve(pos: number): Position {
    if (pos < 0 || pos > this.nodeSize)
      throw new MethodError(`The position ${pos}, is outside of the allowed range`, "Text.resolve");

    throw new MethodError(`The position ${pos}, cannot be resolved inside a text node`, "Text.resolve");
  }

  /**
   * Checks if `other` is equal to this node
   * @param other The node to check
   * @param ignoreContent If true, only the type, attributes and markup is checked, not the text content
   */
  override eq(other: Node, ignoreContent = false): boolean {
    if (other.type.schema.text !== true) return false;
    const res = super.eq(other, true);
    if (ignoreContent === true) return res;
    else return res && this.text === other.text;
  }

  override copy(content?: string): Text {
    if (content === this.text) return this;
    return this.new(content, true) as Text;
  }

  override toString() {
    return `"${this.text}"`;
  }
}

export type NodeJSON = {
  id: string;
  type: string;
  content: FragmentJSON;
};
