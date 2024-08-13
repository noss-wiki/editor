import type { Node } from "./node";
import type { ContentExpression } from "../schema/expression";
import { MethodError, stack } from "@noss-editor/utils";

// TODO: Add dom representation, probably same as ProseMirror (via schema.toDom)
export interface NodeTypeDefinition {
  /**
   * The name of this type, this needs to be unique for every node type.
   */
  name: string;
  /**
   * The meta data for this node type, if not provided or `meta.visible` is false, it will not be available for selection to the end user in e.g. the commands menu.
   */
  meta?: NodeMeta;
  /**
   * The schema that applies for this node type.
   */
  schema: NodeSchema;
}

/**
 * Meta data is data that is displayed (or used to display) info about this node in the ui.
 * Like the commands menu, or in the selection toolbar.
 */
export interface NodeMeta {
  /**
   * The name that will be displayed to the user, e.g. in the commands menu
   */
  name: string;
  /**
   * The description that will be displayed to the user, e.g. in the commands menu
   */
  description: string;
  // TODO: Create a type for this to not rely on svg strings
  /**
   * Raw html code for icon, import using `*.svg?raw`
   */
  icon: string;
  /**
   * If this Node is visible for selection in the UI
   * @default true
   */
  visible?: boolean;
}

export interface NodeSchema {
  /**
   * Whether or not this node is similar to a text node, in that it only has plain text as content, not a fragment with nodes.
   * This assumes `Node.text` is of type string, else the program will throw unexpectedly.
   */
  text?: boolean;
  /**
   * The content expression for this node, when left empty it allows no content.
   */
  content?: string | ContentExpression;
  /**
   * The group or space seperated groups to which this Node belongs.
   */
  group?: string;
  /**
   * Whether this node is an inline node, if `false` it will be a block node.
   * @default false
   */
  inline?: boolean;
  /**
   * If this node is a leaf, it has no editable content.
   * @default false
   */
  leaf?: boolean;
  /**
   * A boundary is a node type similar to a leaf, in that it has a size of 1 and doesn't hold any directly editable content,
   * but different in that it can hold content that is editable to the user.
   * A boundary is sort of like a sub-document, it shares the same `EditorState` as the main document,
   * but positions are resolved in the boundary instead of from the main document.
   * The content also isn't displayed in the usual way, but via a seperate nodeView that can change how it looks.
   *
   * Usage examples for this include, footnotes, special math expressions, etc.
   * @default false
   */
  boundary?: boolean;
  /**
   * Determines whether this node as a whole can be selected.
   * Defaults to true for non-text nodes.
   * @default true
   */
  selectable?: boolean;
}

interface ExtendNodeTypeDefinition {
  name: string;
  meta?: NodeMeta;
  schema?: NodeSchema;
}

const definitions: Record<string, NodeType | undefined> = {};

export class NodeType {
  /**
   * If this node is visible for creation by the end user.
   * Will be false if meta is not provided or `meta.visible` is not set to true.
   */
  readonly visible: boolean;

  readonly name: string;
  readonly schema: NodeSchema;
  readonly meta?: NodeMeta;

  /**
   * The node class that represents this node type.
   */
  node!: typeof Node;

  constructor(
    readonly definition: NodeTypeDefinition,
    readonly extend?: string,
  ) {
    this.name = definition.name;
    this.schema = definition.schema;
    if (definition.meta) this.meta = definition.meta;

    if (definitions[this.name] !== undefined)
      throw new MethodError(
        `NodeType with name ${this.name}, already exists. If overriding this was intentional, use NodeType.override.`,
        "NodeType.constructor",
      );

    this.visible = this.meta === undefined || this.meta.visible !== true;
    definitions[this.name] = this;
  }

  static from(type: NodeTypeDefinition) {
    return stack("NodeType.from")(new NodeType(type));
  }

  /**
   * Extends an existing type, this will carry over the schema off the old type, except for the specified properties.
   * A different name is still required and the meta will not be extended,
   * so it needs to be specified again for it to be visible to the end user.
   *
   * @param other The NodeType to override
   * @param type The new (partial) type definition
   * @throws {MethodError} If the nodeType to extend doesn't exist
   */
  static extend(other: string | NodeTypeDefinition, type: ExtendNodeTypeDefinition) {
    if (typeof other === "string") {
      const found = definitions[other];
      if (!found)
        throw new MethodError(
          `Tried extending the NodeType ${other}, but it doesn't exist or has not been created yet, make sure the nodeTypes are created in the correct order`,
          "NodeType.extend",
        );

      other = found;
    }

    if (!type.schema) return new NodeType({ ...type, schema: other.schema }, other.name);

    for (const prop in other.schema) {
      const key = prop as keyof NodeSchema;
      // @ts-ignore
      if (type.schema[key] === undefined) type.schema[key] = other.schema[key];
    }

    return new NodeType(<NodeTypeDefinition>type, other.name);
  }

  /**
   * Overrides an existing type with a new definition.
   * This can be used to overwrite the default text node for example.
   *
   * @param type The type definition for the node type
   * @throws {MethodError} If the overridden nodeType doesn't exist
   */
  static override(type: NodeTypeDefinition) {
    if (definitions[type.name] === undefined)
      throw new MethodError(
        `Tried overriding the NodeType ${type.name}, but it doesn't exist or has not been created yet, make sure the nodeTypes are created in the correct order`,
        "NodeType.override",
      );

    definitions[type.name] = undefined;
    return new NodeType(type);
  }

  /**
   * Gets the nodeType with `name`, will throw if the nodeType was not found.
   *
   * @throws {MethodError} If the nodeType was not found
   */
  static get(name: string) {
    const res = definitions[name];
    if (!res) throw new MethodError(`Cannot get the nodeType ${name}, is it defined?`, "NodeType.get");
    return res;
  }

  /**
   * Tries to get the nodeType with `name`, will return undefined if the nodeType was not found.
   */
  static softGet(name: string) {
    return definitions[name];
  }

  static get all() {
    return definitions;
  }
}
