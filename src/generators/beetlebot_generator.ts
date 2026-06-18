import * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { BLOCK_TYPES } from '../blocks/beetlebot_blocks';

export interface CommandItem {
  cmd: string;
  val?: number;
  ms?: number;
}

export function initBeetleBotGenerator(): void {
  javascriptGenerator.forBlock[BLOCK_TYPES.MOVE_FORWARD] = () => `queue.push({cmd:"F"});\n`;
  javascriptGenerator.forBlock[BLOCK_TYPES.MOVE_BACKWARD] = () => `queue.push({cmd:"B"});\n`;
  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_LEFT] = () => `queue.push({cmd:"TURN:L:90"});\n`;
  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_RIGHT] = () => `queue.push({cmd:"TURN:R:90"});\n`;
  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_LEFT_ANGLE] = (block) => {
    const angle = Math.max(1, Math.min(360, Math.round(Number(block.getFieldValue('ANGLE') || 90))));
    return `queue.push({cmd:"TURN:L:${angle}"});\n`;
  };
  javascriptGenerator.forBlock[BLOCK_TYPES.TURN_RIGHT_ANGLE] = (block) => {
    const angle = Math.max(1, Math.min(360, Math.round(Number(block.getFieldValue('ANGLE') || 90))));
    return `queue.push({cmd:"TURN:R:${angle}"});\n`;
  };
  javascriptGenerator.forBlock[BLOCK_TYPES.STOP] = () => `queue.push({cmd:"S"});\n`;
  javascriptGenerator.forBlock[BLOCK_TYPES.BRAKE] = () => `queue.push({cmd:"BRAKE"});\n`;
  javascriptGenerator.forBlock[BLOCK_TYPES.CLAW_OPEN] = () => `queue.push({cmd:"O"});\n`;
  javascriptGenerator.forBlock[BLOCK_TYPES.CLAW_CLOSE] = () => `queue.push({cmd:"C"});\n`;

  javascriptGenerator.forBlock[BLOCK_TYPES.WAIT_SECONDS] = (block) => {
    const s = javascriptGenerator.valueToCode(block, 'SECONDS', Order.ATOMIC) || '1';
    return `queue.push({cmd:"WAIT", ms:${s}*1000});\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.WAIT_MILLIS] = (block) => {
    const ms = javascriptGenerator.valueToCode(block, 'MILLIS', Order.ATOMIC) || '500';
    return `queue.push({cmd:"WAIT", ms:${ms}});\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.SET_SPEED] = (block) => {
   const speed = javascriptGenerator.valueToCode(block, 'SPEED', Order.ATOMIC) || '100';
    return `queue.push({cmd:"SPEED", val:${speed}});\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.CHANGE_SPEED] = (block) => {
    const delta = javascriptGenerator.valueToCode(block, 'DELTA', Order.ATOMIC) || '20';
    return `queue.push({cmd:"SPEED_DELTA", val:${delta}});\n`;
  };

  javascriptGenerator.forBlock[BLOCK_TYPES.GET_SPEED] = () => ['currentSpeed', Order.ATOMIC];
}

export function generateCommandQueue(workspace: Blockly.Workspace): CommandItem[] {
  const code = javascriptGenerator.workspaceToCode(workspace);
  const fullCode = `var queue=[];var currentSpeed=100;${code}return queue;`;
  
  try {
    const fn = new Function(fullCode);
    const result = fn();
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error('Code gen error:', e);
    return [];
  }
}