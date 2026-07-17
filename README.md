# BeetleBot Blockly

A visual programming editor for BeetleBot ESP32 robots. Students arrange Blockly blocks into programs; the app serializes them to a JSON tree and sends the tree over WebSocket to the physical robot, which executes the commands in real time.

This is **not** a C++ code generator. The block workspace runs in-browser, and the ESP32 firmware contains its own tree-walking interpreter.

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
  - [Directory Structure](#directory-structure)
  - [Execution Pipeline](#execution-pipeline)
  - [WebSocket Protocol](#websocket-protocol)
  - [Block System](#block-system)
- [Block Reference](#block-reference)
- [Available Scripts](#available-scripts)
- [ESP32 Firmware](#esp32-firmware)
  - [Hardware Pin Map](#hardware-pin-map)
  - [WiFi Configuration](#wifi-configuration)
  - [Flashing Firmware](#flashing-firmware)
- [PWA Support](#pwa-support)
- [Design System](#design-system)
- [Troubleshooting](#troubleshooting)

---

## Key Features

- **Visual block programming** — drag-and-drop blocks from 9 color-coded categories
- **Real-time robot control** — send programs directly to an ESP32 robot over WiFi WebSocket
- **Quick controls** — D-pad for immediate movement, grab/release buttons
- **Live command preview** — see the JSON block tree update as you edit
- **Sensor support** — TOF distance sensor blocks for conditional logic
- **Loop constructs** — repeat N times, while, repeat-until, count-with counter
- **Variables** — set, get, increment, decrement variables
- **Expression evaluator** — custom lexer/parser for conditions (no `eval()` / `new Function()`)
- **PWA** — installable on phones and tablets, works offline after first load
- **Dark theme** — Ignite Dark design system with Poppins typography

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript 5.4+ (strict mode) |
| **Visual Editor** | [Blockly](https://developers.google.com/blockly/) 12.5+ |
| **Build** | Webpack 5.91+ |
| **Styling** | Custom CSS (no framework) |
| **PWA** | Service Worker + Web App Manifest |
| **Robot Firmware** | Arduino C++ (ESP32-WROOM-32E) |
| **Communication** | WebSocket (`ws://<ip>:8266`) |

## Prerequisites

- **Node.js 18+** and **npm**
- **Modern browser** (Chrome, Firefox, Edge, or Safari)
- **BeetleBot hardware** — ESP32-WROOM-32E robot with firmware flashed, on the same WiFi network as your computer
- **Arduino IDE** (only for flashing firmware — not needed for web editor)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/<your-org>/BeetleBot_Blockly.git
cd BeetleBot_Blockly
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Dev Server

```bash
npm start
```

This starts Webpack Dev Server on [http://127.0.0.1:8080](http://127.0.0.1:8080). The server watches for changes and hot-reloads automatically.

### 4. Build for Production

```bash
npm run build
```

Output goes to `dist/` — open `dist/index.html` in a browser to verify.

### 5. Connect to Your Robot

1. Power on the BeetleBot (it creates a WiFi AP named `BeetleBot`, password `12345678`)
2. Connect your computer to that WiFi network
3. In the web editor, set the **Robot IP** field to `192.168.4.1` (default)
4. Click **Connect** — the status dot turns green

---

## Architecture

### Directory Structure

```
BeetleBot_Blockly/
├── src/
│   ├── index.ts                    Entry point — Blockly workspace, UI wiring
│   ├── styles.css                  All application styles (dark theme)
│   ├── blocks/
│   │   └── beetlebot_blocks.ts     Blockly block definitions (JSON)
│   ├── generators/
│   │   ├── block_tree_export.ts    Converts workspace → JSON tree
│   │   └── beetlebot_generator.ts  (legacy — empty, interpreter drives WS directly)
│   ├── execution/
│   │   ├── interpreter.ts          Tree-walking interpreter (browser-side)
│   │   ├── command_executor.ts     Abort controller + command lifecycle
│   │   └── expr_eval.ts            Custom expression lexer/parser/evaluator
│   ├── wifi/
│   │   └── web_socket.ts           WebSocket client (ws://<ip>:8266)
│   └── assets/
│       └── img/
│           └── beetlebot.png       Robot logo image
├── public/
│   ├── icons/
│   │   ├── icon-192.png            PWA icon (192×192)
│   │   └── icon-512.png            PWA icon (512×512)
│   ├── manifest.json               Web App Manifest (copied to dist/)
│   └── service-worker.js           Cache-first service worker (copied to dist/)
├── index.html                      HTML template (injected by HtmlWebpackPlugin)
├── webpack.config.js               Webpack config (entry: src/index.ts → dist/bundle.js)
├── tsconfig.json                   TypeScript config (strict mode, ES2020 target)
├── package.json
├── package-lock.json
├── manifest.json                   Root PWA manifest
├── service-worker.js               Root service worker
├── beetlebot_code.ino              ESP32 firmware (generated artifact — source in separate project)
├── ESP32_GENERIC-20260406-v1.28.0.bin  Pre-built ESP32 MicroPython firmware binary
├── DESIGN.md                       Ignite Dark design system spec
├── AGENTS.md                       Agent instructions
├── .gitignore                      Ignores node_modules/, dist/, *.log, .DS_Store
└── .opencode/                      OpenCode configuration
```

### Execution Pipeline

There are **two independent execution paths** — the browser-side interpreter and the ESP32-side interpreter. Both consume the same JSON block tree.

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER SIDE                                                  │
│                                                                │
│  Blockly Workspace                                             │
│       │                                                        │
│       ▼                                                        │
│  blocklyToBlockTree()         Converts blocks → BlockTreeNode[] │
│       │                                                        │
│       ├──────────────► Update "Commands" preview panel          │
│       │                                                        │
│       ▼                                                        │
│  WiFiWebSocket.sendCommand({ cmd: "run_program", tree })       │
│       │                                                        │
└───────┼────────────────────────────────────────────────────────┘
        │  WebSocket (ws://192.168.4.1:8266)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  ESP32 FIRMWARE                                                │
│                                                                │
│  handleCommand() parses JSON, spawns interpreterTask on Core 1 │
│       │                                                        │
│       ▼                                                        │
│  executeBlockSet() — recursive tree walker using ArduinoJson    │
│       │                                                        │
│       ├──► MotorController (L298N H-bridge)                    │
│       ├──► ClawController (servo PWM)                          │
│       ├──► TOFSensor (VL53L0X I2C)                            │
│       └──► CommandQueue (timed motor actions)                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Step by step:**

1. User drags blocks in the Blockly workspace
2. `blocklyToBlockTree()` in `src/generators/block_tree_export.ts` serializes the workspace to a `BlockTreeNode[]` array (JSON-compatible)
3. The "Commands" preview panel shows this tree as formatted JSON
4. On **Run**, the tree is sent as `{ cmd: "run_program", tree: [...] }` via WebSocket
5. The ESP32 firmware parses the JSON and executes blocks on a FreeRTOS task pinned to Core 1
6. Each movement/turn/claw command is queued in `CommandQueue` with timed execution
7. The firmware sends `{ event: "exec", block: "<type>" }` back for each block executed
8. When the program finishes, `{ event: "program_done", aborted: false }` is sent back

### WebSocket Protocol

All communication uses **JSON over WebSocket** on port `8266`.

**Client → ESP32:**

| Command | JSON Payload | Description |
|---------|-------------|-------------|
| Move | `{"cmd":"move","params":{"direction":"forward"}}` | Drive forward/backward |
| Turn | `{"cmd":"turn","params":{"direction":"left","degrees":90}}` | Turn by angle |
| Grab | `{"cmd":"grab"}` | Close claw |
| Release | `{"cmd":"release"}` | Open claw |
| Stop | `{"cmd":"stop"}` | Stop all motors |
| Clear | `{"cmd":"clear"}` | Clear command queue |
| Status | `{"cmd":"status"}` | Get robot status |
| Run Program | `{"cmd":"run_program","tree":[...]}` | Execute block tree |
| Distance | `{"cmd":"dist"}` | Read TOF sensor |

**ESP32 → Client:**

| Event | JSON Payload | Description |
|-------|-------------|-------------|
| Execution | `{"event":"exec","block":"go_forward"}` | Block is executing |
| Done | `{"event":"program_done","aborted":false}` | Program completed |
| Distance | `{"event":"distance","value":423}` | TOF sensor reading (mm) |
| Command Response | `{"status":"queued","cmd":"move"}` | Command acknowledgment |

### Block System

Adding or modifying blocks requires changes in **three files**:

1. **`src/blocks/beetlebot_blocks.ts`** — Add block JSON definition to `BLOCK_TYPES` and `defineBeetleBotBlocks()`
2. **`src/generators/block_tree_export.ts`** — If the block is a statement or value type, add it to `STATEMENT_BLOCK_TYPES` or `VALUE_BLOCK_TYPES`
3. **`src/index.ts`** — Add the block to the toolbox in `getToolbox()`

Block type strings must match **exactly** across all three files.

**Statement blocks** (standalone actions): placed in sequence, have `previousStatement`/`nextStatement` connections.

**Value blocks** (expressions): plug into other blocks' inputs, have an `output` connection.

## Block Reference

### Events

| Block | Type | Description |
|-------|------|-------------|
| ⚡ When Start | `when_start` | Hat block — program entry point |

### Movement (Blue)

| Block | Type | Description |
|-------|------|-------------|
| Go Forward | `go_forward` | Drive forward |
| Go Backward | `go_backward` | Drive backward |
| Turn Left 90° | `turn_left` | Turn left 90 degrees |
| Turn Right 90° | `turn_right` | Turn right 90 degrees |
| Turn Left N° | `turn_left_angle` | Turn left by custom angle (1-360°) |
| Turn Right N° | `turn_right_angle` | Turn right by custom angle (1-360°) |
| Stop | `stop` | Stop all motors |

### Actions (Orange)

| Block | Type | Description |
|-------|------|-------------|
| Grab | `grab` | Close claw |
| Release | `release` | Open claw |

### Time (Gray)

| Block | Type | Description |
|-------|------|-------------|
| Wait N seconds | `wait` | Delay execution (1-60 seconds) |

### Loops (Green)

| Block | Type | Description |
|-------|------|-------------|
| Repeat N times | `repeat` | Fixed-count loop (1-100) |
| While | `while` | Loop while condition is true (max 10,000 iterations) |
| Repeat Until | `repeat_until` | Loop until condition becomes true |
| Count With | `count_with` | For-loop with named counter variable |
| Break Loop | `break_loop` | Exit the current loop |

### Decisions (Yellow)

| Block | Type | Description |
|-------|------|-------------|
| If | `beetlebot_if` | Conditional execution |
| If/Else | `beetlebot_if_else` | Conditional with else branch |

### Logic (Purple)

| Block | Type | Description |
|-------|------|-------------|
| Compare | `beetlebot_compare` | `=`, `>`, `<`, `≥`, `≤`, `≠` |
| AND | `beetlebot_and` | Logical AND |
| OR | `beetlebot_or` | Logical OR |
| NOT | `beetlebot_not` | Logical NOT |
| Yes / No | `beetlebot_true` / `beetlebot_false` | Boolean literals |

### Sensors (Cyan)

| Block | Type | Description |
|-------|------|-------------|
| Distance (mm) | `read_distance` | Read TOF sensor distance |
| Distance check | `distance_check` | Compare distance against threshold |

### Variables (Teal)

| Block | Type | Description |
|-------|------|-------------|
| Set variable | `variable_set` | Assign a value |
| Get variable | `variable_get` | Read a value |
| Change by N | `variable_change` | Add/subtract a delta |
| Increase by 1 | `variable_increment` | Increment by 1 |
| Decrease by 1 | `variable_decrement` | Decrement by 1 |

### Math (Built-in Green)

| Block | Type | Description |
|-------|------|-------------|
| Number | `math_number` | Numeric literal |
| Arithmetic | `math_arithmetic` | `+`, `-`, `×`, `÷`, `^` |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Dev server on `http://127.0.0.1:8080` |
| `npm run build` | Production build to `dist/` |

There are no lint, test, or typecheck scripts configured. TypeScript strict mode is enabled in `tsconfig.json`.

---

## ESP32 Firmware

The file `beetlebot_code.ino` at the project root is the generated Arduino sketch. The real firmware source lives in a separate repository (`BeetleBotV2` Arduino project). This copy is kept for reference.

### Hardware Pin Map

| Component | Pin | Protocol |
|-----------|-----|----------|
| Motor A (PWMA) | GPIO 25 | PWM (5kHz, 8-bit) |
| Motor B (PWMB) | GPIO 26 | PWM (5kHz, 8-bit) |
| Motor A IN1 | GPIO 27 | Digital |
| Motor A IN2 | GPIO 14 | Digital |
| Motor B IN1 | GPIO 16 | Digital |
| Motor B IN2 | GPIO 13 | Digital |
| Standby | GPIO 17 | Digital (HIGH = active) |
| Claw Servo | GPIO 15 | PWM (50Hz, 16-bit) |
| Status LED | GPIO 2 | Digital |
| TOF SDA | GPIO 18 | I2C |
| TOF SCL | GPIO 5 | I2C |

### WiFi Configuration

The ESP32 creates a WiFi Access Point by default:

| Setting | Value |
|---------|-------|
| SSID | `BeetleBot` |
| Password | `12345678` |
| AP IP | `192.168.4.1` |
| WebSocket Port | `8266` |

### Flashing Firmware

1. Open `beetlebot_code.ino` in Arduino IDE
2. Install required libraries:
   - `WebSocketsServer` by Markus Sattler
   - `ArduinoJson` by Benoit Blanchon
   - `VL53L0X` by Pololu
3. Select board: **ESP32 Dev Module**
4. Select the correct COM port
5. Click **Upload**

The firmware supports **OTA (Over-The-Air) updates** — send the string `OTA` over WebSocket to enable ArduinoOTA mode.

---

## PWA Support

The app is installable as a Progressive Web App:

- `manifest.json` defines the app name, icons, and display mode (`standalone`)
- `service-worker.js` caches `index.html` and `manifest.json` for offline access
- `apple-mobile-web-app-capable` meta tag enables iOS home screen launch
- Install prompt appears automatically in supported browsers

---

## Design System

See **`DESIGN.md`** for the full specification.

| Property | Value |
|----------|-------|
| Theme | Ignite Dark |
| Primary Color | `#FF6F20` (orange) |
| Font | Poppins (600-700 headlines, 400 body) |
| Spacing Grid | 8px base unit |
| Border Radius | 8px (standard), 16px (cards) |
| Blockly Theme | `Blockly.Themes.Zelos` |
| Background | `#131314` (surface) |
| Workspace Grid | 24px dot grid, transparent dots |

---

## Troubleshooting

### "Failed to connect" when clicking Connect

**Cause:** The browser cannot reach the ESP32 WebSocket server.

1. Verify you are connected to the `BeetleBot` WiFi network
2. Check the Robot IP field — default is `192.168.4.1`
3. Ensure no firewall is blocking WebSocket connections (port 8266)
4. Try opening `http://192.168.4.1` in a browser tab to confirm the ESP32 is reachable

### Blocks don't appear in workspace

**Cause:** Blockly initialization failed.

1. Check the browser console for JavaScript errors
2. Ensure `npm install` completed successfully
3. Clear the browser cache and hard-reload (`Ctrl+Shift+R`)

### Commands preview shows empty array

**Cause:** No blocks are connected to the `When Start` hat block.

1. Ensure the first block is snapped to `⚡ When Start`
2. All blocks must form a connected chain from the hat block

### Program runs but robot doesn't move

**Cause:** WebSocket connection dropped or commands aren't reaching the firmware.

1. Check the **Log** panel for error messages
2. Verify the status dot is green ("Online")
3. Ensure the ESP32 firmware is flashed and running (check Serial Monitor at 115200 baud)

### Build fails with TypeScript errors

**Cause:** TypeScript strict mode is enabled.

```bash
# Clear node_modules and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Dev server won't start on port 8080

**Cause:** Port is in use.

```bash
# Find and kill the process using port 8080
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```
