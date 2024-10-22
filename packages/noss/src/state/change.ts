import type { Result } from "@noss-editor/utils";
import type { Node } from "../model/node";
import { Err, Ok, wrap } from "@noss-editor/utils";
import { locateNode } from "../model/position";

export type Change = InsertChange | RemoveChange | ReplaceChange;

export enum ChangeType {
  insert = "insert",
  remove = "remove",
  replace = "replace",
}

export type NodeMap = [Node, Node][];

interface BaseChange {
  readonly type: ChangeType;
  readonly old?: Node;
  readonly modified?: Node;
  readonly oldParent?: Node;
  readonly modifiedParent?: Node;

  reconstruct(boundary: Node): Result<Node, string>;
  /**
   * Given the old and modified boundary, construct a map of change nodes, that link to the new nodes.
   */
  constructNodeMap(oldBoundary: Node, modifiedBoundary: Node): Result<NodeMap, string>;
  /**
   * Tries to map `node` from the `oldBoundary` to `modifiedBoundary`.
   * @param node The node to map.
   * @param oldBoundary The boundary in which `node` is located.
   * @parem modifiedBoundary The boundary to which `node` should be mapped.
   * @returns An Ok with the mapped node, is null if the node was removed (which can only occur on a `RemoveChange`), or an Err.
   */
  map(node: Node): Result<Node | null, string>;
}

export class InsertChange implements BaseChange {
  readonly type = ChangeType.insert;
  readonly old: undefined;
  private nodeMap?: NodeMap;

  constructor(
    readonly modified: Node,
    readonly oldParent: Node,
    readonly modifiedParent: Node,
    readonly index: number,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.oldParent === boundary)
      return wrap(() => boundary.content.insert(this.modified, this.index))
        .map((c) => boundary.copy(c))
        .trace("InsertChange.reconstruct");

    return wrap(() =>
      boundary.content.replaceChildRecursive(
        this.oldParent,
        this.oldParent.copy(this.oldParent.content.insert(this.modified, this.index)),
      ),
    )
      .map((c) => boundary.copy(c))
      .trace("InsertChange.reconstruct");
  }

  constructNodeMap(oldBoundary: Node, modifiedBoundary: Node): Result<NodeMap, string> {
    return constructNodeMap(this.oldParent, oldBoundary, modifiedBoundary)
      .map((map) => {
        this.nodeMap = map;
        return this.nodeMap;
      })
      .trace("InsertChange.constructNodeMap");
  }

  map(node: Node): Result<Node, string> {
    if (!this.nodeMap)
      return Err("No nodeMap found, call constructNodeMap before calling this method", "InsertChange.map");

    const mapped = this.nodeMap.find(([old]) => old === node);
    if (mapped) return Ok(mapped[1]);
    else return Ok(node);
  }
}

export class RemoveChange implements BaseChange {
  readonly type = ChangeType.remove;
  readonly modified: undefined;
  private nodeMap?: NodeMap;

  constructor(
    readonly old: Node,
    readonly oldParent: Node,
    readonly modifiedParent: Node,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.oldParent === boundary)
      return wrap(() => boundary.content.remove(this.old))
        .map((c) => boundary.copy(c))
        .trace("RemoveChange.reconstruct");

    return wrap(() =>
      boundary.content.replaceChildRecursive(
        this.oldParent,
        this.oldParent.copy(this.oldParent.content.remove(this.old)),
      ),
    )
      .map((c) => boundary.copy(c))
      .trace("RemoveChange.reconstruct");
  }

  constructNodeMap(oldBoundary: Node, modifiedBoundary: Node): Result<NodeMap, string> {
    return constructNodeMap(this.oldParent, oldBoundary, modifiedBoundary)
      .map((map) => {
        this.nodeMap = map;
        return this.nodeMap;
      })
      .trace("RemoveChange.constructNodeMap");
  }

  map(node: Node): Result<Node | null, string> {
    if (!this.nodeMap)
      return Err("No nodeMap found, call constructNodeMap before calling this method", "RemoveChange.map");
    else if (node === this.old) return Ok(null);

    const mapped = this.nodeMap.find(([old]) => old === node);
    if (mapped) return Ok(mapped[1]);
    else return Ok(node);
  }
}

export class ReplaceChange implements BaseChange {
  readonly type = ChangeType.replace;
  private nodeMap?: NodeMap;

  constructor(
    readonly old: Node,
    readonly modified: Node,
  ) {}

  reconstruct(boundary: Node): Result<Node, string> {
    if (this.old === boundary) return Ok(this.modified);
    return wrap(() => boundary.content.replaceChildRecursive(this.old, this.modified)) //
      .map((c) => boundary.copy(c))
      .trace("ReplaceChange.reconstruct");
  }

  constructNodeMap(oldBoundary: Node, modifiedBoundary: Node): Result<NodeMap, string> {
    return constructNodeMap(this.old, oldBoundary, modifiedBoundary)
      .map((map) => {
        this.nodeMap = map;
        return this.nodeMap;
      })
      .trace("ReplaceChange.constructNodeMap");
  }

  map(node: Node): Result<Node, string> {
    if (!this.nodeMap)
      return Err("No nodeMap found, call constructNodeMap before calling this method", "ReplaceChange.map");

    const mapped = this.nodeMap.find(([old]) => old === node);
    if (mapped) return Ok(mapped[1]);
    else return Ok(node);
  }
}

function constructNodeMap(oldNode: Node, oldBoundary: Node, modifiedBoundary: Node): Result<NodeMap, string> {
  const locate = locateNode(oldBoundary, oldNode);
  if (locate.err) return locate;

  const map: NodeMap = [[oldBoundary, modifiedBoundary]];
  let last = modifiedBoundary;
  for (const step of locate.val.steps.slice(1)) {
    const i = step.index;
    const child = last.content.softChild(i);
    if (!child) return Err("Failed to retrace steps in new boundary; index doesn't exist");
    map.push([step.node, child]);
    last = child;
  }

  return Ok(map);
}
