import * as Blockly from "blockly/core";
import { javascriptGenerator, Order } from "blockly/javascript";
import { BLOCK_TYPES } from "../blocks/beetlebot_blocks";

export interface CommandItem {
  cmd: string;
  val?: number;
  ms?: number;
}

export function initBeetleBotGenerator(): void {
  // ========================================================================
  // 🚗 MOVEMENT
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.GO_FORWARD] = () =>
    `queue.push({cmd:"F"});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.GO_BACKWARD] = () =>
    `queue.push({cmd:"B"});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_LEFT] = () =>
    `queue.push({cmd:"TURN:L:90"});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_RIGHT] = () =>
    `queue.push({cmd:"TURN:R:90"});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_LEFT_ANGLE] = (block) => {
    const angle = Math.max(
      1,
      Math.min(360, Math.round(Number(block.getFieldValue("ANGLE") || 90))),
    );
    return `queue.push({cmd:"TURN:L:${angle}"});\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_RIGHT_ANGLE] = (block) => {
    const angle = Math.max(
      1,
      Math.min(360, Math.round(Number(block.getFieldValue("ANGLE") || 90))),
    );
    return `queue.push({cmd:"TURN:R:${angle}"});\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.STOP] = () =>
    `queue.push({cmd:"S"});\n`;

  // ========================================================================
  // 🤖 ACTIONS
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.GRAB] = () =>
    `queue.push({cmd:"C"});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.RELEASE] = () =>
    `queue.push({cmd:"O"});\n`;

  // ========================================================================
  // ⏱️ TIME
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.WAIT] = (block) => {
    const seconds = Math.max(
      1,
      Math.min(60, Math.round(Number(block.getFieldValue("SECONDS") || 1))),
    );
    return `queue.push({cmd:"WAIT", ms:${seconds * 1000}});\n`;
  };

  // ========================================================================
  // 🔄 LOOPS
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.REPEAT] = (block, generator) => {
    const times = Math.max(
      1,
      Math.min(100, Math.round(Number(block.getFieldValue("TIMES") || 5))),
    );
    const branch = generator.statementToCode(block, "DO");
    let code = "";
    for (let i = 0; i < times; i++) {
      code += branch;
    }
    return code;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.WHILE] = (block, generator) => {
    const condition =
      generator.valueToCode(block, "CONDITION", Order.NONE) || "false";
    const branch = generator.statementToCode(block, "DO");
    // Safety limit: max 10 iterations to prevent infinite loops and huge queues
    return `for (let _i = 0; _i < 10 && (${condition}); _i++) {\n${branch}}\n`;
  };

  // ========================================================================
  // 🧠 DECISIONS
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.IF] = (block, generator) => {
    const condition =
      generator.valueToCode(block, "CONDITION", Order.NONE) || "false";
    const branch = generator.statementToCode(block, "DO");
    return `if (${condition}) {\n${branch}}\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.IF_ELSE] = (block, generator) => {
    const condition =
      generator.valueToCode(block, "CONDITION", Order.NONE) || "false";
    const ifBranch = generator.statementToCode(block, "DO");
    const elseBranch = generator.statementToCode(block, "ELSE");
    return `if (${condition}) {\n${ifBranch}} else {\n${elseBranch}}\n`;
  };

  // ========================================================================
  // 🔀 LOGIC
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.COMPARE] = (block, generator) => {
    const op = block.getFieldValue("OP") || "EQ";
    const left = generator.valueToCode(block, "A", Order.NONE) || "0";
    const right = generator.valueToCode(block, "B", Order.NONE) || "0";

    const operators: Record<string, string> = {
      EQ: "===",
      GT: ">",
      LT: "<",
      GTE: ">=",
      LTE: "<=",
      NEQ: "!==",
    };

    const code = `${left} ${operators[op]} ${right}`;
    return [code, Order.RELATIONAL];
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.LOGIC_AND] = (block, generator) => {
    const left = generator.valueToCode(block, "A", Order.NONE) || "false";
    const right = generator.valueToCode(block, "B", Order.NONE) || "false";
    return [`${left} && ${right}`, Order.LOGICAL_AND];
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.LOGIC_OR] = (block, generator) => {
    const left = generator.valueToCode(block, "A", Order.NONE) || "false";
    const right = generator.valueToCode(block, "B", Order.NONE) || "false";
    return [`${left} || ${right}`, Order.LOGICAL_OR];
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.LOGIC_NOT] = (block, generator) => {
    const bool = generator.valueToCode(block, "BOOL", Order.NONE) || "false";
    return [`!${bool}`, Order.LOGICAL_NOT];
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.TRUE] = () => ["true", Order.ATOMIC];

  javascriptGenerator.forBlock[BLOCK_TYPES.FALSE] = () => [
    "false",
    Order.ATOMIC,
  ];
}

export function generateCommandQueue(
  workspace: Blockly.Workspace,
): CommandItem[] {
  const code = javascriptGenerator.workspaceToCode(workspace);
  const fullCode = `var queue=[];var currentSpeed=100;${code}return queue;`;

  try {
    const fn = new Function(fullCode);
    const result = fn();
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("Code gen error:", e);
    return [];
  }
}
