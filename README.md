# Beetlebot_Blockly

A visual programming editor for BeetleBot ESP32 robots. Students arrange Blockly blocks; the app generates JavaScript commands and sends them over WebSocket to control the robot in real time.

## System Overview

- **Frontend:** Blockly workspace where users drag and drop blocks (`src/` / `index.html`)
- **Execution Layer:** Block generators produce JavaScript that pushes commands (`F`, `B`, `L`, `R`, etc.) to a queue, which `CommandExecutor` sends to the robot over WebSocket (`ws://<ip>:8266`)

This is not a C++ compiler — generated code runs in-browser and communicates with the ESP32 firmware over WiFi.

## Prerequisites

- **Node.js 18+** & **npm**
- **Web browser** (Chrome or Firefox)
- **Hardware:** BeetleBot car with ESP32, same WiFi network as your computer

## Installation

```bash
npm install
npm run build      # production build → dist/
npm start          # dev server → http://127.0.0.1:8080
```

## Usage

### Connect to Robot

1. Power on BeetleBot
2. Enter the robot's IP in the **Robot IP** field (default: `192.168.4.1`)
3. Click **Connect** — status changes to "Online"

### Build Logic with Blocks

Drag blocks from the toolbox into the workspace. The **Commands** panel updates live with the generated command queue. Click **▶ Run Program** to send commands to the robot.

### Quick Controls

| Button | Action |
|--------|--------|
| ▲ | Forward |
| ▼ | Backward |
| ◀ | Turn left |
| ▶ | Turn right |
| ■ | Stop |

## Project Structure

```
Beetlebot_Blockly/
├── dist/                     # Compiled bundle
├── public/                   # Static assets (icons, manifest)
├── src/
│   ├── blocks/               # Blockly block definitions
│   ├── execution/            # Command queue executor over WebSocket
│   ├── generators/           # Block → JS generators
│   ├── wifi/                 # WebSocket client (ws://<ip>:8266)
│   ├── index.ts              # Entry point, workspace setup, UI
│   └── styles.css            # Application styles
├── index.html                # HTML template
├── package.json
├── webpack.config.js
├── tsconfig.json
├── AGENTS.md                 # Agent instructions
├── DESIGN.md                 # Ignite Dark design system
└── beetlebot_code.ino        # ESP32 firmware (separate project artifact)
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Dev server on port 8080 |
| `npm run build` | Production build to `dist/` |

## Design

See `DESIGN.md` — dark theme (Ignite Dark), Poppins font, 8px spacing grid, orange primary (#FF6F20). Blockly uses `Blockly.Themes.Zelos`.