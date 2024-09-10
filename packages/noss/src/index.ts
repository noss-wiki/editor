export { Fragment } from "./model/fragment";
export { Node, AttrNode, Text } from "./model/node";
export type {
  NodeMeta,
  NodeSchema,
  NodeTypeDefinition,
} from "./model/nodeType";
export { NodeType } from "./model/nodeType";
export { NodeView, TextView } from "./model/nodeView";
export { Position, locateNode, getParentNode } from "./model/position";
export { Selection } from "./model/selection";
export { Slice } from "./model/slice";
export { EditorView } from "./model/view";
export type { View } from "./model/view";

export { EditorState, constructDocument } from "./state";
export type { Change } from "./state/diff";
export { Diff, ChangeKind, ChangeType } from "./state/diff";
export { Transaction } from "./state/transaction";
export { Step } from "./state/step";
export { InsertStep, InsertTextStep } from "./state/steps/insert";
export { RemoveStep, RemoveTextStep } from "./state/steps/remove";
