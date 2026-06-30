import * as Blockly from "blockly/core";

// ============================================================================
// BLOCK TYPE CONSTANTS - Organized by Category
// ============================================================================

export const BLOCK_TYPES = {
  // ⚡ Events
  WHEN_START: "when_start",

  // 🚗 Movement (Blue)
  GO_FORWARD: "go_forward",
  GO_BACKWARD: "go_backward",
  TURN_LEFT: "turn_left",
  TURN_RIGHT: "turn_right",
  TURN_LEFT_ANGLE: "turn_left_angle",
  TURN_RIGHT_ANGLE: "turn_right_angle",
  STOP: "stop",

  // 🤖 Actions (Orange)
  GRAB: "grab",
  RELEASE: "release",

  // ⏱️ Time (Gray)
  WAIT: "wait",

  // 🔄 Loops (Green)
  REPEAT: "repeat",
  WHILE: "while",
  REPEAT_UNTIL: "repeat_until",
  COUNT_WITH: "count_with",
  BREAK: "break_loop",

  // 🧠 Decisions (Yellow)
  IF: "beetlebot_if",
  IF_ELSE: "beetlebot_if_else",

  // 🔀 Logic (Gray - Comparisons)
  COMPARE: "beetlebot_compare",
  LOGIC_AND: "beetlebot_and",
  LOGIC_OR: "beetlebot_or",
  LOGIC_NOT: "beetlebot_not",
  TRUE: "beetlebot_true",
  FALSE: "beetlebot_false",
  // 🔢 Variables (Teal)
  VARIABLE_SET: "variable_set",
  VARIABLE_GET: "variable_get",
  VARIABLE_CHANGE: "variable_change",
  VARIABLE_INCREMENT: "variable_increment",
  VARIABLE_DECREMENT: "variable_decrement",

  // 📡 Sensors (Cyan)
  READ_DISTANCE: "read_distance",
  DISTANCE_THRESHOLD: "distance_threshold",
  TOF_TRIGGER_CLAW: "tof_trigger_claw",
  WAIT_FOR_OBJECT: "wait_for_object",
} as const;

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

// ============================================================================
// DEFINE ALL BLOCKS
// ============================================================================

export function defineBeetleBotBlocks() {
  Blockly.defineBlocksWithJsonArray([
    // ========================================================================
    // ⚡ EVENT: WHEN START
    // ========================================================================
    {
      type: BLOCK_TYPES.WHEN_START,
      message0: "⚡ When Start",
      nextStatement: null,
      colour: COLOUR_EVENTS,
      tooltip: "Program starts here",
    },

    // ========================================================================
    // 🚗 MOVEMENT BLOCKS
    // ========================================================================
    {
      type: BLOCK_TYPES.GO_FORWARD,
      message0: "▶️ Go Forward!",
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_MOVEMENT,
      tooltip: "Drive forward",
    },
    {
      type: BLOCK_TYPES.GO_BACKWARD,
      message0: "🔙 Go Backward!",
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_MOVEMENT,
      tooltip: "Drive backward",
    },
    {
      type: BLOCK_TYPES.TURN_LEFT,
      message0: "↩️ Turn Left",
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_MOVEMENT,
      tooltip: "Turn left 90 degrees",
    },
    {
      type: BLOCK_TYPES.TURN_RIGHT,
      message0: "↪️ Turn Right",
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_MOVEMENT,
      tooltip: "Turn right 90 degrees",
    },
    {
      type: BLOCK_TYPES.TURN_LEFT_ANGLE,
      message0: "↩️ Turn Left %1°",
      args0: [
        {
          type: "field_angle",
          name: "ANGLE",
          value: 90,
          offset: 90,
          clockwise: false,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_MOVEMENT,
      tooltip: "Turn left by a chosen angle",
    },
    {
      type: BLOCK_TYPES.TURN_RIGHT_ANGLE,
      message0: "↪️ Turn Right %1°",
      args0: [
        {
          type: "field_angle",
          name: "ANGLE",
          value: 90,
          offset: 90,
          clockwise: true,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_MOVEMENT,
      tooltip: "Turn right by a chosen angle",
    },
    {
      type: BLOCK_TYPES.STOP,
      message0: "⬛ Stop!",
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_MOVEMENT,
      tooltip: "Stop all motors",
    },

    // ========================================================================
    // 🤖 ACTION BLOCKS
    // ========================================================================
    {
      type: BLOCK_TYPES.GRAB,
      message0: "✊ Grab",
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_ACTIONS,
      tooltip: "Close claw to grab object",
    },
    {
      type: BLOCK_TYPES.RELEASE,
      message0: "✋ Release",
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_ACTIONS,
      tooltip: "Open claw to release object",
    },

    // ========================================================================
    // ⏱️ TIME BLOCKS
    // ========================================================================
    {
      type: BLOCK_TYPES.WAIT,
      message0: "⏲️ Wait %1 seconds",
      args0: [
        {
          type: "field_number",
          name: "SECONDS",
          value: 1,
          min: 1,
          max: 60,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_TIME,
      tooltip: "Wait for specified seconds",
    },

    // ========================================================================
    // 🔄 LOOP BLOCKS
    // ========================================================================
    {
      type: BLOCK_TYPES.REPEAT,
      message0: "🔁 Repeat %1 times",
      args0: [
        {
          type: "field_number",
          name: "TIMES",
          value: 5,
          min: 1,
          max: 100,
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_LOOPS,
      tooltip: "Repeat the blocks inside",
    },
    {
      type: BLOCK_TYPES.WHILE,
      message0: "🔄 While %1",
      args0: [
        {
          type: "input_value",
          name: "CONDITION",
          check: "Boolean",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_LOOPS,
      tooltip: "Repeat while condition is true (with max iterations)",
    },
    {
      type: BLOCK_TYPES.REPEAT_UNTIL,
      message0: "🔄 Repeat until %1",
      args0: [
        {
          type: "input_value",
          name: "CONDITION",
          check: "Boolean",
        },
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_LOOPS,
      tooltip: "Repeat until the condition becomes true",
    },
    {
      type: BLOCK_TYPES.COUNT_WITH,
      message0: "🔢 Count with %1 from %2 to %3",
      args0: [
        {
          type: "field_input",
          name: "VAR",
          text: "i",
        },
        {
          type: "input_value",
          name: "FROM",
          check: "Number",
        },
        {
          type: "input_value",
          name: "TO",
          check: "Number",
        },
      ],
      message1: "do %1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_LOOPS,
      tooltip: "Run the blocks inside, counting from a start number to an end number",
    },
    {
      type: BLOCK_TYPES.BREAK,
      message0: "🛑 Break loop",
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_LOOPS,
      tooltip: "Stop and exit the loop you are inside",
    },

    // ========================================================================
    // 🧠 DECISION BLOCKS
    // ========================================================================
    {
      type: BLOCK_TYPES.IF,
      message0: "❓ If %1",
      args0: [
        {
          type: "input_value",
          name: "CONDITION",
          check: "Boolean",
        },
      ],
      message1: "then %1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_DECISIONS,
      tooltip: "If condition is true, do the blocks inside",
    },
    {
      type: BLOCK_TYPES.IF_ELSE,
      message0: "❓ If %1",
      args0: [
        {
          type: "input_value",
          name: "CONDITION",
          check: "Boolean",
        },
      ],
      message1: "then %1",
      args1: [
        {
          type: "input_statement",
          name: "DO",
        },
      ],
      message2: "else %1",
      args2: [
        {
          type: "input_statement",
          name: "ELSE",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_DECISIONS,
      tooltip: "If true do this, else do that",
    },

    // ========================================================================
    // 🔀 LOGIC BLOCKS
    // ========================================================================
    {
      type: BLOCK_TYPES.COMPARE,
      message0: "%1 %2 %3",
      args0: [
        {
          type: "input_value",
          name: "A",
          check: "Number",
        },
        {
          type: "field_dropdown",
          name: "OP",
          options: [
            ["=", "EQ"],
            [">", "GT"],
            ["<", "LT"],
            ["≥", "GTE"],
            ["≤", "LTE"],
            ["≠", "NEQ"],
          ],
        },
        {
          type: "input_value",
          name: "B",
          check: "Number",
        },
      ],
      output: "Boolean",
      colour: COLOUR_LOGIC,
      tooltip: "Compare two numbers",
    },
    {
      type: BLOCK_TYPES.LOGIC_AND,
      message0: "%1 ✅ AND %2",
      args0: [
        {
          type: "input_value",
          name: "A",
          check: "Boolean",
        },
        {
          type: "input_value",
          name: "B",
          check: "Boolean",
        },
      ],
      output: "Boolean",
      colour: COLOUR_LOGIC,
      tooltip: "Both must be true",
    },
    {
      type: BLOCK_TYPES.LOGIC_OR,
      message0: "%1 🔀 OR %2",
      args0: [
        {
          type: "input_value",
          name: "A",
          check: "Boolean",
        },
        {
          type: "input_value",
          name: "B",
          check: "Boolean",
        },
      ],
      output: "Boolean",
      colour: COLOUR_LOGIC,
      tooltip: "Either can be true",
    },
    {
      type: BLOCK_TYPES.LOGIC_NOT,
      message0: "⛔ NOT %1",
      args0: [
        {
          type: "input_value",
          name: "BOOL",
          check: "Boolean",
        },
      ],
      output: "Boolean",
      colour: COLOUR_LOGIC,
      tooltip: "Flip true to false or false to true",
    },
    {
      type: BLOCK_TYPES.TRUE,
      message0: "✔️ Yes",
      output: "Boolean",
      colour: COLOUR_LOGIC,
      tooltip: "True/Yes value",
    },
    {
      type: BLOCK_TYPES.FALSE,
      message0: "❌ No",
      output: "Boolean",
      colour: COLOUR_LOGIC,
      tooltip: "False/No value",
    },

    // ========================================================================
    // 🔢 VARIABLE BLOCKS
    // ========================================================================
    {
      type: BLOCK_TYPES.VARIABLE_SET,
      message0: "📦 Set %1 = %2",
      args0: [
        {
          type: "field_input",
          name: "VAR_NAME",
          text: "counter",
        },
        {
          type: "input_value",
          name: "VALUE",
          check: "Number",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_VARIABLES,
      tooltip: "Set a variable to a value",
    },
    {
      type: BLOCK_TYPES.VARIABLE_GET,
      message0: "📦 %1",
      args0: [
        {
          type: "field_input",
          name: "VAR_NAME",
          text: "counter",
        },
      ],
      output: "Number",
      colour: COLOUR_VARIABLES,
      tooltip: "Get a variable value",
    },
    {
      type: BLOCK_TYPES.VARIABLE_CHANGE,
      message0: "📦 Change %1 by %2",
      args0: [
        {
          type: "field_input",
          name: "VAR_NAME",
          text: "counter",
        },
        {
          type: "input_value",
          name: "DELTA",
          check: "Number",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_VARIABLES,
tooltip: "Change a variable by a value (positive or negative)",
    },
    {
      type: BLOCK_TYPES.VARIABLE_INCREMENT,
      message0: "➕ Increase %1 by 1",
      args0: [
        {
          type: "field_input",
          name: "VAR_NAME",
          text: "counter",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_VARIABLES,
      tooltip: "Add 1 to a variable",
    },
    {
      type: BLOCK_TYPES.VARIABLE_DECREMENT,
      message0: "➖ Decrease %1 by 1",
      args0: [
        {
          type: "field_input",
          name: "VAR_NAME",
          text: "counter",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_VARIABLES,
      tooltip: "Subtract 1 from a variable",
    },

    // ========================================================================
    // 📡 SENSOR BLOCKS (TOF)
    // ========================================================================
    {
      type: BLOCK_TYPES.READ_DISTANCE,
      message0: "📏 Distance (mm)",
      output: "Number",
      colour: COLOUR_SENSORS,
      tooltip: "Read distance from TOF sensor in millimeters",
    },
    {
      type: BLOCK_TYPES.DISTANCE_THRESHOLD,
      message0: "📏 Distance < %1 mm?",
      args0: [
        {
          type: "input_value",
          name: "THRESHOLD",
          check: "Number",
        },
      ],
      output: "Boolean",
      colour: COLOUR_SENSORS,
      tooltip: "True if object detected within threshold distance",
    },
    {
      type: BLOCK_TYPES.TOF_TRIGGER_CLAW,
      message0: "🎯 TOF Auto-Trigger %1",
      args0: [
        {
          type: "field_dropdown",
          name: "STATE",
          options: [
            ["ON", "ON"],
            ["OFF", "OFF"],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_SENSORS,
      tooltip: "Enable/disable automatic claw trigger when object detected",
    },
    {
      type: BLOCK_TYPES.WAIT_FOR_OBJECT,
      message0: "⏳ Wait for Object < %1 mm",
      args0: [
        {
          type: "input_value",
          name: "THRESHOLD",
          check: "Number",
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLOUR_SENSORS,
      tooltip: "Wait until object detected within threshold distance",
    },
  ]);
}
