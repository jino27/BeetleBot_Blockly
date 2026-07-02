# AGENTS.md — BeetleBot Blockly

## What is this

A web-based visual programming editor (Blockly) that generates Arduino C++ code for ESP32 BeetleBot robots. Students drag blocks; the app translates them to firmware commands and sends them over WebSocket to a physical robot.

## Commands

```bash
npm install          # install deps
npm run build        # production build → /dist
npm start            # dev server → http://127.0.0.1:8080
```

No lint, test, or typecheck scripts exist. TypeScript strict mode is on (`tsconfig.json`). Build output goes to `dist/bundle.js`.

## Architecture

```
src/index.ts                    ← entry point, Blockly workspace setup, UI wiring
src/blocks/beetlebot_blocks.ts  ← Blockly block definitions (JSON arrays)
src/generators/beetlebot_generator.ts  ← block → JS code generators (queue.push format)
src/execution/command_executor.ts      ← runs generated command queue over WiFi
src/wifi/web_socket.ts          ← WebSocket to ESP32 (ws://<ip>:8266)
```

**Key flow:** Blocks → `beetlebot_generator.ts` produces JS that pushes `{cmd, val, ms}` objects to a `queue[]` array → `command_executor.ts` iterates the queue and sends each command over WebSocket.

## Adding or modifying blocks

1. Define the block JSON in `src/blocks/beetlebot_blocks.ts` (add to `BLOCK_TYPES` const and `defineBeetleBotBlocks()`)
2. Register a generator in `src/generators/beetlebot_generator.ts` (`javascriptGenerator.forBlock[...]`)
3. Add the block to the toolbox in `src/index.ts` `getToolbox()`

Block type strings must match exactly across all three locations.

## Gotchas

- **Generated code is JS, not C++.** The generator outputs JavaScript that runs in-browser via `new Function()`. The `PREAMBLE` string in `beetlebot_generator.ts` defines the runtime (`sendCommand`, `getDistance`, `sleep`, etc.). Changes to the preamble affect runtime behavior.
- **While loops with TOF sensors** are handled specially: `_WHILE`/`_ENDWHILE` sentinel commands in the queue are intercepted by `CommandExecutor.executeRealTimeWhile()`, not evaluated as JS loops. This is because sensor reads need real-time WebSocket calls.
- **`updatePreview()` uses `javascriptGenerator.workspaceToCode()`** (Blockly's built-in), not the custom generator. This is intentional — executing the custom generator during editing can crash on while loops.
- **WebSocket protocol:** Commands are plain strings (`F`, `B`, `L`, `R`, `S`, `C`, `O`, `TURN:L:90`, `DIST`, `SPEED:100`, `CLEAR`, `TOF_TRIGGER:0/1`). Responses use format `id:data` for request/response matching, or plain text for unsolicited data.
- **Default robot IP** is `192.168.4.1` (ESP32 AP mode). Stored in `localStorage` as `esp32-ip`.
- **PWA:** `service-worker.js` and `manifest.json` exist. Service worker caches `index.html` and `manifest.json`.
- **`beetlebot_code.ino`** at root is a generated Arduino sketch artifact — not the source of truth. The real logic is in the TypeScript generators.

## Design system

See `DESIGN.md` — dark theme ("Ignite Dark"), Poppins font, 8px spacing grid, orange primary (#FF6F20). The Blockly theme uses `Blockly.Themes.Zelos`.
