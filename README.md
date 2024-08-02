# Structure

- `behaviour`, this directory contains all the editor behaviour
- `components`, the block types in the editor, including helper components for those blocks
- `lib`, the core of the editor logic
- `modules`, editor modules are parts that acts as a bridge between the ui and the logic
- `nodes`, the editor nodes

### Nodes

Nodes are the building blocks of the editor, a node represents a block or an inline node.
Blocks can hold other blocks and nodes as content.

A Block is a 'line' of the editor (e.g. text, image, etc.),
some of these blocks can contain nodes, nodes are text-editable parts that can live in an input

### Marks

Marks are applied on inline (text) nodes, to define the formatting/styling of the node, e.g. bold, italic, etc.

# Input strategy

Always keep a document state, on input event calculate what changed compared to last state 
and update the state to reflect input event via a `Transaction`.

# TODO

- Change the editor to be platform agnostic (aka don't rely on dom methods)?