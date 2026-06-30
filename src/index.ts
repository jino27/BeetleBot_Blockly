import * as Blockly from "blockly/core";
import { javascriptGenerator } from "blockly/javascript";
import "blockly/blocks";
import { registerFieldAngle } from "@blockly/field-angle";

import { defineBeetleBotBlocks } from "./blocks/beetlebot_blocks";
import {
  initBeetleBotGenerator,
  generateCommandQueue,
  CommandItem,
} from "./generators/beetlebot_generator";
import { WiFiWebSocket } from "./wifi/web_socket";
import { CommandExecutor } from "./execution/command_executor";

import "./styles.css";

let workspace: Blockly.WorkspaceSvg;
let wifi: WiFiWebSocket;
let executor: CommandExecutor;

// ============================================================================
// COLORS
// ============================================================================
const COLOUR_MOVEMENT = "#3b82f6"; // Blue
const COLOUR_ACTIONS = "#f97316"; // Orange
const COLOUR_TIME = "#6b7280"; // Gray
const COLOUR_LOOPS = "#22c55e"; // Green
const COLOUR_DECISIONS = "#eab308"; // Yellow
const COLOUR_LOGIC = "#8b5cf6"; // Purple
const COLOUR_EVENTS = "#ef4444"; // Red
const COLOUR_SENSORS = "#06b6d4"; // Cyan
const COLOUR_VARIABLES = "#14b8a6"; // Teal

function getToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: "categoryToolbox",
    contents: [
      // ========================================================================
      // ⚡ EVENTS (Red)
      // ========================================================================
      {
        kind: "category",
        name: "⚡ Start",
        colour: COLOUR_EVENTS,
        contents: [{ kind: "block", type: "when_start" }],
      },

      // ========================================================================
      // 🚗 MOVEMENT (Blue)
      // ========================================================================
      {
        kind: "category",
        name: "🚗 Move",
        colour: COLOUR_MOVEMENT,
        contents: [
          { kind: "block", type: "go_forward" },
          { kind: "block", type: "go_backward" },
          { kind: "block", type: "turn_left" },
          { kind: "block", type: "turn_right" },
          { kind: "block", type: "turn_left_angle" },
          { kind: "block", type: "turn_right_angle" },
          { kind: "block", type: "stop" },
        ],
      },

      // ========================================================================
      // 🤖 ACTIONS (Orange)
      // ========================================================================
      {
        kind: "category",
        name: "🤖 Actions",
        colour: COLOUR_ACTIONS,
        contents: [
          { kind: "block", type: "grab" },
          { kind: "block", type: "release" },
        ],
      },

      // ========================================================================
      // ⏱️ TIME (Gray)
      // ========================================================================
      {
        kind: "category",
        name: "⏱️ Time",
        colour: COLOUR_TIME,
        contents: [{ kind: "block", type: "wait" }],
      },

      // ========================================================================
      // 🔄 LOOPS (Green)
      // ========================================================================
      {
        kind: "category",
        name: "🔄 Loops",
        colour: COLOUR_LOOPS,
        contents: [
          { kind: "block", type: "repeat" },
          { kind: "block", type: "while" },
        ],
      },

      // ========================================================================
      // 🧠 DECISIONS (Yellow)
      // ========================================================================
      {
        kind: "category",
        name: "🧠 Decisions",
        colour: COLOUR_DECISIONS,
        contents: [
          { kind: "block", type: "beetlebot_if" },
          { kind: "block", type: "beetlebot_if_else" },
        ],
      },

      // ========================================================================
      // 🔀 LOGIC (Purple)
      // ========================================================================
      {
        kind: "category",
        name: "🔀 Logic",
        colour: COLOUR_LOGIC,
        contents: [
          { kind: "block", type: "beetlebot_compare" },
          { kind: "block", type: "beetlebot_and" },
          { kind: "block", type: "beetlebot_or" },
          { kind: "block", type: "beetlebot_not" },
          { kind: "block", type: "beetlebot_true" },
          { kind: "block", type: "beetlebot_false" },
        ],
      },

      // ========================================================================
      // 🔢 MATH (Green - Built-in)
      // ========================================================================
      {
        kind: "category",
        name: "🔢 Math",
        colour: "#4caf50",
        contents: [
          { kind: "block", type: "math_number" },
          { kind: "block", type: "math_arithmetic" },
        ],
      },

      // ========================================================================
      // 📡 SENSORS (Cyan)
      // ========================================================================
      {
        kind: "category",
        name: "📡 Sensors",
        colour: COLOUR_SENSORS,
        contents: [
          { kind: "block", type: "read_distance" },
          { kind: "block", type: "distance_threshold" },
          { kind: "block", type: "tof_trigger_claw" },
          { kind: "block", type: "wait_for_object" },
        ],
      },

      // ========================================================================
      // 🔢 VARIABLES (Teal)
      // ========================================================================
      {
        kind: "category",
        name: "🔢 Variables",
        colour: COLOUR_VARIABLES,
        contents: [
          { kind: "block", type: "variable_set" },
          { kind: "block", type: "variable_get" },
          { kind: "block", type: "variable_change" },
        ],
      },
    ],
  };
}

document.addEventListener("DOMContentLoaded", () => {
  registerFieldAngle();
  defineBeetleBotBlocks();
  initBeetleBotGenerator();

  workspace = Blockly.inject("blocklyDiv", {
    toolbox: getToolbox(),
    theme: "dark",
    grid: { spacing: 20, length: 3, colour: "#333", snap: true },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1.0,
      maxScale: 3,
      minScale: 0.3,
    },
    trashcan: true,
  });

  const savedIp = localStorage.getItem("esp32-ip") || "192.168.1.100";
  (document.getElementById("esp-ip") as HTMLInputElement).value = savedIp;

  wifi = new WiFiWebSocket(savedIp);
  executor = new CommandExecutor(wifi);

  workspace.addChangeListener(() => {
    if (!executor.isRunning) updatePreview();
  });

  setupUI();
});

function setupUI(): void {
  document
    .getElementById("btn-connect")!
    .addEventListener("click", toggleConnect);
  document.getElementById("btn-save-ip")!.addEventListener("click", saveIp);
  document
    .getElementById("btn-fwd")!
    .addEventListener("click", () => send("F"));
  document
    .getElementById("btn-bwd")!
    .addEventListener("click", () => send("B"));
  document
    .getElementById("btn-left")!
    .addEventListener("click", () => send("L"));
  document
    .getElementById("btn-right")!
    .addEventListener("click", () => send("R"));
  document
    .getElementById("btn-stop")!
    .addEventListener("click", () => send("S"));
  document
    .getElementById("btn-open")!
    .addEventListener("click", () => send("O"));
  document
    .getElementById("btn-close")!
    .addEventListener("click", () => send("C"));
  document.getElementById("btn-run")!.addEventListener("click", runProgram);
  document
    .getElementById("btn-stop-program")!
    .addEventListener("click", stopProgram);
  document.getElementById("btn-clear-log")!.addEventListener("click", clearLog);
}

function saveIp(): void {
  const ip = (document.getElementById("esp-ip") as HTMLInputElement).value;
  localStorage.setItem("esp32-ip", ip);
  wifi.setIp(ip);
  log("IP saved", "sent");
}

async function toggleConnect(): Promise<void> {
  const btn = document.getElementById("btn-connect") as HTMLButtonElement;
  const dot = document.getElementById("status-dot")!;
  const text = document.getElementById("status-text")!;

  if (wifi.isConnected) {
    await wifi.disconnect();
    dot.classList.remove("connected");
    text.textContent = "Offline";
    btn.textContent = "Connect";
    log("Disconnected", "error");
  } else {
    try {
      await wifi.connect();
      dot.classList.add("connected");
      text.textContent = "Online";
      btn.textContent = "Disconnect";
      log("Connected", "sent");
    } catch (err: any) {
      log(`Failed: ${err.message}`, "error");
    }
  }
}

async function send(cmd: string): Promise<void> {
  if (!wifi.isConnected) {
    log("Not connected", "error");
    return;
  }
  try {
    await wifi.sendCommand(cmd);
    log(`→ ${cmd}`, "sent");
  } catch (err: any) {
    log(err.message, "error");
  }
}

async function runProgram(): Promise<void> {
  const queue = generateCommandQueue(workspace);
  if (!queue.length) {
    log("No blocks", "error");
    return;
  }

  const btn = document.getElementById("btn-run") as HTMLButtonElement;
  btn.textContent = "⏸ Running";
  btn.disabled = true;

  try {
    await executor.execute(queue);
    log("Done", "sent");
  } catch (err: any) {
    log(err.message, "error");
  } finally {
    btn.textContent = "▶ Run Program";
    btn.disabled = false;
  }
}

function stopProgram(): void {
  executor.stop();
  log("Stopped", "error");
}

function updatePreview(): void {
  // Only generate the code string - don't execute it!
  // Executing while loops during editing can cause crashes
  const code = javascriptGenerator.workspaceToCode(workspace);
  const text = code || "// Drag blocks here";
  const el = document.getElementById("code-preview");
  if (el) el.textContent = text;
}

function log(msg: string, type: "sent" | "received" | "error" = "sent"): void {
  const div = document.getElementById("serial-log")!;
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  div.appendChild(entry);
  div.scrollTop = div.scrollHeight;
}

function clearLog(): void {
  document.getElementById("serial-log")!.innerHTML = "";
}
