import type { BlockTreeNode } from "../generators/block_tree_export";
import { evalExpr, type Scope } from "./expr_eval";

export interface InterpreterContext {
  wifi: {
    getLatestDistance(): number;
    sendCommand(cmd: object): Promise<void>;
  };
  variables: Record<string, number | boolean>;
  signal?: AbortSignal;
}

// ── Value tree → expr string ──────────────────────────────────────────────

function nodeToExpr(node: BlockTreeNode): string {
  switch (node.type) {
    case "math_number":
      return String(node.fields?.NUM ?? 0);
    case "read_distance":
      return "__distance__";
    case "variable_get":
      return (node.fields?.VAR_NAME as string) || "counter";
    case "beetlebot_true":
      return "true";
    case "beetlebot_false":
      return "false";
    case "beetlebot_compare": {
      const op = (node.fields?.OP as string) || "EQ";
      const opMap: Record<string, string> = {
        EQ: "==", NEQ: "!=", LT: "<", GT: ">", LTE: "<=", GTE: ">=",
      };
      const inputs = node.inputs || {};
      const left = inputs.A
        ? nodeToExpr(inputs.A as BlockTreeNode)
        : "0";
      const right = inputs.B
        ? nodeToExpr(inputs.B as BlockTreeNode)
        : "0";
      return `${left} ${opMap[op] || "=="} ${right}`;
    }
    case "beetlebot_and": {
      const inputs = node.inputs || {};
      const a = inputs.A
        ? nodeToExpr(inputs.A as BlockTreeNode)
        : "false";
      const b = inputs.B
        ? nodeToExpr(inputs.B as BlockTreeNode)
        : "false";
      return `(${a} && ${b})`;
    }
    case "beetlebot_or": {
      const inputs = node.inputs || {};
      const a = inputs.A
        ? nodeToExpr(inputs.A as BlockTreeNode)
        : "false";
      const b = inputs.B
        ? nodeToExpr(inputs.B as BlockTreeNode)
        : "false";
      return `(${a} || ${b})`;
    }
    case "beetlebot_not": {
      const inputs = node.inputs || {};
      const bool = inputs.BOOL
        ? nodeToExpr(inputs.BOOL as BlockTreeNode)
        : "false";
      return `!${bool}`;
    }
    case "math_arithmetic": {
      const op = (node.fields?.OP as string) || "ADD";
      const inputs = node.inputs || {};
      const a = inputs.A
        ? nodeToExpr(inputs.A as BlockTreeNode)
        : "0";
      const b = inputs.B
        ? nodeToExpr(inputs.B as BlockTreeNode)
        : "0";
      const opMap: Record<string, string> = {
        ADD: "+", MINUS: "-", MULTIPLY: "*", DIVIDE: "/", POWER: "**",
      };
      return `(${a} ${opMap[op] || "+"} ${b})`;
    }
    default:
      return "0";
  }
}

function buildEvalScope(ctx: InterpreterContext): Scope {
  const scope: Scope = { __distance__: ctx.wifi.getLatestDistance() };
  for (const [k, v] of Object.entries(ctx.variables)) {
    scope[k] = v;
  }
  return scope;
}

// ── Condition / value helpers ─────────────────────────────────────────────

export function evalCondition(
  condNode: BlockTreeNode,
  ctx: InterpreterContext,
): boolean {
  const expr = nodeToExpr(condNode);
  const scope = buildEvalScope(ctx);
  return !!evalExpr(expr, scope);
}

export function resolveValue(
  valueNode: BlockTreeNode,
  ctx: InterpreterContext,
): number | boolean {
  const expr = nodeToExpr(valueNode);
  const scope = buildEvalScope(ctx);
  return evalExpr(expr, scope) as number | boolean;
}

// ── Async helpers ─────────────────────────────────────────────────────────

function sleep(ms: number, ctx: InterpreterContext): Promise<void> {
  return new Promise((resolve) => {
    if (ctx.signal?.aborted) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      ctx.signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      ctx.signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    ctx.signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// ── Statement execution ───────────────────────────────────────────────────

function getInputStatements(
  node: BlockTreeNode,
  name: string,
): BlockTreeNode[] {
  const input = node.inputs?.[name];
  if (Array.isArray(input)) return input;
  return [];
}

function getInputValue(node: BlockTreeNode, name: string): BlockTreeNode | null {
  const input = node.inputs?.[name];
  if (input && !Array.isArray(input)) return input;
  return null;
}

async function executeStatement(
  node: BlockTreeNode,
  ctx: InterpreterContext,
): Promise<void> {
  if (ctx.signal?.aborted) return;

  const type = node.type;
  const fields = node.fields || {};

  switch (type) {
    // ── Movement ──
    case "go_forward":
      await ctx.wifi.sendCommand({
        cmd: "move",
        params: { direction: "forward" },
      });
      break;

    case "go_backward":
      await ctx.wifi.sendCommand({
        cmd: "move",
        params: { direction: "backward" },
      });
      break;

    case "turn_left":
      await ctx.wifi.sendCommand({
        cmd: "turn",
        params: { direction: "left", degrees: 90 },
      });
      break;

    case "turn_right":
      await ctx.wifi.sendCommand({
        cmd: "turn",
        params: { direction: "right", degrees: 90 },
      });
      break;

    case "turn_left_angle": {
      const angle = Math.max(1, Math.min(360, Math.round(Number(fields.ANGLE ?? 90))));
      await ctx.wifi.sendCommand({
        cmd: "turn",
        params: { direction: "left", degrees: angle },
      });
      break;
    }

    case "turn_right_angle": {
      const angle = Math.max(1, Math.min(360, Math.round(Number(fields.ANGLE ?? 90))));
      await ctx.wifi.sendCommand({
        cmd: "turn",
        params: { direction: "right", degrees: angle },
      });
      break;
    }

    case "stop":
      await ctx.wifi.sendCommand({ cmd: "stop" });
      break;

    // ── Actions ──
    case "grab":
      await ctx.wifi.sendCommand({ cmd: "grab" });
      break;

    case "release":
      await ctx.wifi.sendCommand({ cmd: "release" });
      break;

    // ── Time ──
    case "wait": {
      const secondsField = fields.SECONDS;
      let seconds: number;
      if (secondsField !== undefined) {
        seconds = Math.max(1, Math.min(60, Number(secondsField)));
      } else {
        const valNode = getInputValue(node, "SECONDS");
        const val = valNode ? resolveValue(valNode, ctx) : 1;
        seconds = Math.max(1, Math.min(60, Number(val)));
      }
      await sleep(seconds * 1000, ctx);
      break;
    }

    // ── If / If-else ──
    case "beetlebot_if": {
      const condNode = getInputValue(node, "CONDITION");
      const doStatements = getInputStatements(node, "DO");
      const condition = condNode
        ? evalCondition(condNode, ctx)
        : true;
      if (condition) {
        await executeBlockSet(doStatements, ctx);
      }
      break;
    }

    case "beetlebot_if_else": {
      const condNode = getInputValue(node, "CONDITION");
      const doStatements = getInputStatements(node, "DO");
      const elseStatements = getInputStatements(node, "ELSE");
      const condition = condNode
        ? evalCondition(condNode, ctx)
        : true;
      if (condition) {
        await executeBlockSet(doStatements, ctx);
      } else {
        await executeBlockSet(elseStatements, ctx);
      }
      break;
    }

    // ── While / Repeat-until (recheck-per-iteration, cached reads, 150ms poll) ──
    case "while": {
      const condNode = getInputValue(node, "CONDITION");
      const body = getInputStatements(node, "DO");
      if (!condNode) break;
      while (!ctx.signal?.aborted) {
        if (!evalCondition(condNode, ctx)) break;
        await executeBlockSet(body, ctx);
        if (ctx.signal?.aborted) break;
        await sleep(150, ctx);
      }
      await ctx.wifi.sendCommand({ cmd: "stop" }).catch(() => {});
      await ctx.wifi.sendCommand({ cmd: "clear" }).catch(() => {});
      break;
    }

    case "repeat_until": {
      const condNode = getInputValue(node, "CONDITION");
      const body = getInputStatements(node, "DO");
      if (!condNode) break;
      while (!ctx.signal?.aborted) {
        await executeBlockSet(body, ctx);
        if (ctx.signal?.aborted) break;
        if (evalCondition(condNode, ctx)) break;
        await sleep(150, ctx);
      }
      await ctx.wifi.sendCommand({ cmd: "stop" }).catch(() => {});
      await ctx.wifi.sendCommand({ cmd: "clear" }).catch(() => {});
      break;
    }

    // ── Repeat N times ──
    case "repeat": {
      const timesField = fields.TIMES;
      let times: number;
      if (timesField !== undefined) {
        times = Math.max(1, Math.min(100, Math.round(Number(timesField) || 5)));
      } else {
        const valNode = getInputValue(node, "TIMES");
        const val = valNode ? resolveValue(valNode, ctx) : 5;
        times = Math.max(1, Math.min(100, Math.round(Number(val) || 5)));
      }
      const body = getInputStatements(node, "DO");
      for (let i = 0; i < times; i++) {
        if (ctx.signal?.aborted) break;
        await executeBlockSet(body, ctx);
      }
      break;
    }

    // ── Count-with loop ──
    case "count_with": {
      const varName = (fields.VAR as string) || "i";
      const fromNode = getInputValue(node, "FROM");
      const toNode = getInputValue(node, "TO");
      const from = fromNode
        ? Math.round(Number(resolveValue(fromNode, ctx)))
        : 1;
      const to = toNode
        ? Math.round(Number(resolveValue(toNode, ctx)))
        : 10;
      const body = getInputStatements(node, "DO");
      for (let i = from; i <= to; i++) {
        if (ctx.signal?.aborted) break;
        ctx.variables[varName] = i;
        await executeBlockSet(body, ctx);
      }
      break;
    }

    // ── Variables ──
    case "variable_set": {
      const varName = (fields.VAR_NAME as string) || "counter";
      const valNode = getInputValue(node, "VALUE");
      const val = valNode ? resolveValue(valNode, ctx) : 0;
      ctx.variables[varName] = val as number;
      break;
    }

    case "variable_change": {
      const varName = (fields.VAR_NAME as string) || "counter";
      const current = (ctx.variables[varName] as number) ?? 0;
      const deltaNode = getInputValue(node, "DELTA");
      const delta = deltaNode
        ? Number(resolveValue(deltaNode, ctx))
        : 1;
      ctx.variables[varName] = current + delta;
      break;
    }

    case "variable_increment": {
      const varName = (fields.VAR_NAME as string) || "counter";
      ctx.variables[varName] = ((ctx.variables[varName] as number) ?? 0) + 1;
      break;
    }

    case "variable_decrement": {
      const varName = (fields.VAR_NAME as string) || "counter";
      ctx.variables[varName] = ((ctx.variables[varName] as number) ?? 0) - 1;
      break;
    }

    // ── Loop control ──
    case "break_loop":
      return;

    default:
      break;
  }
}

export async function executeBlockSet(
  set: BlockTreeNode[],
  ctx: InterpreterContext,
): Promise<void> {
  for (const node of set) {
    if (ctx.signal?.aborted) return;
    await executeStatement(node, ctx);
  }
}