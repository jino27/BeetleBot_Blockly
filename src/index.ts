import * as Blockly from "blockly/core";
import "blockly/blocks";
import { registerFieldAngle } from "@blockly/field-angle";

import { defineBeetleBotBlocks } from "./blocks/beetlebot_blocks";
import "./generators/beetlebot_generator";
import { WiFiWebSocket } from "./wifi/web_socket";
import { blocklyToBlockTree } from "./generators/block_tree_export";
import "./styles.css";

let workspace: Blockly.WorkspaceSvg;
let wifi: WiFiWebSocket;

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
          { kind: "block", type: "repeat_until" },
          { kind: "block", type: "count_with" },
          { kind: "block", type: "break_loop" },
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
          { kind: "block", type: "distance_check" },
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
          { kind: "block", type: "math_number" },
          { kind: "block", type: "variable_set" },
          { kind: "block", type: "variable_get" },
          { kind: "block", type: "variable_change" },
          { kind: "block", type: "variable_increment" },
          { kind: "block", type: "variable_decrement" },
        ],
      },
    ],
  };
}

document.addEventListener("DOMContentLoaded", () => {
  registerFieldAngle();
  defineBeetleBotBlocks();
  workspace = Blockly.inject("blocklyDiv", {
    toolbox: getToolbox(),
    theme: Blockly.Themes.Zelos,
    grid: { spacing: 24, length: 0, colour: "transparent", snap: true },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1.0,
      maxScale: 3,
      minScale: 0.3,
    },
    trashcan: true,
  });

  const savedIp = localStorage.getItem("esp32-ip") || "192.168.4.1";
  (document.getElementById("esp-ip") as HTMLInputElement).value = savedIp;

  wifi = new WiFiWebSocket(savedIp);
  // Expose for debugging
  (window as any).wifi = wifi;
  (window as any).blocklyToBlockTree = blocklyToBlockTree;
  (window as any).workspace = workspace;

  // Wire ESP32-side interpreter callbacks
  wifi.setOnProgramDone((aborted) => {
    const btn = document.getElementById("btn-run") as HTMLButtonElement;
    btn.textContent = "▶ Run Program";
    btn.disabled = false;
    log(aborted ? "Program aborted" : "Program done", "received");
  });
  wifi.setOnExecBlock((blockType) => {
    log(`exec: ${blockType}`, "received");
  });
  
  //----------------------------------
  workspace.addChangeListener(() => {
    if (wifi.isConnected) updatePreview();
  });

  setupUI();
});

function setupUI(): void {
  document
    .getElementById("btn-connect")!
    .addEventListener("click", toggleConnect);
  document.getElementById("btn-save-ip")!.addEventListener("click", saveIp);
  document.getElementById("btn-fwd")!.addEventListener("click", () =>
    wifi.sendCommand({cmd:"move",params:{direction:"forward"}}).catch(() => {}));
  document.getElementById("btn-bwd")!.addEventListener("click", () =>
    wifi.sendCommand({cmd:"move",params:{direction:"backward"}}).catch(() => {}));
  document.getElementById("btn-left")!.addEventListener("click", () =>
    wifi.sendCommand({cmd:"turn",params:{direction:"left",degrees:90}}).catch(() => {}));
  document.getElementById("btn-right")!.addEventListener("click", () =>
    wifi.sendCommand({cmd:"turn",params:{direction:"right",degrees:90}}).catch(() => {}));
  document.getElementById("btn-stop")!.addEventListener("click", () =>
    wifi.sendCommand({cmd:"stop"}).catch(() => {}));
  document.getElementById("btn-open")!.addEventListener("click", () =>
    wifi.sendCommand({cmd:"release"}).catch(() => {}));
  document.getElementById("btn-close")!.addEventListener("click", () =>
    wifi.sendCommand({cmd:"grab"}).catch(() => {}));
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

async function runProgram(): Promise<void> {
  const tree = blocklyToBlockTree(workspace);
  if (!tree.length) {
    log("No blocks", "error");
    return;
  }

  const btn = document.getElementById("btn-run") as HTMLButtonElement;
  btn.textContent = "⏸ Running";
  btn.disabled = true;

  try {
    await wifi.sendCommand({ cmd: "run_program", tree });
    log("Program sent to robot", "sent");
  } catch (err: any) {
    log(`Failed: ${err.message}`, "error");
    btn.textContent = "▶ Run Program";
    btn.disabled = false;
  }
}

function stopProgram(): void {
  wifi.sendCommand({ cmd: "stop" }).catch(() => {});
  log("Stop sent", "sent");
}

function updatePreview(): void {
  const tree = blocklyToBlockTree(workspace);
  const text = tree.length ? JSON.stringify(tree, null, 2) : "// Drag blocks to workspace";
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
