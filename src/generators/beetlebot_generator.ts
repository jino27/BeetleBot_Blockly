import * as Blockly from "blockly/core";
import { javascriptGenerator, Order } from "blockly/javascript";
import { BLOCK_TYPES } from "../blocks/beetlebot_blocks";

export interface CommandItem {
  cmd: string;
  val?: number;
  ms?: number;
  params?: Record<string, unknown>;
}

export function initBeetleBotGenerator(): void {
  // ========================================================================
  // 🚗 MOVEMENT
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.GO_FORWARD] = () =>
    `queue.push({cmd:"move",params:{direction:"forward"}});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.GO_BACKWARD] = () =>
    `queue.push({cmd:"move",params:{direction:"backward"}});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_LEFT] = () =>
    `queue.push({cmd:"turn",params:{direction:"left",degrees:90}});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_RIGHT] = () =>
    `queue.push({cmd:"turn",params:{direction:"right",degrees:90}});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_LEFT_ANGLE] = (block) => {
    const angle = Math.max(
      1,
      Math.min(360, Math.round(Number(block.getFieldValue("ANGLE") || 90))),
    );
    return `queue.push({cmd:"turn",params:{direction:"left",degrees:${angle}}});\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_RIGHT_ANGLE] = (block) => {
    const angle = Math.max(
      1,
      Math.min(360, Math.round(Number(block.getFieldValue("ANGLE") || 90))),
    );
    return `queue.push({cmd:"turn",params:{direction:"right",degrees:${angle}}});\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.STOP] = () =>
    `queue.push({cmd:"stop"});\n`;

  // ========================================================================
  // 🤖 ACTIONS
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.GRAB] = () =>
    `queue.push({cmd:"grab"});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.RELEASE] = () =>
    `queue.push({cmd:"release"});\n`;

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
    const condBlock = block.getInputTargetBlock("CONDITION");
    if (condBlock && condBlock.type === BLOCK_TYPES.DISTANCE_THRESHOLD) {
      const op = condBlock.getFieldValue("OP") || "LT";
      const threshold = generator.valueToCode(condBlock, "THRESHOLD", Order.NONE) || "200";
      const branch = generator.statementToCode(block, "DO");
      return `queue.push({cmd:"_WHILE",threshold:${threshold},op:"${op}"});\n${branch}queue.push({cmd:"_ENDWHILE"});\n`;
    }
    const condition =
      generator.valueToCode(block, "CONDITION", Order.NONE) || "false";
    const branch = generator.statementToCode(block, "DO");
    return `for (var _i=0; _i<100 && (${condition}); _i++) {\n${branch}}\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.REPEAT_UNTIL] = (
    block,
    generator,
  ) => {
    const condBlock = block.getInputTargetBlock("CONDITION");
    if (condBlock && condBlock.type === BLOCK_TYPES.DISTANCE_THRESHOLD) {
      const op = condBlock.getFieldValue("OP") || "LT";
      const threshold = generator.valueToCode(condBlock, "THRESHOLD", Order.NONE) || "200";
      const branch = generator.statementToCode(block, "DO");
      return `queue.push({cmd:"_WHILE",threshold:${threshold},op:"${op}",until:true});\n${branch}queue.push({cmd:"_ENDWHILE"});\n`;
    }
    const condition =
      generator.valueToCode(block, "CONDITION", Order.NONE) || "false";
    const branch = generator.statementToCode(block, "DO");
    return `for (var _i=0; _i<100 && !(${condition}); _i++) {\n${branch}}\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.COUNT_WITH] = (
    block,
    generator,
  ) => {
    const rawVar = block.getFieldValue("VAR") || "i";
    const safeVar = rawVar.replace(/[^a-zA-Z0-9_]/g, "_");
    const from = generator.valueToCode(block, "FROM", Order.NONE) || "1";
    const to = generator.valueToCode(block, "TO", Order.NONE) || "10";
    const branch = generator.statementToCode(block, "DO");
    return `for (var ${safeVar} = ${from}; ${safeVar} <= ${to}; ${safeVar}++) {\n${branch}}\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.BREAK] = () => `break;\n`;

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
    const left = generator.valueToCode(block, "A", Order.NONE);
    const right = generator.valueToCode(block, "B", Order.NONE);

    if (!left || !right) {
      return ["false", Order.ATOMIC];
    }

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

  // ========================================================================
  // 🔢 VARIABLES
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.VARIABLE_SET] = (
    block,
    generator,
  ) => {
    const varName = block.getFieldValue("VAR_NAME") || "counter";
    const value = generator.valueToCode(block, "VALUE", Order.NONE) || "0";
    const safeName = varName.replace(/[^a-zA-Z0-9_]/g, "_");
    return `var ${safeName} = ${value};\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.VARIABLE_GET] = (block) => {
    const varName = block.getFieldValue("VAR_NAME") || "counter";
    const safeName = varName.replace(/[^a-zA-Z0-9_]/g, "_");
    return [safeName, Order.ATOMIC];
  };

javascriptGenerator.forBlock[BLOCK_TYPES.VARIABLE_CHANGE] = (
    block,
    generator,
  ) => {
    const varName = block.getFieldValue("VAR_NAME") || "counter";
    const delta = generator.valueToCode(block, "DELTA", Order.NONE) || "1";
    const safeName = varName.replace(/[^a-zA-Z0-9_]/g, "_");
    return `var ${safeName} = (${safeName} || 0) + ${delta};\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.VARIABLE_INCREMENT] = (block) => {
    const varName = block.getFieldValue("VAR_NAME") || "counter";
    const safeName = varName.replace(/[^a-zA-Z0-9_]/g, "_");
    return `var ${safeName} = (${safeName} || 0) + 1;\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.VARIABLE_DECREMENT] = (block) => {
    const varName = block.getFieldValue("VAR_NAME") || "counter";
    const safeName = varName.replace(/[^a-zA-Z0-9_]/g, "_");
    return `var ${safeName} = (${safeName} || 0) - 1;\n`;
  };

  // ========================================================================
  // 📡 SENSORS (TOF)
  // ========================================================================
  javascriptGenerator.forBlock[BLOCK_TYPES.READ_DISTANCE] = () => [
    `await getDistance()`,
    Order.FUNCTION_CALL,
  ];

  javascriptGenerator.forBlock[BLOCK_TYPES.DISTANCE_THRESHOLD] = (
    block,
    generator,
  ) => {
    const op = block.getFieldValue("OP") || "LT";
    const threshold =
      generator.valueToCode(block, "THRESHOLD", Order.NONE) || "200";
    return [
      `await checkDistanceThreshold(${threshold}, "${op}")`,
      Order.FUNCTION_CALL,
    ];
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.WAIT_FOR_OBJECT] = (
    block,
    generator,
  ) => {
    const threshold =
      generator.valueToCode(block, "THRESHOLD", Order.NONE) || "200";
    return `for (var _i=0; _i<100 && !(await checkDistanceThreshold(${threshold}, "LT")); _i++) { await sleep(50); }\n`;
  };
}

const PREAMBLE = `
var queue=[];
var currentSpeed=100;
async function sendCommand(cmd) {
  const res = await wifi.sendCommandWithResponse(cmd);
  return res;
}
async function getDistance() {
  // Use cached distance from ESP32 broadcast (updated every ~150ms)
  return wifi.getLatestDistance();
}
async function checkDistanceThreshold(threshold, op) {
  const d = await getDistance();
  if (d < 0) return false;
  switch(op) {
    case "LT":  return d < threshold;
    case "LTE": return d <= threshold;
    case "GT":  return d > threshold;
    case "GTE": return d >= threshold;
    case "EQ":  return d === threshold;
    case "NEQ": return d !== threshold;
    default:    return d < threshold;
  }
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
`;

export function generateCode(workspace: Blockly.Workspace): string {
  return javascriptGenerator.workspaceToCode(workspace);
}

export function buildProgram(
  code: string,
  wifi: { sendCommandWithResponse(cmd: object, timeoutMs?: number): Promise<any | null> },
): () => Promise<CommandItem[]> {
  const fullCode = `${PREAMBLE}return (async () => { ${code}return queue; })();`;
  const fn = new Function('wifi', fullCode);
  return () => fn(wifi);
}

export async function generateCommandQueue(
  workspace: Blockly.Workspace,
  wifi?: { sendCommandWithResponse(cmd: object, timeoutMs?: number): Promise<any | null> },
): Promise<CommandItem[]> {
  const code = generateCode(workspace);
  if (!code.trim()) return [];

  const run = buildProgram(code, wifi ?? { sendCommandWithResponse: async () => null });
  try {
    const result = await run();
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("Code gen error:", e);
    return [];
  }
}
