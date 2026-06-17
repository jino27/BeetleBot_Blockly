import * as Blockly from 'blockly/core';
import { javascriptGenerator } from 'blockly/javascript';
import 'blockly/blocks';

import { defineBeetleBotBlocks } from './blocks/beetlebot_blocks';
import { initBeetleBotGenerator, generateCommandQueue, CommandItem } from './generators/beetlebot_generator';
import { WiFiWebSocket } from './wifi/web_socket';
import { CommandExecutor } from './execution/command_executor';

import './styles.css';

let workspace: Blockly.WorkspaceSvg;
let wifi: WiFiWebSocket;
let executor: CommandExecutor;

function getToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: 'Move',
        colour: '#ff6b35',
        contents: [
          { kind: 'block', type: 'move_forward' },
          { kind: 'block', type: 'move_backward' },
          { kind: 'block', type: 'turn_left' },
          { kind: 'block', type: 'turn_right' },
          { kind: 'block', type: 'stop' },
          { kind: 'block', type: 'brake' },
        ],
      },
      {
        kind: 'category',
        name: 'Claw',
        colour: '#ff9800',
        contents: [
          { kind: 'block', type: 'claw_open' },
          { kind: 'block', type: 'claw_close' },
        ],
      },
      {
        kind: 'category',
        name: 'Time',
        colour: '#888888',
        contents: [
          {
            kind: 'block',
            type: 'wait_seconds',
            inputs: {
              SECONDS: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            },
          },
          {
            kind: 'block',
            type: 'wait_millis',
            inputs: {
              MILLIS: { shadow: { type: 'math_number', fields: { NUM: 500 } } },
            },
          },
        ],
      },
      {
        kind: 'category',
        name: 'Speed',
        colour: '#2196f3',
        contents: [
          {
            kind: 'block',
            type: 'set_speed',
            inputs: {
              SPEED: { shadow: { type: 'math_number', fields: { NUM: 150 } } },
            },
          },
          {
            kind: 'block',
            type: 'change_speed',
            inputs: {
              DELTA: { shadow: { type: 'math_number', fields: { NUM: 20 } } },
            },
          },
          { kind: 'block', type: 'get_speed' },
        ],
      },
      {
        kind: 'category',
        name: 'Math',
        colour: '#4caf50',
        contents: [
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'math_arithmetic' },
        ],
      },
    ],
  };
}

document.addEventListener('DOMContentLoaded', () => {
  defineBeetleBotBlocks();
  initBeetleBotGenerator();

  workspace = Blockly.inject('blocklyDiv', {
    toolbox: getToolbox(),
    theme: 'dark',
    grid: { spacing: 20, length: 3, colour: '#333', snap: true },
    zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3 },
    trashcan: true,
  });

  const savedIp = localStorage.getItem('esp32-ip') || '192.168.1.100';
  (document.getElementById('esp-ip') as HTMLInputElement).value = savedIp;
  
  wifi = new WiFiWebSocket(savedIp);
  executor = new CommandExecutor(wifi);

  workspace.addChangeListener(() => {
    if (!executor.isRunning) updatePreview();
  });

  setupUI();
});

function setupUI(): void {
  document.getElementById('btn-connect')!.addEventListener('click', toggleConnect);
  document.getElementById('btn-save-ip')!.addEventListener('click', saveIp);
  document.getElementById('btn-fwd')!.addEventListener('click', () => send('F'));
  document.getElementById('btn-bwd')!.addEventListener('click', () => send('B'));
  document.getElementById('btn-left')!.addEventListener('click', () => send('L'));
  document.getElementById('btn-right')!.addEventListener('click', () => send('R'));
  document.getElementById('btn-stop')!.addEventListener('click', () => send('S'));
  document.getElementById('btn-open')!.addEventListener('click', () => send('O'));
  document.getElementById('btn-close')!.addEventListener('click', () => send('C'));
  document.getElementById('btn-run')!.addEventListener('click', runProgram);
  document.getElementById('btn-stop-program')!.addEventListener('click', stopProgram);
  document.getElementById('btn-clear-log')!.addEventListener('click', clearLog);
}

function saveIp(): void {
  const ip = (document.getElementById('esp-ip') as HTMLInputElement).value;
  localStorage.setItem('esp32-ip', ip);
  wifi.setIp(ip);
  log('IP saved', 'sent');
}

async function toggleConnect(): Promise<void> {
  const btn = document.getElementById('btn-connect') as HTMLButtonElement;
  const dot = document.getElementById('status-dot')!;
  const text = document.getElementById('status-text')!;
  
  if (wifi.isConnected) {
    await wifi.disconnect();
    dot.classList.remove('connected');
    text.textContent = 'Offline';
    btn.textContent = 'Connect';
    log('Disconnected', 'error');
  } else {
    try {
      await wifi.connect();
      dot.classList.add('connected');
      text.textContent = 'Online';
      btn.textContent = 'Disconnect';
      log('Connected', 'sent');
    } catch (err: any) {
      log(`Failed: ${err.message}`, 'error');
    }
  }
}

async function send(cmd: string): Promise<void> {
  if (!wifi.isConnected) { log('Not connected', 'error'); return; }
  try { await wifi.sendCommand(cmd); log(`→ ${cmd}`, 'sent'); }
  catch (err: any) { log(err.message, 'error'); }
}

async function runProgram(): Promise<void> {
  const queue = generateCommandQueue(workspace);
  if (!queue.length) { log('No blocks', 'error'); return; }
  
  const btn = document.getElementById('btn-run') as HTMLButtonElement;
  btn.textContent = '⏸ Running';
  btn.disabled = true;
  
  try { await executor.execute(queue); log('Done', 'sent'); }
  catch (err: any) { log(err.message, 'error'); }
  finally { btn.textContent = '▶ Run Program'; btn.disabled = false; }
}

function stopProgram(): void {
  executor.stop();
  log('Stopped', 'error');
}

function updatePreview(): void {
  const queue = generateCommandQueue(workspace);
  const text = queue.map((c: CommandItem, i: number) => `${i+1}. ${JSON.stringify(c)}`).join('\n');
  const el = document.getElementById('code-preview');
  if (el) el.textContent = text || '// Drag blocks';
}

function log(msg: string, type: 'sent' | 'received' | 'error' = 'sent'): void {
  const div = document.getElementById('serial-log')!;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  div.appendChild(entry);
  div.scrollTop = div.scrollHeight;
}

function clearLog(): void {
  document.getElementById('serial-log')!.innerHTML = '';
}