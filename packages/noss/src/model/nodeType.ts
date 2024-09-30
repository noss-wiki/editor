import type { Node } from "./node";
import type { ContentExpression } from "../schema/expression";
import type { Result } from "@noss-editor/utils";
import { Err, MethodError, Ok, stack, wrap } from "@noss-editor/utils";
import { Fragment } from "./fragment";

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
  /**
   * Set to true to use this node as default node type for the editor,
   * the default node will be used when inserting a newline, so make sure it can hold text content.
   * Only one node type can be the default node type.
   * @default false
   */
  default?: boolean;
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
  // TODO: Create a type for this to not rely on svg strings (probably a class that extends view (IconView?))
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

// TODO: Create resolved type for this
export interface NodeSchema {
  /**
   * Whether or not this node is similar to a text node, in that it only has plain text as content, not a fragment with nodes.
   * This assumes `Node.text` is of type string, else the program will throw unexpectedly.
   * In order for Node methods to work, you'll need to extend (or override) the builtin text nodeType, or reimplement the methods to support text content yourself.
   * @default false
   */
  text?: boolean;
  /**
   * The content expression for this node, when left empty it allows no content.
   * @default ""
   */
  content?: string | ContentExpression;
  /**
   * The group, space seperated groups or array of group names to which this Node belongs.
   * @default ""
   */
  group?: string | string[];
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

type ExtendNodeTypeDefinition = Partial<Omit<NodeTypeDefinition, "name">> & { name: string };

const definitions: Record<string, NodeType | undefined> = {};
let defaultType: NodeType | null = null;

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
        `NodeType with name ${this.name}, already exists. If overriding this was intentional, use NodeType.override`,
        "NodeType.constructor",
      );
    else if (definition.default && defaultType !== null)
      throw new MethodError("Multiple nodes are set as default", "NodeType.constructor");

    this.visible = this.meta === undefined || this.meta.visible !== true;
    definitions[this.name] = this;
    if (definition.default) defaultType = this;
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
      // @ts-ignore : TS somehow doesn't understand that it should be changed if it's undefined
      if (type.schema[key] === undefined) type.schema[key] = other.schema[key];
    }

    return new NodeType(<NodeTypeDefinition>type, other.name);
  }

  /**
   * Overrides an existing type with a new definition.
   * This can be used to overwrite the default text node for example.
   * The type to override is inferred from the name property.
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
    const res = NodeType.softGet(name);
    if (res.err) throw new MethodError(res.val, "NodeType.get");
    return res.val;
  }

  /**
   * Binds the Node classes to the NodeType instances.
   * This is required for the parser to work.
   * Make sure to register all nodes before creating the `EditorState`.
   */
  static register(...nodes: (typeof Node)[]) {
    for (const node of nodes) {
      node.type.node = node;
      const content = node.type.schema.text ? "test" : Fragment.empty;
      // @ts-ignore : node isn't the base class, but an extending class
      wrap<Node>(() => new node(content)) //
        .map((n) => n.getView())
        .trace("NodeType.register", "static")
        .throw();
    }
  }

  /**
   * Tries to get the nodeType with `name`, will return undefined if the nodeType was not found.
   */
  static softGet(name: string): Result<NodeType, string> {
    const res = definitions[name];
    if (res) return Ok(res);
    return Err(`Cannot get the nodeType ${name}, is it defined?`);
  }

  static get all() {
    return definitions;
  }

  static get default(): Result<NodeType, null> {
    if (defaultType === null) return Err(null);
    return Ok(defaultType);
  }
}
