# Beetlebot_Blockly

A visual programming education platform that uses Google Blockly to teach learners how to build logic for the BeetleBot remote-controlled car. Instead of debugging C++ syntax, students arrange blocks whose behavior translates into actual vehicle movements and sensor handling — a safer entry point into robotics.

## System Overview

The project is split into two halves:

- **Frontend:** A web interface where users drag and drop Blockly blocks (`src/` / `index.html`).
- **Generation Layer:** Block generators convert those visual graphs into C++ source code for Arduino, saved in a `.ino` file with the `#include <Servo.h>` stack — the actual firmware that runs on the ESP32 controller.

## Prerequisites

Before you can start, make sure your system has:

- **Node.js 18+** & **npm:** To build and serve the web interface
- **Arduino IDE (Optional):** Only if you plan to upload the generated `.ino` file directly onto an actual BeetleBot car
- **Web browser:** Chrome or Firefox are recommended for the Blockly workspace
- **Hardware:**
  - BeetleBot car with ESP32 controller
  - WiFi network (robot and computer on same network)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/Beetlebot_Blockly.git
cd Beetlebot_Blockly
```

### 2. Install Dependencies

```bash
npm install
```

This installs all build dependencies including:

- `webpack` & `webpack-cli` — bundler
- `blockly` — visual block editor
- `typescript` — type-safe development
- `ts-loader` — TypeScript compilation

### 3. Build the Project

```bash
npm run build
```

Compiled assets will be output to the `/dist` directory.

### 4. Start the Development Server (Optional)

```bash
npm start
```

This runs the development server at `http://localhost:8080`.

## Usage

### Running the Application

**Option A: Development Server**

```bash
npm start
# Open http://localhost:8080 in your browser
```

**Option B: Production Build**

```bash
npm run build
# Serve the /dist folder with any static server
# e.g., npx serve dist
```

### Connecting to BeetleBot

1. Power on your BeetleBot and ensure it's connected to WiFi
2. In the web interface, enter the robot's IP address in the **Robot IP** field (default: `192.168.1.100`)
3. Click **Connect** to establish a connection
4. The status indicator will change to "Online" when connected

### Using Blockly Blocks

1. **Drag blocks** from the toolbox on the left into the workspace
2. **Arrange logic** — for example:
   - "If sensor detects obstacle → Stop"
   - "Move forward for 2 seconds → Turn left"
3. Click **GENERATE CODE** to produce the Arduino sketch
4. The generated C++ code appears in the **Commands** panel

### Quick Controls

Use the D-pad for manual control:

| Button | Action |
|--------|--------|
| ▲ | Move forward |
| ▼ | Move backward |
| ◀ | Turn left |
| ▶ | Turn right |
| ■ | Stop |

### Running Programs

1. Click **▶ Run Program** to execute your block logic on the robot
2. Click **⏹ Stop** to halt execution
3. Monitor the **Log** panel for real-time feedback from the robot's sensors

### Uploading to Hardware (Optional)

If you have a physical robot and want to flash the generated code:

1. Click **GENERATE CODE** in the Blockly workspace
2. Copy the generated `.ino` code
3. Open the Arduino IDE
4. Paste the code and upload to your ESP32 controller

## Project Structure

```
Beetlebot_Blockly/
├── dist/                     # Compiled assets for browser use
├── public/                   # Static resources (images, icons)
├── src/
│   ├── assets/               # Static assets loaded by the app
│   ├── blocks/               # Blockly block definitions
│   ├── execution/            # Runtime execution logic
│   ├── generators/           # Code generators (Blockly → C++)
│   ├── theme/                # Custom Blockly theme
│   ├── wifi/                 # WiFi connection handling
│   ├── index.ts              # Main entry point
│   └── styles.css            # Application styles
├── index.html                # Main HTML template
├── package.json              # NPM dependencies & scripts
├── webpack.config.js         # Build configuration
└── beetlebot_code.ino        # Generated Arduino sketch
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server on port 8080 |
| `npm run build` | Build production assets to `/dist` |

## Future Roadmap

[TO BE IMPROVED] — Currently a straightforward block → C++ generator. Next steps: more granular handling of stereo-vision inputs, and an interactive simulation mode before going to hardware.

## Support & Feedback

- **Issues:** Report bugs or request features via the GitHub issue tracker
- **Questions:** For help with robot wiring or hardware setup, check the project documentation

## License

[TO BE ADDED] — Specify your license (e.g., MIT, Apache-2.0) and include a LICENSE file.