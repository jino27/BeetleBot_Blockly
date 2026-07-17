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
src/
├── index.ts                    Entry point — Blockly workspace, UI wiring
├── styles.css                  All application styles (dark theme)
├── blocks/
│   └── beetlebot_blocks.ts     Blockly block definitions (JSON)
├── generators/
│   ├── block_tree_export.ts    Converts workspace → JSON tree
│   └── beetlebot_generator.ts  (legacy — empty, interpreter drives WS directly)
├── execution/
│   ├── interpreter.ts          Tree-walking interpreter (browser-side)
│   ├── command_executor.ts     Abort controller + command lifecycle
│   └── expr_eval.ts            Custom expression lexer/parser/evaluator
├── wifi/
│   └── web_socket.ts           WebSocket client (ws://<ip>:8266)
└── assets/
    └── img/
        └── beetlebot.png       Robot logo image
```

**Key flow:** Blocks → `block_tree_export.ts` produces a JSON tree → `interpreter.ts` walks the tree and generates commands → `command_executor.ts` sends each command over WebSocket via `web_socket.ts`.

## Adding or modifying blocks

1. Define the block JSON in `src/blocks/beetlebot_blocks.ts` (add to `BLOCK_TYPES` const and `defineBeetleBotBlocks()`)
2. Add the block to the toolbox in `src/index.ts` `getToolbox()`
3. (Optional) Register a legacy generator in `src/generators/beetlebot_generator.ts` if needed for Blockly's built-in preview.

Block type strings must match exactly across all three locations.

## Gotchas

- **Interpreter drives execution, not the generator.** `interpreter.ts` is the source of truth for block-to-command logic. `beetlebot_generator.ts` exists but is not used at runtime.
- **Expression evaluation is custom.** `expr_eval.ts` provides a lexer/parser/evaluator for block expressions. It uses a custom grammar, not JavaScript `eval()`.
- **`updatePreview()` uses `javascriptGenerator.workspaceToCode()`** (Blockly's built-in), not the custom generator. This is intentional — executing the interpreter during editing can crash on while loops.
- **WebSocket protocol:** Commands are plain strings (`F`, `B`, `L`, `R`, `S`, `C`, `O`, `TURN:L:90`, `DIST`, `SPEED:100`, `CLEAR`, `TOF_TRIGGER:0/1`). Responses use format `id:data` for request/response matching, or plain text for unsolicited data.
- **Default robot IP** is `192.168.4.1` (ESP32 AP mode). Stored in `localStorage` as `esp32-ip`.
- **PWA:** `service-worker.js` and `manifest.json` exist. Service worker caches `index.html` and `manifest.json`.
- **`beetlebot_code.ino`** at root is a generated Arduino sketch artifact — not the source of truth. The real logic is in the TypeScript interpreters.

## Design system

See `DESIGN.md` — dark theme ("Ignite Dark"), Poppins font, 8px spacing grid, orange primary (#FF6F20). The Blockly theme uses `Blockly.Themes.Zelos`.
