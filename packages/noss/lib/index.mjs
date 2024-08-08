var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => {
  __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const activeStack = [];
class MethodError extends Error {
  constructor(msg, method) {
    let log = `${msg}
  at ${method}
`;
    for (const i of activeStack.slice().reverse())
      log += `  at ${i}
`;
    super(log);
    __publicField$4(this, "methodStack");
    this.methodStack = [...activeStack, method].reverse();
  }
}
function stack(method) {
  activeStack.push(method);
  return (target) => {
    activeStack.pop();
    return target;
  };
}
class NotImplementedError extends Error {
  constructor(method, sub) {
    if (sub === true)
      super(`This case in ${method}, is not yet implemented`);
    else
      super(`${method} has not been implemented yet`);
  }
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => {
  __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const _Fragment = class _Fragment {
  /**
   * @param content The content of this fragment
   * @param size Optionally the size of this fragment, this prevents having to calculate it again.
   */
  constructor(content, size) {
    __publicField$3(this, "nodes");
    __publicField$3(this, "size");
    this.nodes = content;
    this.size = size || 0;
    if (size === void 0)
      for (const [child, i] of this.iter())
        this.size += child.nodeSize;
  }
  get childCount() {
    return this.nodes.length;
  }
  resolveIndex(index) {
    if (!index)
      return this.nodes.length === 0 ? 0 : this.nodes.length - 1;
    else if (index < 0)
      return this.nodes.length + index;
    else
      return index;
  }
  isValidIndex(index) {
    return index >= 0 && index <= this.nodes.length;
  }
  child(index) {
    return this.nodes[index];
  }
  /**
   * Appends the `nodes` to the end of this fragment.
   *
   * @param nodes Single nodes, node arrays, or fragments to append.
   * @returns The modified fragment.
   */
  append(...nodes) {
    const _nodes = nodes.flatMap((e) => e instanceof _Fragment ? e.nodes : e);
    const content = this.nodes.slice();
    content.push(..._nodes);
    return new _Fragment(
      content,
      _nodes.reduce((a, b) => a + b.nodeSize, this.size)
    );
  }
  /**
   * Inserts `node` at `index` in this fragment.
   *
   * @param node The node or nodes to insert
   * @param index The index where to insert. Leave empty or undefined to insert at the end, or use a negative number to insert with offset from the end. If this value is out of bounds the value will be clamped.
   * @returns The modified fragment.
   * @throws {MethodError} If the index is out of bounds.
   */
  insert(node, index) {
    if (node instanceof _Fragment)
      node = node.nodes;
    const nodes = Array.isArray(node) ? node : [node];
    const i = this.resolveIndex(index);
    if (!this.isValidIndex(i))
      throw new MethodError(`Index ${index} is not in the allowed range`, "Fragment.insert");
    const content = this.nodes.slice();
    content.splice(i, 0, ...nodes);
    return new _Fragment(
      content,
      nodes.reduce((a, b) => a + b.nodeSize, this.size)
    );
  }
  remove(node, to) {
    const content = this.nodes.slice();
    if (typeof node !== "number") {
      const index = content.indexOf(node);
      if (index === -1)
        throw new MethodError("The provided node to be removed is not part of this fragment", "Fragment.remove");
      content.splice(index, 1);
      return new _Fragment(content, this.size - this.child(index).nodeSize);
    } else {
      throw new NotImplementedError("Fragment.remove", true);
    }
  }
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
  cut(from, to = this.size) {
    if (from === 0 && to === this.size)
      return this;
    else if (from > to)
      throw new MethodError("The starting position is greater than the end position", "Fragment.cut");
    else if (from < 0 || to < 0 || to > this.size)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Fragment.cut"
      );
    const res = [];
    let pos = 0;
    let size = 0;
    for (const [c] of this.iter())
      if (c.nodeSize < from - pos)
        pos += c.nodeSize;
      else if (pos > to)
        break;
      else {
        if (typeof c.text === "string")
          c.cut(Math.max(0, from - pos), Math.min(c.text.length, to - pos));
        else
          c.cut(Math.max(0, from - pos - 1), Math.min(c.content.size, to - pos - 1));
        res.push(c);
        size += c.nodeSize;
        pos += c.nodeSize;
      }
    return new _Fragment(res, size);
  }
  // TODO: Figure out what to return
  /**
   * **NOTE**: This modifies this node's content, it should not be called directly on a node that is in a document, but rather via a transaction to preserve history.
   *
   * @param parent The parent node of this fragment, this is used to check if the slice's content conforms to the parent's schema.
   */
  replace(from, to, slice, parent) {
    const $from = parent.resolve(from);
    const $to = parent.resolve(to);
    if (!$from || !$to)
      throw new MethodError(`Positions couldn't be resolved`, "Fragment.replace");
    else if (slice.openStart > $from.depth || slice.openEnd > $to.depth)
      throw new MethodError(
        "The insert slice's depth is greater than the depth of the position it is inserted at",
        "Fragment.replace"
      );
    else if ($from.depth - $to.depth !== slice.openStart - slice.openEnd)
      throw new MethodError("The slice and insertion position have inconsistent depths", "Fragment.replace");
    return replaceOuter($from, $to, slice);
  }
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
  replaceChild(node, index) {
    const i = this.resolveIndex(index);
    if (!this.isValidIndex(i))
      throw new MethodError(`Index ${index} is not in the allowed range`, "Fragment.replaceChild");
    const content = this.nodes.slice();
    content[i] = node;
    return new _Fragment(content, this.size - this.child(i).nodeSize + node.nodeSize);
  }
  /**
   * Checks if this fragment contains `node`.
   * It does this by performing a breath-first search in the descending nodes.
   * This function may be quite expensive on large nodes.
   */
  contains(node) {
    const queue = [];
    for (const [c] of this.iter())
      if (c === node)
        return true;
      else
        queue.push(c);
    for (const c of queue)
      if (c.content.contains(node) === true)
        return true;
    return false;
  }
  /**
   * Calculates the offset `node` has into this fragment.
   * Call this on the document node to get the absolute position of a node.
   * @returns The offset if found, or undefined if not found.
   */
  offset(node) {
    const queue = [];
    let offset = 0;
    for (const [c] of this.iter()) {
      if (c === node)
        return offset;
      else
        queue.push([c, offset]);
      offset += c.nodeSize;
    }
    for (const [c, o] of queue) {
      const res = c.content.offset(node);
      if (res === void 0)
        continue;
      return o + res + 1;
    }
  }
  /**
   * Checks if `other` is equal to this fragment
   * @param other The fragment to check
   */
  eq(other) {
    if (this === other)
      return true;
    else if (this.nodes.length !== other.nodes.length)
      return false;
    for (const [node, i] of this.iter())
      if (!node.eq(other.nodes[i]))
        return false;
    return true;
  }
  /**
   * Creates a deep copy of this fragment, so child node references will be lost, as they will also get copied.
   * It does this by recursively calling this method on every child node.
   */
  /* copy(): Fragment {
    const children: Node[] = [];
    for (const [c] of this.iter()) children.push(c.copy());
    return new Fragment(children);
  } */
  // TODO: Maybe also just implement [Symbol.iterator] to avoid having to call iter()
  /**
   * Iterate over all nodes, yields an array with first item the node, and second item the index.
   */
  *iter() {
    for (let i = 0; i < this.nodes.length; i++)
      yield [this.nodes[i], i];
  }
  toString() {
    let content = "";
    for (const [n, i] of this.iter())
      if (i !== 0)
        content += `, ${n.toString()}`;
      else
        content += n.toString();
    return `[${content}]`;
  }
  toJSON() {
    return {
      nodes: this.nodes.map((e) => e.toJSON())
    };
  }
  // TODO: Check if content can be joined (like same mark text nodes)
  static from(content) {
    if (!content)
      return _Fragment.empty;
    else if (content instanceof _Fragment)
      return content;
    else if (Array.isArray(content))
      return new _Fragment(content);
    else
      return new _Fragment([content]);
  }
};
__publicField$3(_Fragment, "empty", new _Fragment([], 0));
let Fragment = _Fragment;
function replaceOuter(from, to, slice, depth = 0) {
  const node = from.node(depth);
  const index = from.index(depth);
  if (index === to.index(depth) && depth < from.depth - slice.openStart) {
    const inner = replaceOuter(from, to, slice, depth + 1);
    const child = node.content.child(index).copy(inner);
    return node.content.replaceChild(child, index);
  } else if (slice.size === 0) {
    return node.content.remove(from.relative(depth), to.relative(depth));
  } else if (slice.openStart === 0 && slice.openEnd === 0 && from.depth === depth && to.depth === depth) {
    return node.content.cut(0, from.relative(depth)).append(slice.content, node.content.cut(to.relative(depth)));
  } else ;
  throw new NotImplementedError("Fragment.replace", true);
}

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => {
  __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const definitions = {};
class NodeType {
  constructor(name, schema, meta, extend) {
    this.name = name;
    this.schema = schema;
    this.meta = meta;
    this.extend = extend;
    /**
     * If this node is visible for creation by the end user.
     * Will be false if meta is not provided or `meta.visible` is not set to true.
     */
    __publicField$2(this, "visible");
    /**
     * The node class that represents this node type.
     */
    __publicField$2(this, "node");
    if (definitions[name] !== void 0)
      throw new MethodError(
        `NodeType with name ${name}, already exists. If overriding this was intentional, use NodeType.override.`,
        "NodeType.constructor"
      );
    this.visible = meta === void 0 || meta.visible !== true;
    definitions[name] = this;
  }
  static from(type) {
    return stack("NodeType.from")(new NodeType(type.name, type.schema, type.meta));
  }
  /**
   * Extends an existing type and changes only specified properties.
   * A different name is still required and the meta will not be extended,
   * so it needs to be specified again for it to be visible to the end user.
   *
   * @param other The NodeType to override
   * @param type The new (partial) type definition
   */
  static extend(other, type) {
    if (typeof other === "string") {
      const found = definitions[other];
      if (!found)
        throw new MethodError(
          `Tried extending the NodeType ${other}, but it doesn't exist or has not been created yet, make sure the nodeTypes are created in the correct order`,
          "NodeType.extend"
        );
      other = found;
    }
    if (!type.schema)
      return new NodeType(type.name, other.schema, type.meta, other.name);
    for (const prop in other.schema) {
      const key = prop;
      if (type.schema[key] === void 0)
        type.schema[key] = other.schema[key];
    }
    return new NodeType(type.name, type.schema, type.meta, other.name);
  }
  /**
   * Overrides an existing type with a new definition.
   * This can be used to overwrite the default text node for example.
   *
   * @param type The type definition for the node type
   */
  static override(type) {
    if (definitions[type.name] === void 0)
      throw new MethodError(
        `Tried overriding the NodeType ${type.name}, but it doesn't exist or has not been created yet, make sure the nodeTypes are created in the correct order`,
        "NodeType.override"
      );
    definitions[type.name] = void 0;
    return new NodeType(type.name, type.schema, type.meta);
  }
  static get(name) {
    return definitions[name];
  }
  static get all() {
    return definitions;
  }
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class RelativePosition {
  constructor(anchor, location, offset) {
    this.anchor = anchor;
    this.location = location;
    __publicField$1(this, "offset", 0);
    if (typeof offset === "number")
      this.offset = offset;
    else if (location === "childIndex")
      this.offset = anchor.content.nodes.length;
    else if (location === "childOffset")
      this.offset = anchor.content.size;
  }
  resolve(boundary) {
    const locate = locateNode(boundary, this.anchor);
    if (!locate)
      return;
    const parent = locate.steps[locate.steps.length - 2];
    const found = locate.steps[locate.steps.length - 1];
    let offset = 0;
    if (this.location === "after" || this.location === "before") {
      if (found.node === locate.boundary)
        throw new MethodError("Can't resolve a position before or after the boundary node", "RelativePosition.resolve");
      if (found.index > 0)
        for (const [child, i] of parent.node.content.iter())
          if (i === found.index)
            break;
          else
            offset += child.nodeSize;
      if (this.location === "after")
        offset += this.anchor.nodeSize;
      return new Position(boundary, found.depth, parent.node, offset, popSteps(locate));
    } else if (this.location === "childIndex" || this.location === "childOffset") {
      if (this.location === "childIndex")
        offset = Position.indexToOffset(this.anchor, this.offset);
      else
        offset = this.offset;
      return new Position(boundary, found.depth + 1, this.anchor, offset, locate);
    }
  }
}
class Position {
  constructor(boundary, depth, parent, offset, steps) {
    this.boundary = boundary;
    this.depth = depth;
    this.parent = parent;
    this.offset = offset;
    this.steps = steps;
  }
  resolveDepth(depth) {
    if (depth === void 0)
      return this.depth;
    else if (depth < 0)
      return this.depth + depth;
    else
      return depth;
  }
  /**
   * Returns the parent node at `depth`.
   *
   * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
   */
  node(depth) {
    return this.steps.steps[this.resolveDepth(depth)].node;
  }
  /**
   * The index in the parent node at `depth`.
   *
   * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
   */
  index(depth) {
    return this.steps.steps[this.resolveDepth(depth)].index;
  }
  /**
   * Returns the absolute position, where the parent node at `depth` starts.
   *
   * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
   */
  start(depth) {
    depth = this.resolveDepth(depth);
    const existing = this.steps.steps[depth];
    if (existing.pos !== void 0)
      return existing.pos;
    const res = this.boundary.content.offset(this.node(depth));
    if (!res)
      throw new MethodError(`Failed to get the absolute position of node at depth ${depth}`, "Position.start");
    return res;
  }
  /**
   * Returns the absolute position, where the parent node at `depth` ends.
   *
   * @param depth The depth where to search, leave empty for the current depth, or a negative number to count back from the current depth.
   */
  end(depth) {
    return this.start(depth) + this.node(depth).content.size;
  }
  /**
   * Returns the relative offset to `node`.
   * @param node The depth of a parent node of this position, or a node in this boundary.
   * @returns The relative position to node, will be undefined if this position is before `node`. Or undefined if node cannot be resolved in the same document as this position.
   */
  relative(node) {
    let pos;
    if (typeof node === "number")
      pos = this.start(node);
    else
      pos = this.boundary.content.offset(node);
    if (!pos)
      throw new MethodError("Failed to get the absolute position of node in the current boundary", "Position.relative");
    return this.toAbsolute() - pos;
  }
  /**
   * Gets the depth of the deepest common parent between two positions.
   * @returns The depth of the deepest common parent.
   * @throws If the two positions are in different boundaries.
   */
  commonDepth(pos) {
    const common = findCommonParent(this, pos);
    if (!common)
      throw new MethodError("Failed to find a common parent between the two positions", "Position.commonDepth");
    return common.depth;
  }
  /**
   * Gets the deepest common parent between two positions.
   * @returns The common parent node, or undefind if it failed.
   * @throws If the two positions are in different boundaries.
   */
  commonParent(pos) {
    const d = this.commonDepth(pos);
    return d === void 0 ? d : this.node(d);
  }
  /**
   * Converts this position to an absolute position in the Position's boundary.
   * @returns The absolute position
   */
  toAbsolute() {
    const existing = this.steps.steps[this.steps.steps.length - 1];
    if (existing?.pos)
      return existing.pos + this.offset + 1;
    let pos = 0;
    for (let i = 1; i < this.steps.steps.length; i++) {
      const parent = this.steps.steps[i - 1];
      const step = this.steps.steps[i];
      if (i > 1)
        pos += 1;
      pos += Position.indexToOffset(parent.node, step.index);
    }
    if (pos === 0)
      return pos + this.offset;
    else
      return pos + 1 + this.offset;
  }
  // static methods
  static resolve(boundary, pos) {
    if (pos instanceof Position)
      return pos;
    else if (pos instanceof RelativePosition)
      return pos.resolve(boundary);
    else
      return Position.absoluteToPosition(boundary, pos);
  }
  /**
   * Converts an absolute position to a resolved `Position`
   * @param boundary The boundary where to resolve the absolute position
   * @param pos The absolute position to resolve
   * @returns The resolved position, or undefined if it failed.
   */
  static absoluteToPosition(boundary, pos) {
    if (pos < 0 || pos > boundary.nodeSize)
      return;
    else if (pos === 0)
      return new Position(boundary, 0, boundary, 0, {
        boundary,
        steps: [{ node: boundary, depth: 0, index: 0 }]
      });
    const steps = [];
    const deepestOffset = (node, depth, offset) => {
      if (offset === 0)
        return { depth, parent: node, offset: 0 };
      else if (node.content.nodes.length === 0 && offset === 1)
        return { depth, parent: node, offset: 1 };
      let nodeOffset = 0;
      for (const [c, i] of node.content.iter()) {
        if (offset > c.nodeSize) {
          offset -= c.nodeSize;
          nodeOffset += offset;
          continue;
        } else if (offset === 0)
          return { depth, parent: node, offset: nodeOffset };
        else if (offset === c.nodeSize)
          return { depth, parent: node, offset: nodeOffset + c.nodeSize };
        steps.push({ node: c, index: i, depth, pos: pos - offset });
        return deepestOffset(c, depth + 1, offset - 1);
      }
      return;
    };
    steps.push({ node: boundary, index: 0, depth: 0, pos: 0 });
    const res = deepestOffset(boundary, 1, pos);
    if (!res)
      return;
    const locate = { boundary, steps };
    return new Position(boundary, res.depth, res.parent, res.offset, locate);
  }
  /**
   * Converts a position to an absolute position in the Position's boundary.
   * @returns The absolute position, or undefined if it failed.
   */
  static positionToAbsolute(pos) {
    return typeof pos === "number" ? pos : pos.toAbsolute();
  }
  /**
   * Converts an index to an offset in a node
   * @param parent The node to use as parent
   * @param index The index to convert to an offset
   */
  static indexToOffset(parent, index) {
    const content = parent instanceof Node ? parent.content : parent;
    if (index === void 0)
      index = content.nodes.length;
    else if (index < 0)
      index = content.nodes.length + index;
    if (index === 0)
      return 0;
    let offset = 0;
    for (const [child, i] of content.iter())
      if (i === index)
        break;
      else
        offset += child.nodeSize;
    return offset;
  }
  static offsetToIndex(parent, offset, advanced) {
    const decide = (a, b) => advanced === true ? b : a;
    if (offset === 0)
      return decide(0, { index: 0, offset: 0 });
    const content = parent instanceof Node ? parent.content : parent;
    if (offset < 0 || offset > content.size)
      throw new MethodError(`The offset ${offset}, is outside of the allowed range`, "Position.offsetToIndex");
    let pos = 0;
    for (const [child, i] of content.iter()) {
      if (offset === pos)
        return decide(i, { index: i, offset: 0 });
      pos += child.nodeSize;
      if (pos > offset)
        return decide(void 0, { index: i, offset: pos - offset });
    }
    if (offset === pos)
      return decide(content.nodes.length, {
        index: content.nodes.length,
        offset: 0
      });
  }
  /**
   * Returns a boolean indicating wheter or not `pos` is a resolved Position
   */
  static is(pos) {
    if (pos instanceof Position)
      return true;
    else
      return false;
  }
  // static init methods
  /**
   * Creates a position that resolves before `anchor`
   */
  static before(anchor) {
    return new RelativePosition(anchor, "before");
  }
  /**
   * Creates a position that resolves after `anchor`
   */
  static after(anchor) {
    return new RelativePosition(anchor, "after");
  }
  /**
   * Creates a position that resolves as a child of `anchor` at index `index`, this is guaranteed to resolve as a direct child of the `anchor` (it cannot cut an existing node in half)
   * @param index The index where to resolve, leave empty for last item, and negative index to start from the last child
   */
  static child(anchor, index) {
    return new RelativePosition(anchor, "childIndex", index);
  }
  /**
   * Creates a position that resolves as a child of `anchor` at offset `offset`
   * @param offset The offset into the parent
   */
  static offset(anchor, offset) {
    return new RelativePosition(anchor, "childOffset", offset);
  }
  // TODO: Figure out how to implement to and from json, as we need a reference to the boundary node (probably via the id, and create a function that creates or finds a node with same id in document)
}
function popSteps(data) {
  data.steps = data.steps.slice(0, -1);
  return data;
}
function locateNode(boundary, node) {
  if (boundary === node) {
    const step = {
      depth: 0,
      index: 0,
      node: boundary
    };
    return {
      boundary,
      steps: [step]
    };
  }
  const res = bfsSteps(boundary, 0, 0, node);
  if (res)
    return { boundary, steps: res };
}
function bfsSteps(node, nodeIndex, depth, search) {
  const a = [];
  for (const [child, i] of node.content.iter()) {
    if (search === child)
      return [
        { depth, node, index: nodeIndex },
        { depth: depth + 1, node: child, index: i }
      ];
    else
      a.push([child, i]);
  }
  for (const [c, i] of a) {
    const res = bfsSteps(c, i, depth + 1, search);
    if (res) {
      res.unshift({
        depth,
        node,
        index: nodeIndex
      });
      return res;
    }
  }
}
function findCommonParent(from, to) {
  if (from.boundary !== to.boundary)
    return;
  const depth = findDeepestCommonParent(from, to, 0);
  if (!depth)
    return;
  return {
    ...depth,
    boundary: from.boundary
  };
}
function findDeepestCommonParent(from, to, depth) {
  if (!from.steps.steps[depth] || !to.steps.steps[depth])
    return void 0;
  else if (from.steps.steps[depth].node === to.steps.steps[depth].node) {
    const res = findDeepestCommonParent(from, to, depth + 1);
    if (res)
      return res;
    else
      return from.steps.steps[depth];
  }
  return void 0;
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class Node {
  // also add marks later
  constructor(content) {
    __publicField(this, "type");
    __publicField(this, "id");
    /**
     * This node's children
     */
    __publicField(this, "content");
    /**
     * The text content if this node is a text node, or `null` otherwise.
     * This is used to determine if a node is a text node or not.
     */
    __publicField(this, "text", null);
    __publicField(this, "resolveCache", {});
    this.type = this.constructor.type;
    if (typeof content === "string")
      throw new MethodError(
        `The node type ${this.type.name}, needs to override the constructor method to support inserting text content, as the default implementation does not support it`,
        "Node.constructor"
      );
    if (this.type.node !== void 0 && this.type.node !== this.constructor)
      throw new MethodError(
        `A different node definition for the type ${this.type.name}, already exists`,
        "Node.constructor"
      );
    this.type.node = this.constructor;
    this.id = Math.random().toString(36).slice(2);
    this.content = content || new Fragment([]);
  }
  /**
   * The string representation of the content
   */
  get textContent() {
    let content = "";
    for (const [n] of this.content.iter())
      content += n.textContent;
    return content;
  }
  get nodeSize() {
    if (this.text !== null)
      return this.text.length;
    else if (this.type.schema.inline === true)
      return 1;
    else
      return this.content.size + 2;
  }
  get childCount() {
    return this.content.childCount;
  }
  child(index) {
    return this.content.child(index);
  }
  /**
   * Inserts the content at the given offset.
   *
   * @returns The modified node
   * @throws {MethodError} If the node type doesn't support text content and the content argument is of type string.
   */
  insert(offset, content) {
    if (typeof content === "string")
      throw new MethodError(
        `The node type ${this.type.name}, needs to override the insert method to support inserting text content, as the default implementation does not support it`,
        "Node.insert"
      );
    const { index, offset: o } = Position.offsetToIndex(this, offset, true);
    if (o === 0)
      return this.copy(this.content.insert(content, index));
    throw new NotImplementedError("Node.insert", true);
  }
  /**
   * Changes this nodes content to only include the content between the given positions.
   * This does not cut non-text nodes in half, meaning if the starting position is inside of a node, that entire node is included.
   */
  cut(from, to = this.content.size) {
    if (from === 0 && to === this.content.size)
      return this;
    return this.copy(this.content.cut(from, to));
  }
  /**
   * Removes the content between the given positions.
   *
   * @returns The modified node
   * @throws {MethodError} If one or more of the positions are outside of the allowed range.
   */
  remove(from, to = this.content.size) {
    if (from < 0 || to > this.content.size)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Node.remove"
      );
    if (from === to)
      return this;
    return this.copy(this.content.remove(from, to));
  }
  /**
   * Replaces the selection with the provided slice, if it fits.
   *
   * @param slice The slice to replace the selection with, or a string if this node is a text node.
   * @throws {MethodError} If the node type doesn't support text content and the slice argument is of type string.
   */
  replace(from, to, slice) {
    if (typeof slice === "string")
      throw new MethodError(
        `The node type ${this.type.name}, needs to override the replace method to support inserting text content, as the default implementation does not support it`,
        "Node.replace"
      );
    if (slice.size === 0 && from === to)
      return this;
    else
      return this.copy(this.content.replace(from, to, slice, this));
  }
  /**
   * Resolves a position inside this nodes, using `Position.resolve`.
   * The result is cached, so calling this method multiple times with the same position will return the cached position.
   *
   * @param pos The absolute position inside this node to resolve
   * @returns The resolved position if successful, or `undefined` if resolving failed.
   * @throws {MethodError} If the position is outside of the allowed range or it could not be resolved by `Position.resolve`.
   */
  resolve(pos) {
    if (pos < 0 || pos > this.nodeSize)
      throw new MethodError(
        `The position ${pos}, is outside of the allowed range`,
        "Node.resolve"
      );
    if (this.resolveCache[pos] !== void 0)
      return this.resolveCache[pos];
    const res = Position.resolve(this, pos);
    if (!res)
      throw new MethodError(
        `The position ${pos}, could not be resolved`,
        "Node.resolve"
      );
    return this.resolveCache[pos] = res;
  }
  /**
   * Resolves a position inside this nodes, using `Position.resolve`.
   * Unlike `Node.resolve`, this method does not cache the result,
   * so calling this multiple times with the same position is more expensive.
   *
   * @param pos The absolute position inside this node to resolve
   * @returns The resolved position if successful, or `undefined` if resolving failed.
   * @throws {MethodError} If the position is outside of the allowed range
   */
  resolveNoCache(pos) {
    if (pos < 0 || pos > this.nodeSize)
      throw new MethodError(
        `The position ${pos}, is outside of the allowed range`,
        "Node.resolveNoCache"
      );
    return Position.resolve(this, pos);
  }
  /**
   * Checks if `other` is equal to this node
   * @param other The node to check
   */
  eq(other) {
    if (this === other)
      return true;
    return this.content.eq(other.content);
  }
  /**
   * Creates a deep copy of this node.
   * It does this by calling the copy method on the content fragment,
   * if this node has differnt behaviour it should override this function.
   */
  copy(content) {
    if (content === this.content)
      return this;
    return this.new(content, true);
  }
  /**
   * Creates a new instance of this node type.
   * E.g when calling this on a Paragraph, it creates a new Paragraph node.
   * @throws {MethodError} If the node type doesn't support text content and the content argument is of type string.
   */
  new(content, keepId) {
    if (typeof content === "string" && this.text === null)
      throw new MethodError(
        `The node type ${this.type.name}, doesn't support text content`,
        "Node.new"
      );
    const Class = this.constructor;
    const inst = new Class(content);
    if (keepId)
      inst.id = this.id;
    return inst;
  }
  toString() {
    if (this.content.size === 0)
      return this.type.name;
    return `${this.type.name}(${this.content.toString().slice(1, -1)})`;
  }
  toJSON() {
    return {
      id: this.id,
      type: this.type.name,
      content: this.content.toJSON()
    };
  }
}
__publicField(Node, "type");
class Text extends Node {
  get textContent() {
    return this.text;
  }
  get nodeSize() {
    return this.text.length;
  }
  constructor(content) {
    super(void 0);
    if (!content)
      throw new MethodError(
        "Empty text nodes are not allowed",
        "Text.constructor"
      );
    this.text = content;
  }
  child(index) {
    throw new MethodError(
      "Can't call the Node.child method on a text node",
      "Text.child"
    );
  }
  insert(offset, content) {
    return this.replace(offset, offset, content);
  }
  cut(from, to) {
    if (from < 0 || to && to > this.text.length)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Text.cut"
      );
    return this.copy(this.text.slice(from, to));
  }
  remove(from, to = this.text.length) {
    if (from < 0 || to > this.text.length)
      throw new MethodError(
        `One or more of the positions ${from} and ${to} are outside of the allowed range`,
        "Text.remove"
      );
    return this.copy(this.text.slice(0, from) + this.text.slice(to));
  }
  replace(from, to, slice) {
    return this.copy(this.text.slice(0, from) + slice + this.text.slice(to));
  }
  resolve(pos) {
    if (pos < 0 || pos > this.nodeSize)
      throw new MethodError(
        `The position ${pos}, is outside of the allowed range`,
        "Text.resolve"
      );
    throw new MethodError(
      `The position ${pos}, cannot be resolved inside a text node`,
      "Text.resolve"
    );
  }
  copy(content) {
    if (content === this.text)
      return this;
    return this.new(content, true);
  }
  toString() {
    return `"${this.text}"`;
  }
}
__publicField(Text, "type", NodeType.from({
  name: "text",
  schema: {
    group: "inline",
    inline: true
  }
}));

export { Fragment, Node, NodeType, Position, Text, locateNode };
