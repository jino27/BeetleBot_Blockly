import * as Blockly from "blockly/core";
import { BLOCK_TYPES } from "../blocks/beetlebot_blocks";
//import { inputTypes } from "blockly/core/inputs/input_types";

export interface BlockTreeNode {
  type: string;
  kind: "statement" | "value";
  fields?: Record<string, string | number>;
  inputs?: Record<string, BlockTreeNode | BlockTreeNode[]>;
  //children?: BlockTreeNode[];
}

const STATEMENT_BLOCK_TYPES = new Set<string>([
  BLOCK_TYPES.GO_FORWARD,
  BLOCK_TYPES.GO_BACKWARD,
  BLOCK_TYPES.TURN_LEFT,
  BLOCK_TYPES.TURN_RIGHT,
  BLOCK_TYPES.TURN_LEFT_ANGLE,
  BLOCK_TYPES.TURN_RIGHT_ANGLE,
  BLOCK_TYPES.STOP,
  BLOCK_TYPES.GRAB,
  BLOCK_TYPES.RELEASE,
  BLOCK_TYPES.WAIT,
  BLOCK_TYPES.REPEAT,
  BLOCK_TYPES.WHILE,
  BLOCK_TYPES.REPEAT_UNTIL,
  BLOCK_TYPES.COUNT_WITH,
  BLOCK_TYPES.BREAK,
  BLOCK_TYPES.IF,
  BLOCK_TYPES.IF_ELSE,
  BLOCK_TYPES.VARIABLE_SET,
  BLOCK_TYPES.VARIABLE_CHANGE,
  BLOCK_TYPES.VARIABLE_INCREMENT,
  BLOCK_TYPES.VARIABLE_DECREMENT,
]);

const VALUE_BLOCK_TYPES = new Set<string>([
  BLOCK_TYPES.READ_DISTANCE,
  BLOCK_TYPES.DISTANCE_CHECK,
  BLOCK_TYPES.COMPARE,
  BLOCK_TYPES.LOGIC_AND,
  BLOCK_TYPES.LOGIC_OR,
  BLOCK_TYPES.LOGIC_NOT,
  BLOCK_TYPES.TRUE,
  BLOCK_TYPES.FALSE,
  BLOCK_TYPES.VARIABLE_GET,
]);

const COMPARISON_OPS: Record<string, string> = {
  EQ: "===",
  GT: ">",
  LT: "<",
  GTE: ">=",
  LTE: "<=",
  NEQ: "!==",
};

function serializeCondition(block: Blockly.Block): string {
  const type = block.type;

  if (type === BLOCK_TYPES.COMPARE) {
    const op = block.getFieldValue("OP") || "EQ";
    const leftBlock = block.getInputTargetBlock("A");
    const rightBlock = block.getInputTargetBlock("B");
    const left = leftBlock ? serializeCondition(leftBlock) : "";
    const right = rightBlock ? serializeCondition(rightBlock) : "";
    return `${left} ${COMPARISON_OPS[op] || op} ${right}`;
  }

  if (type === BLOCK_TYPES.LOGIC_AND) {
    const leftBlock = block.getInputTargetBlock("A");
    const rightBlock = block.getInputTargetBlock("B");
    const left = leftBlock ? serializeCondition(leftBlock) : "false";
    const right = rightBlock ? serializeCondition(rightBlock) : "false";
    return `(${left} && ${right})`;
  }

  if (type === BLOCK_TYPES.LOGIC_OR) {
    const leftBlock = block.getInputTargetBlock("A");
    const rightBlock = block.getInputTargetBlock("B");
    const left = leftBlock ? serializeCondition(leftBlock) : "false";
    const right = rightBlock ? serializeCondition(rightBlock) : "false";
    return `(${left} || ${right})`;
  }

  if (type === BLOCK_TYPES.LOGIC_NOT) {
    const boolBlock = block.getInputTargetBlock("BOOL");
    const bool = boolBlock ? serializeCondition(boolBlock) : "false";
    return `!${bool}`;
  }

  if (type === BLOCK_TYPES.TRUE) {
    return "true";
  }

  if (type === BLOCK_TYPES.FALSE) {
    return "false";
  }

  if (type === BLOCK_TYPES.READ_DISTANCE) {
    return "getDistance()";
  }

  if (type === BLOCK_TYPES.VARIABLE_GET) {
    const varName = block.getFieldValue("VAR_NAME") || "counter";
    const safeName = varName.replace(/[^a-zA-Z0-9_]/g, "_");
    return safeName;
  }

  return "";
}

function blockToTreeNode(block: Blockly.Block): BlockTreeNode {
  const type = block.type;
  const kind = STATEMENT_BLOCK_TYPES.has(type) ? "statement" : "value";

  const node: BlockTreeNode = {
    type,
    kind,
  };

  // Collect fields
  const fields: Record<string, string | number> = {};
  for (const input of block.inputList) {
    for (const field of input.fieldRow) {
      if (field && field.name) {
        const value = field.getValue();
        if (value !== null && value !== undefined) {
          fields[field.name] = value;
        }
      }
    }
  }
  if (Object.keys(fields).length > 0) {
    node.fields = fields;
  }

  // Process inputs
  const inputs: Record<string, BlockTreeNode | BlockTreeNode[]> = {};

for (const input of block.inputList) {
    if (!input.name) continue;

    const targetBlock = input.connection?.targetBlock();
    if (targetBlock) {
      if (input.connection?.type === Blockly.NEXT_STATEMENT) {
        // Statement input (DO, ELSE) - collect chain of statements
        const statements: BlockTreeNode[] = [];
        let current: Blockly.Block | null = targetBlock;
        while (current) {
          statements.push(blockToTreeNode(current));
          current = current.getNextBlock();
        }
        if (statements.length > 0) {
          inputs[input.name] = statements;
        }
      } else if (input.connection?.type === Blockly.INPUT_VALUE) {
        // Value input - single block
        inputs[input.name] = blockToTreeNode(targetBlock);
      }
    }
  }

  if (Object.keys(inputs).length > 0) {
    node.inputs = inputs;
  }

  // // Also check nextStatement (for statement blocks chained together)
  // const nextBlock = block.getNextBlock();
  // if (nextBlock && STATEMENT_BLOCK_TYPES.has(type)) {
  //   if (!node.children) node.children = [];
  //   node.children.push(blockToTreeNode(nextBlock));
  // }

  return node;
}

export function blocklyToBlockTree(workspace: Blockly.Workspace): BlockTreeNode[] {
  const topBlocks = workspace.getTopBlocks();
  const tree: BlockTreeNode[] = [];

  for (const block of topBlocks) {
    if (block.type === BLOCK_TYPES.WHEN_START) {
      // Skip the "when start" hat block, process its children
      const childBlock = block.getNextBlock();
      if (childBlock) {
        let current: Blockly.Block | null = childBlock;
        while (current) {
          tree.push(blockToTreeNode(current));
          current = current.getNextBlock();
        }
      }
    } else {
      let current: Blockly.Block | null = block;
      while (current) {
        tree.push(blockToTreeNode(current));
        current = current.getNextBlock();
      }
    }
  }

  return tree;
}