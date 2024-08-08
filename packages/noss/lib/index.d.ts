/**
 * A position or a resolvable position in a boundary.
 */
type PositionLike = number | RelativePosition | Position;
type RelativePositionLocation = "before" | "after" | "childIndex" | "childOffset";
declare class RelativePosition {
    readonly anchor: Node;
    private readonly location;
    private offset;
    constructor(anchor: Node, location: RelativePositionLocation, offset?: number);
    resolve(boundary: Node): Position | undefined;
}
declare class Position {
    /**
     * The boundary this position was resolved in
     */
    readonly boundary: Node;
    /**
     * The depth the position is relative to the boundary, 0 means it is the boundary, 1 means it is a direct chid of the boundary, etc.
     */
    readonly depth: number;
    /**
     * The parent node of this position
     */
    readonly parent: Node;
    /**
     * The offset this position has into its parent node
     */
    readonly offset: number;
    /**
     * Optionally the result from the `locateNode` function, if used.
     * This reduces overhead when trying to get more info about the node tree.
     */
    readonly steps: LocateData;
    constructor(
    /**
     * The boundary this position was resolved in
     */
    boundary: Node, 
    /**
     * The depth the position is relative to the boundary, 0 means it is the boundary, 1 means it is a direct chid of the boundary, etc.
     */
    depth: number, 
    /**
     * The parent node of this position
     */
    parent: Node, 
    /**
     * The offset this position has into its parent node
     */
    offset: number, 
    /**
     * Optionally the result from the `locateNode` function, if used.
     * This reduces overhead when trying to get more info about the node tree.
     */
    steps: LocateData);
    private resolveDepth;
    /**
     * Returns the parent node at `depth`.
     *
     * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
     */
    node(depth?: number): Node;
    /**
     * The index in the parent node at `depth`.
     *
     * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
     */
    index(depth?: number): number;
    /**
     * Returns the absolute position, where the parent node at `depth` starts.
     *
     * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
     */
    start(depth?: number): number;
    /**
     * Returns the absolute position, where the parent node at `depth` ends.
     *
     * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
     */
    end(depth?: number): number;
    /**
     * Returns the relative offset to `node`.
     * @param node The depth of a parent node of this position, or a node in this boundary.
     * @returns The relative position to node, will be undefined if this position is before `node`. Or undefined if node cannot be resolved in the same document as this position.
     */
    relative(node: Node | number): number;
    /**
     * Gets the depth of the deepest common parent between two positions.
     * @returns The depth of the deepest common parent.
     * @throws If the two positions are in different boundaries.
     */
    commonDepth(pos: Position): number;
    /**
     * Gets the deepest common parent between two positions.
     * @returns The common parent node, or undefind if it failed.
     * @throws If the two positions are in different boundaries.
     */
    commonParent(pos: Position): Node;
    /**
     * Converts this position to an absolute position in the Position's boundary.
     * @returns The absolute position
     */
    toAbsolute(): number;
    static resolve(boundary: Node, pos: PositionLike): Position | undefined;
    /**
     * Converts an absolute position to a resolved `Position`
     * @param boundary The boundary where to resolve the absolute position
     * @param pos The absolute position to resolve
     * @returns The resolved position, or undefined if it failed.
     */
    static absoluteToPosition(boundary: Node, pos: number): Position | undefined;
    /**
     * Converts a position to an absolute position in the Position's boundary.
     * @returns The absolute position, or undefined if it failed.
     */
    static positionToAbsolute(pos: Position | number): number;
    /**
     * Converts an index to an offset in a node
     * @param parent The node to use as parent
     * @param index The index to convert to an offset
     */
    static indexToOffset(parent: Node | Fragment, index?: number): number;
    /**
     * Tries to convert an offset to an index.
     *
     * @param parent The node to use as parent
     * @param offset The offset to convert to an index
     * @returns
     *    The index or undefined if it doesn't resolve as a direct child.
     *    The index may also be the length of the content, this means the offset directly after the last child.
     */
    static offsetToIndex(parent: Node | Fragment, offset: number, advanced?: false): number | undefined;
    /**
     * Tries to convert an offset to an index.
     *
     * @param parent The node to use as parent
     * @param offset The offset to convert to an index
     * @returns
     *    An object with the index and the offset into the node.
     *    The index may also be the length of the content, this means the offset directly after the last child.
     */
    static offsetToIndex(parent: Node | Fragment, offset: number, advanced: true): {
        index: number;
        offset: number;
    };
    /**
     * Returns a boolean indicating wheter or not `pos` is a resolved Position
     */
    static is(pos: PositionLike): boolean;
    /**
     * Creates a position that resolves before `anchor`
     */
    static before(anchor: Node): RelativePosition;
    /**
     * Creates a position that resolves after `anchor`
     */
    static after(anchor: Node): RelativePosition;
    /**
     * Creates a position that resolves as a child of `anchor` at index `index`, this is guaranteed to resolve as a direct child of the `anchor` (it cannot cut an existing node in half)
     * @param index The index where to resolve, leave empty for last item, and negative index to start from the last child
     */
    static child(anchor: Node, index?: number): RelativePosition;
    /**
     * Creates a position that resolves as a child of `anchor` at offset `offset`
     * @param offset The offset into the parent
     */
    static offset(anchor: Node, offset: number): RelativePosition;
}
interface LocateData {
    boundary: Node;
    steps: LocateStep[];
}
interface LocateStep {
    node: Node;
    /**
     * The depth this node is at, 0 means it is the boundary, 1 means it is a direct child of the document, etc.
     */
    depth: number;
    /**
     * The index this node has in its parents content.
     */
    index: number;
    /**
     * The absolute position of the node of this step.
     */
    pos?: number;
}
/**
 * Performs a breath-first search on the boundary to try to find the provided node
 * @param boundary The boundary node to search in
 * @param node The node to search for
 * @returns Info about the node if found, else it returns undefined
 */
declare function locateNode(boundary: Node, node: Node): LocateData | undefined;

declare class Slice {
    readonly content: Fragment;
    readonly openStart: number;
    readonly openEnd: number;
    readonly boundary?: Node | undefined;
    /**
     * @param content The content of this slice
     * @param openStart The depth in the content at the start where the slice starts
     * @param openEnd The depth in the content at the end where the slice ends
     * @param boundary The boundary the content originated from, leave empty if this slice is not part of a boundary
     */
    constructor(content: Fragment, openStart: number, openEnd: number, boundary?: Node | undefined);
    get size(): number;
    eq(other: Slice): boolean;
    insert(pos: number, insert: Fragment | Node[] | Node): void;
    remove(from: number, to: number): void;
    static between(from: Position, to: Position): Slice | undefined;
    static get empty(): Slice;
}

interface ParsedExpression {
    expression: string;
    selectors: SingleExpressionMatch[];
}
/**
 * The structure of a single expression is e.g. `paragraph+`, but not `heading paragraph+`
 */
interface SingleExpressionMatch {
    /**
     * The raw selector
     */
    selector: string;
    /**
     * The raw modifier
     */
    modifier?: string;
    /**
     * The range on which the selector applies,
     * if the second value is `-1` it should match infinte times (`*`, `+`, `{1,}`)
     */
    range: [number, number];
}
declare class ContentExpression {
    readonly expression: string;
    constructor(expression: string | undefined);
    parse(): ParsedExpression;
    match(content: Node[]): false | undefined;
    static validate(expression: string): boolean;
    /**
     * Ensures that `expression` is an instance of {@link ContentExpression}
     */
    static from(expression: ContentExpression | string): ContentExpression;
}

interface NodeTypeDefinition {
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
interface NodeMeta {
    /**
     * The name that will be displayed to the user, e.g. in the commands menu
     */
    name: string;
    /**
     * The description that will be displayed to the user, e.g. in the commands menu
     */
    description: string;
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
interface NodeSchema {
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
declare class NodeType {
    readonly name: string;
    readonly schema: NodeSchema;
    readonly meta?: NodeMeta | undefined;
    readonly extend?: string | undefined;
    /**
     * If this node is visible for creation by the end user.
     * Will be false if meta is not provided or `meta.visible` is not set to true.
     */
    visible: boolean;
    /**
     * The node class that represents this node type.
     */
    node: typeof Node;
    constructor(name: string, schema: NodeSchema, meta?: NodeMeta | undefined, extend?: string | undefined);
    static from(type: NodeTypeDefinition): NodeType;
    /**
     * Extends an existing type and changes only specified properties.
     * A different name is still required and the meta will not be extended,
     * so it needs to be specified again for it to be visible to the end user.
     *
     * @param other The NodeType to override
     * @param type The new (partial) type definition
     */
    static extend(other: string | NodeTypeDefinition, type: ExtendNodeTypeDefinition): NodeType;
    /**
     * Overrides an existing type with a new definition.
     * This can be used to overwrite the default text node for example.
     *
     * @param type The type definition for the node type
     */
    static override(type: NodeTypeDefinition): NodeType;
    static get(name: string): NodeType | undefined;
    static get all(): Record<string, NodeType | undefined>;
}

/**
 * The base Node class
 */
declare class Node {
    static readonly type: NodeType;
    readonly type: NodeType;
    readonly id: string;
    /**
     * This node's children
     */
    readonly content: Fragment;
    /**
     * The text content if this node is a text node, or `null` otherwise.
     * This is used to determine if a node is a text node or not.
     */
    readonly text: string | null;
    /**
     * The string representation of the content
     */
    get textContent(): string;
    get nodeSize(): number;
    get childCount(): number;
    constructor(content?: Fragment | string);
    child(index: number): Node;
    /**
     * Inserts the content at the given offset.
     *
     * @returns The modified node
     * @throws {MethodError} If the node type doesn't support text content and the content argument is of type string.
     */
    insert(offset: number, content: string | Node | Node[] | Fragment): Node;
    /**
     * Changes this nodes content to only include the content between the given positions.
     * This does not cut non-text nodes in half, meaning if the starting position is inside of a node, that entire node is included.
     */
    cut(from: number, to?: number): Node;
    /**
     * Removes the content between the given positions.
     *
     * @returns The modified node
     * @throws {MethodError} If one or more of the positions are outside of the allowed range.
     */
    remove(from: number, to?: number): Node;
    /**
     * Replaces the selection with the provided slice, if it fits.
     *
     * @param slice The slice to replace the selection with, or a string if this node is a text node.
     * @throws {MethodError} If the node type doesn't support text content and the slice argument is of type string.
     */
    replace(from: number, to: number, slice: Slice | string): Node;
    private resolveCache;
    /**
     * Resolves a position inside this nodes, using `Position.resolve`.
     * The result is cached, so calling this method multiple times with the same position will return the cached position.
     *
     * @param pos The absolute position inside this node to resolve
     * @returns The resolved position if successful, or `undefined` if resolving failed.
     * @throws {MethodError} If the position is outside of the allowed range or it could not be resolved by `Position.resolve`.
     */
    resolve(pos: number): Position;
    /**
     * Resolves a position inside this nodes, using `Position.resolve`.
     * Unlike `Node.resolve`, this method does not cache the result,
     * so calling this multiple times with the same position is more expensive.
     *
     * @param pos The absolute position inside this node to resolve
     * @returns The resolved position if successful, or `undefined` if resolving failed.
     * @throws {MethodError} If the position is outside of the allowed range
     */
    resolveNoCache(pos: number): Position | undefined;
    /**
     * Checks if `other` is equal to this node
     * @param other The node to check
     */
    eq(other: Node): boolean;
    /**
     * Creates a deep copy of this node.
     * It does this by calling the copy method on the content fragment,
     * if this node has differnt behaviour it should override this function.
     */
    copy(content?: Fragment | string): Node;
    /**
     * Creates a new instance of this node type.
     * E.g when calling this on a Paragraph, it creates a new Paragraph node.
     * @throws {MethodError} If the node type doesn't support text content and the content argument is of type string.
     */
    new(content?: Fragment | string, keepId?: boolean): Node;
    toString(): string;
    toJSON(): NodeJSON;
}
declare class Text extends Node {
    static type: NodeType;
    readonly text: string;
    get textContent(): string;
    get nodeSize(): number;
    constructor(content?: string);
    child(index: number): Node;
    insert(offset: number, content: string): Node;
    cut(from: number, to?: number): Node;
    remove(from: number, to?: number): Node;
    replace(from: number, to: number, slice: string): Node;
    resolve(pos: number): Position;
    copy(content?: string): Node;
    toString(): string;
}
type NodeJSON = {
    id: string;
    type: string;
    content: FragmentJSON;
};

declare class Fragment {
    readonly nodes: Node[];
    readonly size: number;
    get childCount(): number;
    /**
     * @param content The content of this fragment
     * @param size Optionally the size of this fragment, this prevents having to calculate it again.
     */
    constructor(content: Node[], size?: number);
    private resolveIndex;
    private isValidIndex;
    child(index: number): Node;
    /**
     * Appends the `nodes` to the end of this fragment.
     *
     * @param nodes Single nodes, node arrays, or fragments to append.
     * @returns The modified fragment.
     */
    append(...nodes: (Node | Node[] | Fragment)[]): Fragment;
    /**
     * Inserts `node` at `index` in this fragment.
     *
     * @param node The node or nodes to insert
     * @param index The index where to insert. Leave empty or undefined to insert at the end, or use a negative number to insert with offset from the end. If this value is out of bounds the value will be clamped.
     * @returns The modified fragment.
     * @throws {MethodError} If the index is out of bounds.
     */
    insert(node: Node | Node[] | Fragment, index?: number): Fragment;
    /**
     * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
     *
     * Removes a single node from this content.
     *
     * @param node The node to remove
     * @returns The modified fragment.
     * @throws {MethodError} If given the node is not part of this fragment.
     */
    remove(node: Node): Fragment;
    /**
     * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
     *
     * Removes the content between the given positions.
     *
     * @param from The start, from where to start removing
     * @param to The end, to where to remove
     * @returns The modified fragment.
     */
    remove(from: number, to: number): Fragment;
    /**
     * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
     *
     * Changes this fragment's content to only include the content between the given positions.
     * This does not cut non-text nodes in half, meaning if the starting position is inside of a node, that entire node is included.
     *
     * @param from The starting position where to cut.
     * @param to The end position, leave empty to cut until the end.
     * @throws {MethodError} If the starting position is greater than the end position, or if one or more of the positions are outside of the allowed range.
     */
    cut(from: number, to?: number): Fragment;
    /**
     * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
     *
     * @param parent The parent node of this fragment, this is used to check if the slice's content conforms to the parent's schema.
     */
    replace(from: number, to: number, slice: Slice, parent: Node): Fragment;
    /**
     * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
     *
     * Much simpler version of replace, only replaces a single child.
     * Always use this method over the more complex replace function, because this method is far more efficient.
     *
     * @param node The node to replace the child with.
     * @param index The index where to replace the child. Leave empty or undefined to insert at the end, or use a negative number to insert with offset from the end.
     * @throws {MethodError} If the index is out of bounds.
     */
    replaceChild(node: Node, index?: number): Fragment;
    /**
     * Checks if this fragment contains `node`.
     * It does this by performing a breath-first search in the descending nodes.
     * This function may be quite expensive on large nodes.
     */
    contains(node: Node): boolean;
    /**
     * Calculates the offset `node` has into this fragment.
     * Call this on the document node to get the absolute position of a node.
     * @returns The offset if found, or undefined if not found.
     */
    offset(node: Node): number | undefined;
    /**
     * Checks if `other` is equal to this fragment
     * @param other The fragment to check
     */
    eq(other: Fragment): boolean;
    /**
     * Creates a deep copy of this fragment, so child node references will be lost, as they will also get copied.
     * It does this by recursively calling this method on every child node.
     */
    /**
     * Iterate over all nodes, yields an array with first item the node, and second item the index.
     */
    iter(): Generator<[Node, number], void, unknown>;
    toString(): string;
    toJSON(): FragmentJSON;
    static from(content: Node | Node[] | Fragment): Fragment;
    static empty: Fragment;
}
type FragmentJSON = {
    nodes: NodeJSON[];
};

export { Fragment, Node, type NodeMeta, type NodeSchema, NodeType, type NodeTypeDefinition, Position, Text, locateNode };
