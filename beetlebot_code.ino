/**
 * BeetleBot ESP32-WROOM-32E
 * WebSocket control + OTA updates + Timed Command Queue + WiFi Config
 * JSON command protocol via WebSocket
 */

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoOTA.h>
// Wire + VL53L0X for TOF distance broadcast
#include <Wire.h>
#include <VL53L0X.h>
#define ARDUINOJSON_DEFAULT_NESTING_LIMIT 50
#include <ArduinoJson.h>

// ============== AP CONFIG ==============
const char* AP_SSID = "BeetleBot";
const char* AP_PASS = "12345678";

// ============== PINS ==============
#define STBY_PIN  17
#define PWMA_PIN  25
#define PWMB_PIN  26
#define AIN1_PIN  27
#define AIN2_PIN  14
#define BIN1_PIN  16
#define BIN2_PIN  13
#define SERVO_PIN 15
#define LED_PIN   2
#define TOF_SDA   18
#define TOF_SCL   5

// ============== TOF CONFIG ==============
#define TOF_DETECT_DISTANCE  200  // mm - trigger distance (unused, kept for reference)

// ============== SERVO CONFIG ==============
#define SERVO_FREQ  50
#define SERVO_RES   16
#define OPEN_US     1500
#define CLOSE_US    500

// ============== MOTOR CONTROLLER ==============
class MotorController {
public:
    MotorController() {
        pinMode(STBY_PIN, OUTPUT); digitalWrite(STBY_PIN, HIGH);
        pinMode(AIN1_PIN, OUTPUT); pinMode(AIN2_PIN, OUTPUT);
        pinMode(BIN1_PIN, OUTPUT); pinMode(BIN2_PIN, OUTPUT);
        ledcAttach(PWMA_PIN, 5000, 8);
        ledcAttach(PWMB_PIN, 5000, 8);
        stop();
    }

    void setMotorA(int speed) {
        if (speed > 0) {
            digitalWrite(AIN1_PIN, HIGH); digitalWrite(AIN2_PIN, LOW);
        } else if (speed < 0) {
            digitalWrite(AIN1_PIN, LOW); digitalWrite(AIN2_PIN, HIGH);
        } else {
            digitalWrite(AIN1_PIN, LOW); digitalWrite(AIN2_PIN, LOW);
        }
        ledcWrite(PWMA_PIN, constrain(abs(speed), 0, 255));
    }

    void setMotorB(int speed) {
        if (speed > 0) {
            digitalWrite(BIN1_PIN, HIGH); digitalWrite(BIN2_PIN, LOW);
        } else if (speed < 0) {
            digitalWrite(BIN1_PIN, LOW); digitalWrite(BIN2_PIN, HIGH);
        } else {
            digitalWrite(BIN1_PIN, LOW); digitalWrite(BIN2_PIN, LOW);
        }
        ledcWrite(PWMB_PIN, constrain(abs(speed), 0, 255));
    }

    void stop() {
        digitalWrite(AIN1_PIN, LOW); digitalWrite(AIN2_PIN, LOW);
        digitalWrite(BIN1_PIN, LOW); digitalWrite(BIN2_PIN, LOW);
        ledcWrite(PWMA_PIN, 0); ledcWrite(PWMB_PIN, 0);
    }

    void brake() {
        digitalWrite(AIN1_PIN, HIGH); digitalWrite(AIN2_PIN, HIGH);
        digitalWrite(BIN1_PIN, HIGH); digitalWrite(BIN2_PIN, HIGH);
        ledcWrite(PWMA_PIN, 255); ledcWrite(PWMB_PIN, 255);
        delay(100);
        stop();
    }
};

// ============== CLAW CONTROLLER (native ledc - same as test code) ==============
class ClawController {
private:
    bool initialized = false;

    int usToDuty(int us) {
        return (us * 65535) / 20000;
    }

    void setMicroseconds(int us) {
        if (!initialized) return;
        us = constrain(us, 500, 2500);
        int duty = usToDuty(us);
        ledcWrite(SERVO_PIN, duty);
    }

public:
    ClawController() {}

    void begin() {
        if (!initialized) {
            pinMode(SERVO_PIN, OUTPUT);
            digitalWrite(SERVO_PIN, LOW);
            ledcAttach(SERVO_PIN, SERVO_FREQ, SERVO_RES);
            initialized = true;

            Serial.println("[CLAW] Initialized on pin " + String(SERVO_PIN));

            // Boot test sweep - same as standalone test
            Serial.println("[CLAW] Boot test sweep...");
            setMicroseconds(1000); delay(300);
            setMicroseconds(2000); delay(300);
            setMicroseconds(OPEN_US); delay(300);
            Serial.println("[CLAW] Boot test complete, set to OPEN");
        }
    }

    void open() {
        if (!initialized) { Serial.println("[CLAW] ERROR: Not initialized"); return; }
        setMicroseconds(OPEN_US);
        Serial.println("[CLAW] OPEN (" + String(OPEN_US) + "us)");
    }

    void close() {
        if (!initialized) { Serial.println("[CLAW] ERROR: Not initialized"); return; }
        setMicroseconds(CLOSE_US);
        Serial.println("[CLAW] CLOSE (" + String(CLOSE_US) + "us)");
    }

    // Close and open N times
    void testCycle(int times) {
        if (!initialized) { Serial.println("[CLAW] ERROR: Not initialized"); return; }
        Serial.println("[CLAW] Test cycle x" + String(times));
        for (int i = 0; i < times; i++) {
            Serial.println("[CLAW] Cycle " + String(i + 1) + "/" + String(times) + " CLOSE");
            setMicroseconds(CLOSE_US);
            delay(300);
            Serial.println("[CLAW] Cycle " + String(i + 1) + "/" + String(times) + " OPEN");
            setMicroseconds(OPEN_US);
            delay(300);
        }
        Serial.println("[CLAW] Test cycle complete");
    }

    bool isAttached() { return initialized; }
};

// ============== TOF SENSOR CONTROLLER ==============
class TOFSensor {
private:
    VL53L0X sensor;
    bool initialized = false;

public:
    TOFSensor() {}

    bool begin() {
        Serial.println("[TOF] Initializing on SDA=" + String(TOF_SDA) + " SCL=" + String(TOF_SCL));
        Wire.begin(TOF_SDA, TOF_SCL);
        Wire.setClock(100000);  // 100kHz for stability
        
        delay(100);
        
        sensor.setTimeout(500);
        
        if (!sensor.init()) {
            Serial.println("[TOF] FAILED: Not detected!");
            Serial.println("[TOF] Check wiring: VCC->3.3V, GND->GND, SCL->GPIO5, SDA->GPIO18, XSHUT->3.3V");
            initialized = false;
            return false;
        }
        
        // Configure sensor
        sensor.setSignalRateLimit(0.1);
        sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodPreRange, 18);
        sensor.setVcselPulsePeriod(VL53L0X::VcselPeriodFinalRange, 14);
        sensor.setMeasurementTimingBudget(200000);
        
        initialized = true;
        Serial.println("[TOF] SUCCESS: Sensor detected and configured!");
        return true;
    }

    int readDistance() {
        if (!initialized) return -1;
        int dist = sensor.readRangeSingleMillimeters();
        if (sensor.timeoutOccurred()) {
            Serial.println("[TOF] Timeout!");
            return -1;
        }
        return dist;
    }

    bool isReady() { return initialized; }
};

// ============== ROBOT CONTEXT ==============
class RobotContext {
private:
    MotorController motors;
    ClawController claw;
    TOFSensor tof;
    int currentSpeed;
    
    static const int SPEED_DEFAULT = 100;
    static const int SPEED_MIN = 60;
    static const int SPEED_MAX = 255;
    static const int SPEED_STEP = 20;

public:
    RobotContext() : currentSpeed(SPEED_DEFAULT) {
        pinMode(LED_PIN, OUTPUT);
        digitalWrite(LED_PIN, LOW);
    }

    void begin() {
        // Initialize claw first (boot test)
        claw.begin();
        delay(500);

        // Initialize TOF sensor
        bool tofOk = tof.begin();
        delay(500);
    }

    MotorController& getMotors() { return motors; }
    ClawController& getClaw() { return claw; }
    TOFSensor& getTOF() { return tof; }

    int getSpeed() const { return currentSpeed; }
    void setSpeed(int speed) {
        currentSpeed = constrain(speed, SPEED_MIN, SPEED_MAX);
    }
    void increaseSpeed() { setSpeed(currentSpeed + SPEED_STEP); }
    void decreaseSpeed() { setSpeed(currentSpeed - SPEED_STEP); }

    void setLED(bool on) { digitalWrite(LED_PIN, on ? HIGH : LOW); }
};

// ============== COMMAND QUEUE ==============
#define QUEUE_SIZE 32
#define CMD_DURATION 1000
#define TURN_SPEED 50
#define TURNING_SPEED_DPS 90.00f

struct Command {
    String action;
    int param;
    unsigned long durationMs;
};

class CommandQueue {
private:
    Command queue[QUEUE_SIZE];
    int head = 0;
    int tail = 0;
    int count = 0;
    unsigned long cmdStartTime = 0;
    unsigned long currentDurationMs = CMD_DURATION;
    bool isRunning = false;
    String currentAction;

public:
    bool isEmpty() { return count == 0; }
    bool isFull() { return count >= QUEUE_SIZE; }

    void enqueue(String action, int param = 0, unsigned long durationMs = CMD_DURATION) {
        if (isFull()) return;
        queue[tail].action = action;
        queue[tail].param = param;
        queue[tail].durationMs = durationMs;
        tail = (tail + 1) % QUEUE_SIZE;
        count++;
    }

    void clear() {
        head = tail = count = 0;
        isRunning = false;
        currentDurationMs = CMD_DURATION;
        currentAction = "";
    }

    void update(RobotContext* robot, WebSocketsServer* ws, uint8_t clientNum) {
        unsigned long now = millis();

        if (isRunning) {
            if (now - cmdStartTime >= currentDurationMs) {
                if (currentAction == "L" || currentAction == "R") {
                    robot->getMotors().brake();
                } else {
                    robot->getMotors().stop();
                }
                isRunning = false;
                if (ws && clientNum != 255) {
                    String json;
                    StaticJsonDocument<96> d;
                    d["status"] = "done";
                    d["action"] = currentAction;
                    serializeJson(d, json);
                    ws->sendTXT(clientNum, json);
                }
            }
            return;
        }

        if (count > 0) {
            Command& cmd = queue[head];
            head = (head + 1) % QUEUE_SIZE;
            count--;

            currentAction = cmd.action;
            cmdStartTime = now;
            if (currentAction == "L" || currentAction == "R") {
                currentDurationMs = turnDurationMs(cmd.param);
            } else {
                currentDurationMs = cmd.durationMs;
            }
            isRunning = true;

            executeCommand(robot, cmd);

            if (ws && clientNum != 255) {
                String json;
                StaticJsonDocument<96> d;
                d["status"] = "exec";
                d["action"] = currentAction;
                serializeJson(d, json);
                ws->sendTXT(clientNum, json);
            }
        }
    }

    void executeCommand(RobotContext* robot, Command& cmd) {
        String action = cmd.action;
        action.toUpperCase();
        int spd = robot->getSpeed();

        if (action == "F" || action == "FORWARD") {
            robot->getMotors().setMotorA(-spd);
            robot->getMotors().setMotorB(spd);
        }
        else if (action == "B" || action == "BACKWARD") {
            robot->getMotors().setMotorA(spd);
            robot->getMotors().setMotorB(-spd);
        }
        else if (action == "L" || action == "LEFT") {
            robot->getMotors().setMotorA(TURN_SPEED);
            robot->getMotors().setMotorB(TURN_SPEED);
        }
        else if (action == "R" || action == "RIGHT") {
            robot->getMotors().setMotorA(-TURN_SPEED);
            robot->getMotors().setMotorB(-TURN_SPEED);
        }
        else if (action == "S" || action == "STOP" || action == "/") {
            robot->getMotors().stop();
        }
        else if (action == "BRAKE") {
            robot->getMotors().brake();
        }
        else if (action == "O" || action == "OPEN") {
            robot->getClaw().open();
        }
        else if (action == "C" || action == "CLOSE") {
            robot->getClaw().close();
        }
        else if (action == "+") {
            robot->increaseSpeed();
        }
        else if (action == "-") {
            robot->decreaseSpeed();
        }
        else if (action.startsWith("SPEED:")) {
            robot->setSpeed(cmd.param);
        }
        else if (action == "CLAWTEST") {
            robot->getClaw().testCycle(5);
        }
    }

    void emergencyStop(RobotContext* robot) {
        clear();
        robot->getMotors().stop();
    }

public:
    unsigned long turnDurationMs(int degrees) {
        degrees = constrain(degrees, 1, 360);
        return (unsigned long)round((degrees / TURNING_SPEED_DPS) * 1000.0f);
    }
};

// ============== GLOBALS ==============
RobotContext* robot = nullptr;
WebSocketsServer webSocket = WebSocketsServer(8266);
CommandQueue cmdQueue;
uint8_t activeClient = 255;

// ============== INTERPRETER GLOBALS ==============
static volatile bool stopRequested = false;
static volatile bool programRunning = false;
static TaskHandle_t interpreterTaskHandle = nullptr;

#define MAX_VARS 16
struct VarSlot {
  char name[24];
  float value;
  bool used;
};
static VarSlot varTable[MAX_VARS];

static float getVariable(const char* name);
static void setVariable(const char* name, float value);

struct InterpreterParams {
  String treeStr;
  RobotContext* robot;
  WebSocketsServer* ws;
  uint8_t clientNum;
};

static void interpreterTask(void* pvParameters);
static void executeBlockSet(JsonArray set);
static bool evalCondition(JsonVariant condNode);
static float resolveValue(JsonVariant valueNode);
static void interruptibleDelay(unsigned long ms);

static void broadcastEvent(const char* event, const char* blockType, bool useWs = true);

// ============== VARIABLE STORAGE ==============
static float getVariable(const char* name) {
  for (int i = 0; i < MAX_VARS; i++) {
    if (varTable[i].used && strcmp(varTable[i].name, name) == 0) {
      return varTable[i].value;
    }
  }
  return 0.0f;
}

static void setVariable(const char* name, float value) {
  for (int i = 0; i < MAX_VARS; i++) {
    if (varTable[i].used && strcmp(varTable[i].name, name) == 0) {
      varTable[i].value = value;
      return;
    }
  }
  for (int i = 0; i < MAX_VARS; i++) {
    if (!varTable[i].used) {
      strncpy(varTable[i].name, name, 23);
      varTable[i].name[23] = '\0';
      varTable[i].value = value;
      varTable[i].used = true;
      return;
    }
  }
}

// ============== INTERRUPTIBLE DELAY ==============
static void interruptibleDelay(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {
    if (stopRequested) return;
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

// ============== BROADCAST HELPER ==============
static void broadcastEvent(const char* event, const char* blockType, bool useWs) {
  if (!useWs || activeClient == 255) return;
  StaticJsonDocument<128> d;
  d["event"] = event;
  d["block"] = blockType;
  String json;
  serializeJson(d, json);
  webSocket.sendTXT(activeClient, json);
}

// ============== RECURSIVE TREE WALKER ==============

static float resolveValue(JsonVariant node) {
  if (!node.containsKey("type")) return 0.0f;
  const char* type = node["type"].as<const char*>();

  if (strcmp(type, "math_number") == 0) {
    return node["fields"]["NUM"].as<float>();
  }
  if (strcmp(type, "read_distance") == 0) {
    return robot->getTOF().readDistance();
  }
  if (strcmp(type, "variable_get") == 0) {
    const char* varName = node["fields"]["VAR_NAME"].as<const char*>();
    return getVariable(varName);
  }
  if (strcmp(type, "math_arithmetic") == 0) {
    const char* op = node["fields"]["OP"].as<const char*>();
    float a = 0, b = 0;
    if (node["inputs"].containsKey("A")) {
      a = resolveValue(node["inputs"]["A"]);
    }
    if (node["inputs"].containsKey("B")) {
      b = resolveValue(node["inputs"]["B"]);
    }
    if (strcmp(op, "ADD") == 0 || strcmp(op, "+") == 0) return a + b;
    if (strcmp(op, "MINUS") == 0 || strcmp(op, "-") == 0) return a - b;
    if (strcmp(op, "MULTIPLY") == 0 || strcmp(op, "*") == 0) return a * b;
    if (strcmp(op, "DIVIDE") == 0 || strcmp(op, "/") == 0) return (b != 0) ? a / b : 0;
    return 0;
  }
  if (strcmp(type, "beetlebot_true") == 0) return 1.0f;
  if (strcmp(type, "beetlebot_false") == 0) return 0.0f;
  return 0.0f;
}

static bool evalCondition(JsonVariant condNode) {
  if (!condNode.containsKey("type")) return false;
  const char* type = condNode["type"].as<const char*>();

  if (strcmp(type, "beetlebot_true") == 0) return true;
  if (strcmp(type, "beetlebot_false") == 0) return false;

  if (strcmp(type, "beetlebot_and") == 0) {
    bool a = evalCondition(condNode["inputs"]["A"]);
    bool b = evalCondition(condNode["inputs"]["B"]);
    return a && b;
  }
  if (strcmp(type, "beetlebot_or") == 0) {
    bool a = evalCondition(condNode["inputs"]["A"]);
    bool b = evalCondition(condNode["inputs"]["B"]);
    return a || b;
  }
  if (strcmp(type, "beetlebot_not") == 0) {
    return !evalCondition(condNode["inputs"]["BOOL"]);
  }
  if (strcmp(type, "beetlebot_compare") == 0) {
    const char* op = condNode["fields"]["OP"].as<const char*>();
    float a = resolveValue(condNode["inputs"]["A"]);
    float b = resolveValue(condNode["inputs"]["B"]);
    if (strcmp(op, "LT") == 0 || strcmp(op, "<") == 0) return a < b;
    if (strcmp(op, "GT") == 0 || strcmp(op, ">") == 0) return a > b;
    if (strcmp(op, "EQ") == 0 || strcmp(op, "=") == 0) return a == b;
    if (strcmp(op, "NEQ") == 0 || strcmp(op, "≠") == 0) return a != b;
    if (strcmp(op, "GTE") == 0 || strcmp(op, "≥") == 0) return a >= b;
    if (strcmp(op, "LTE") == 0 || strcmp(op, "≤") == 0) return a <= b;
    return false;
  }
  if (strcmp(type, "distance_check") == 0) {
    const char* op = condNode["fields"]["OP"].as<const char*>();
    float dist = robot->getTOF().readDistance();
    float threshold = resolveValue(condNode["inputs"]["THRESHOLD"]);
    if (strcmp(op, "LT") == 0) return dist < threshold;
    if (strcmp(op, "GT") == 0) return dist > threshold;
    if (strcmp(op, "EQ") == 0) return fabs(dist - threshold) < 1.0f;
    if (strcmp(op, "NEQ") == 0) return fabs(dist - threshold) >= 1.0f;
    if (strcmp(op, "GTE") == 0) return dist >= threshold;
    if (strcmp(op, "LTE") == 0) return dist <= threshold;
    return false;
  }
  return false;
}

static void executeStatement(JsonVariant node) {
  if (!node.containsKey("type")) return;
  const char* type = node["type"].as<const char*>();
  auto fields = node["fields"].as<JsonObject>();
  auto inputs = node["inputs"].as<JsonObject>();

  if (strcmp(type, "go_forward") == 0) {
    cmdQueue.enqueue("F", 0, 1000);
    while (!cmdQueue.isEmpty() && !stopRequested) {
      cmdQueue.update(robot, nullptr, 255);
      vTaskDelay(5 / portTICK_PERIOD_MS);
    }
    broadcastEvent("exec", "go_forward");
    return;
  }
  if (strcmp(type, "go_backward") == 0) {
    cmdQueue.enqueue("B", 0, 1000);
    while (!cmdQueue.isEmpty() && !stopRequested) {
      cmdQueue.update(robot, nullptr, 255);
      vTaskDelay(5 / portTICK_PERIOD_MS);
    }
    broadcastEvent("exec", "go_backward");
    return;
  }
  if (strcmp(type, "turn_left") == 0) {
    cmdQueue.enqueue("L", 90);
    while (!cmdQueue.isEmpty() && !stopRequested) {
      cmdQueue.update(robot, nullptr, 255);
      vTaskDelay(5 / portTICK_PERIOD_MS);
    }
    broadcastEvent("exec", "turn_left");
    return;
  }
  if (strcmp(type, "turn_right") == 0) {
    cmdQueue.enqueue("R", 90);
    while (!cmdQueue.isEmpty() && !stopRequested) {
      cmdQueue.update(robot, nullptr, 255);
      vTaskDelay(5 / portTICK_PERIOD_MS);
    }
    broadcastEvent("exec", "turn_right");
    return;
  }
  if (strcmp(type, "turn_left_angle") == 0) {
    int angle = fields["ANGLE"] | 90;
    cmdQueue.enqueue("L", angle);
    while (!cmdQueue.isEmpty() && !stopRequested) {
      cmdQueue.update(robot, nullptr, 255);
      vTaskDelay(5 / portTICK_PERIOD_MS);
    }
    broadcastEvent("exec", "turn_left_angle");
    return;
  }
  if (strcmp(type, "turn_right_angle") == 0) {
    int angle = fields["ANGLE"] | 90;
    cmdQueue.enqueue("R", angle);
    while (!cmdQueue.isEmpty() && !stopRequested) {
      cmdQueue.update(robot, nullptr, 255);
      vTaskDelay(5 / portTICK_PERIOD_MS);
    }
    broadcastEvent("exec", "turn_right_angle");
    return;
  }
  if (strcmp(type, "stop") == 0) {
    cmdQueue.clear();
    robot->getMotors().stop();
    broadcastEvent("exec", "stop");
    return;
  }
  if (strcmp(type, "grab") == 0) {
    robot->getClaw().close();
    broadcastEvent("exec", "grab");
    return;
  }
  if (strcmp(type, "release") == 0) {
    robot->getClaw().open();
    broadcastEvent("exec", "release");
    return;
  }
  if (strcmp(type, "wait") == 0) {
    float seconds = fields["SECONDS"] | 1.0f;
    if (inputs.containsKey("SECONDS")) {
      seconds = resolveValue(inputs["SECONDS"]);
    }
    interruptibleDelay((unsigned long)(seconds * 1000));
    broadcastEvent("exec", "wait");
    return;
  }
  if (strcmp(type, "beetlebot_if") == 0) {
    bool cond = evalCondition(inputs["CONDITION"]);
    if (cond) {
      auto doBody = inputs["DO"].as<JsonArray>();
      executeBlockSet(doBody);
    }
    return;
  }
  if (strcmp(type, "beetlebot_if_else") == 0) {
    bool cond = evalCondition(inputs["CONDITION"]);
    if (cond) {
      auto doBody = inputs["DO"].as<JsonArray>();
      executeBlockSet(doBody);
    } else {
      auto elseBody = inputs["ELSE"].as<JsonArray>();
      executeBlockSet(elseBody);
    }
    return;
  }
  if (strcmp(type, "while") == 0) {
    int iterations = 0;
    while (!stopRequested && evalCondition(inputs["CONDITION"])) {
      auto body = inputs["DO"].as<JsonArray>();
      executeBlockSet(body);
      if (stopRequested) break;
      interruptibleDelay(150);
      iterations++;
      if (iterations > 10000) break;
    }
    robot->getMotors().stop();
    cmdQueue.clear();
    return;
  }
  if (strcmp(type, "repeat_until") == 0) {
    int iterations = 0;
    while (!stopRequested) {
      auto body = inputs["DO"].as<JsonArray>();
      executeBlockSet(body);
      if (stopRequested) break;
      if (evalCondition(inputs["CONDITION"])) break;
      interruptibleDelay(150);
      iterations++;
      if (iterations > 10000) break;
    }
    robot->getMotors().stop();
    cmdQueue.clear();
    return;
  }
  if (strcmp(type, "repeat") == 0) {
    int times = fields["TIMES"] | 5;
    if (inputs.containsKey("TIMES")) {
      times = (int)resolveValue(inputs["TIMES"]);
    }
    times = constrain(times, 1, 100);
    auto body = inputs["DO"].as<JsonArray>();
    for (int i = 0; i < times && !stopRequested; i++) {
      executeBlockSet(body);
    }
    return;
  }
  if (strcmp(type, "count_with") == 0) {
    const char* varName = fields["VAR"] | "i";
    int from = (int)resolveValue(inputs["FROM"]);
    int to = (int)resolveValue(inputs["TO"]);
    auto body = inputs["DO"].as<JsonArray>();
    for (int i = from; i <= to && !stopRequested; i++) {
      setVariable(varName, (float)i);
      executeBlockSet(body);
    }
    return;
  }
  if (strcmp(type, "variable_set") == 0) {
    const char* varName = fields["VAR_NAME"] | "counter";
    float val = resolveValue(inputs["VALUE"]);
    setVariable(varName, val);
    broadcastEvent("exec", "variable_set");
    return;
  }
  if (strcmp(type, "variable_change") == 0) {
    const char* varName = fields["VAR_NAME"] | "counter";
    float delta = inputs.containsKey("DELTA") ? resolveValue(inputs["DELTA"]) : 1.0f;
    float current = getVariable(varName);
    setVariable(varName, current + delta);
    broadcastEvent("exec", "variable_change");
    return;
  }
  if (strcmp(type, "variable_increment") == 0) {
    const char* varName = fields["VAR_NAME"] | "counter";
    setVariable(varName, getVariable(varName) + 1.0f);
    broadcastEvent("exec", "variable_increment");
    return;
  }
  if (strcmp(type, "variable_decrement") == 0) {
    const char* varName = fields["VAR_NAME"] | "counter";
    setVariable(varName, getVariable(varName) - 1.0f);
    broadcastEvent("exec", "variable_decrement");
    return;
  }
  if (strcmp(type, "break_loop") == 0) {
    return;
  }
}

static void executeBlockSet(JsonArray set) {
  for (JsonObject node : set) {
    if (stopRequested) return;
    executeStatement(node);
  }
}

static void interpreterTask(void* pvParameters) {
  InterpreterParams* params = (InterpreterParams*)pvParameters;
  if (!params) {
    vTaskDelete(nullptr);
    return;
  }

  StaticJsonDocument<8192> doc;
  DeserializationError parseErr = deserializeJson(doc, params->treeStr);
  if (parseErr) {
    Serial.println("[INTERP] JSON parse error!");
    if (params->ws && params->clientNum != 255) {
      StaticJsonDocument<64> err;
      err["status"] = "error";
      err["msg"] = "invalid tree json";
      String json;
      serializeJson(err, json);
      params->ws->sendTXT(params->clientNum, json);
    }
    programRunning = false;
    interpreterTaskHandle = nullptr;
    delete params;
    vTaskDelete(nullptr);
    return;
  }

  stopRequested = false;
  programRunning = true;

  JsonArray tree = doc.as<JsonArray>();
  executeBlockSet(tree);

  robot->getMotors().stop();
  cmdQueue.clear();
  programRunning = false;
  interpreterTaskHandle = nullptr;

  if (params->ws && params->clientNum != 255) {
    StaticJsonDocument<64> done;
    done["event"] = "program_done";
    done["aborted"] = stopRequested;
    String json;
    serializeJson(done, json);
    params->ws->sendTXT(params->clientNum, json);
  }

  Serial.println("[INTERP] Done");
  delete params;
  vTaskDelete(nullptr);
}

// ============== JSON HELPERS ==============
String buildJsonResponse(const char* status, const char* action) {
  StaticJsonDocument<128> doc;
  doc["status"] = status;
  doc["cmd"] = action;
  String out;
  serializeJson(doc, out);
  return out;
}

String buildStatusJson() {
  StaticJsonDocument<128> doc;
  doc["status"] = "ok";
  doc["action"] = "status";
  doc["speed"] = robot->getSpeed();
  doc["queue"] = cmdQueue.isEmpty() ? "empty" : "busy";
  doc["claw"] = robot->getClaw().isAttached() ? "ok" : "err";
  String out;
  serializeJson(doc, out);
  return out;
}

// ============== COMMAND HANDLER ==============
// Accepts JSON: {"cmd":"move","params":{"direction":"forward","speed":100,"duration":2000}}
// Returns JSON: {"status":"queued","cmd":"move"}
// Legacy plain-string commands are rejected with {"status":"rejected","reason":"use JSON protocol"}
String handleCommand(String raw) {
  // Quick check for known legacy plain-text commands — reject immediately
  String upper;
  for (size_t i = 0; i < raw.length(); i++) upper += (char)toupper(raw[i]);
  upper.trim();

  if (upper == "F" || upper == "B" || upper == "L" || upper == "R" ||
      upper == "S" || upper == "/" || upper == "BRAKE" || upper == "CLAWTEST" ||
      upper == "+" || upper == "-" || upper == "FORWARD" || upper == "BACKWARD" ||
      upper == "LEFT" || upper == "RIGHT" || upper == "STOP" || upper == "OPEN" ||
      upper == "CLOSE" || upper.startsWith("DIST") ||
      upper.startsWith("TOF_TRIGGER:") || upper.startsWith("DIST_THRESHOLD:")) {
    StaticJsonDocument<96> reject;
    reject["status"] = "rejected";
    reject["reason"] = "legacy protocol deprecated, use JSON";
    String out;
    serializeJson(reject, out);
    return out;
  }

  // Legacy CLEAR and STATUS are still allowed for backward compat
  if (upper == "CLEAR") {
    cmdQueue.clear();
    robot->getMotors().stop();
    return buildJsonResponse("ok", "clear");
  }
  if (upper == "STATUS") {
    return buildStatusJson();
  }
  if (upper.startsWith("TURN:")) {
    int firstColon = upper.indexOf(':');
    int secondColon = upper.indexOf(':', firstColon + 1);
    if (firstColon != -1 && secondColon != -1) {
      String dir = upper.substring(firstColon + 1, secondColon);
      int degrees = upper.substring(secondColon + 1).toInt();
      if (dir == "L" || dir == "LEFT") {
        cmdQueue.enqueue("L", degrees);
        return buildJsonResponse("queued", "turn_left");
      }
      if (dir == "R" || dir == "RIGHT") {
        cmdQueue.enqueue("R", degrees);
        return buildJsonResponse("queued", "turn_right");
      }
    }
    return buildJsonResponse("error", "bad_turn_format");
  }

  // Try JSON parse
  // Use larger buffer for run_program (block tree can be >256 bytes)
  size_t capacity = (raw.indexOf("\"run_program\"") >= 0) ? 8192 : 256;
  DynamicJsonDocument doc(capacity);
  DeserializationError err = deserializeJson(doc, raw);
  if (err) {
    StaticJsonDocument<96> reject;
    reject["status"] = "error";
    reject["msg"] = "invalid json";
    String out;
    serializeJson(reject, out);
    return out;
  }

  const char* cmd = doc["cmd"];
  if (!cmd) {
    return buildJsonResponse("error", "missing_cmd");
  }

  JsonObject params = doc["params"];

  // Map JSON commands to internal queue actions
  if (strcmp(cmd, "move") == 0) {
    const char* direction = params["direction"] | "forward";
    int speed = params["speed"] | robot->getSpeed();
    int duration = params["duration"] | CMD_DURATION;

    if (speed != robot->getSpeed()) {
      robot->setSpeed(speed);
    }

    if (strcmp(direction, "forward") == 0) {
      cmdQueue.enqueue("F", 0, duration);
    } else if (strcmp(direction, "backward") == 0) {
      cmdQueue.enqueue("B", 0, duration);
    } else {
      return buildJsonResponse("error", "bad_direction");
    }
    return buildJsonResponse("queued", "move");
  }

  if (strcmp(cmd, "turn") == 0) {
    const char* direction = params["direction"] | "left";
    int degrees = params["degrees"] | 90;

    if (strcmp(direction, "left") == 0) {
      cmdQueue.enqueue("L", degrees);
    } else if (strcmp(direction, "right") == 0) {
      cmdQueue.enqueue("R", degrees);
    } else {
      return buildJsonResponse("error", "bad_direction");
    }
    return buildJsonResponse("queued", "turn");
  }

  if (strcmp(cmd, "grab") == 0) {
    cmdQueue.enqueue("C");
    return buildJsonResponse("queued", "grab");
  }

  if (strcmp(cmd, "release") == 0) {
    cmdQueue.enqueue("O");
    return buildJsonResponse("queued", "release");
  }

  if (strcmp(cmd, "speed") == 0) {
    const char* delta = params["delta"];
    if (delta) {
      if (strcmp(delta, "increase") == 0) {
        robot->increaseSpeed();
      } else if (strcmp(delta, "decrease") == 0) {
        robot->decreaseSpeed();
      }
    } else {
      int value = params["value"] | params["speed"] | 100;
      cmdQueue.enqueue("SPEED:", value);
    }
    return buildJsonResponse("queued", "speed");
  }

  if (strcmp(cmd, "stop") == 0) {
    cmdQueue.enqueue("S");
    return buildJsonResponse("queued", "stop");
  }

  if (strcmp(cmd, "clear") == 0) {
    cmdQueue.clear();
    robot->getMotors().stop();
    return buildJsonResponse("ok", "clear");
  }

  if (strcmp(cmd, "status") == 0) {
    return buildStatusJson();
  }

  if (strcmp(cmd, "dist") == 0) {
    int dist = -1;
    // Distance read temporarily disabled — will be handled by broadcast (Subtask 2)
    StaticJsonDocument<64> res;
    res["status"] = "ok";
    res["distance"] = dist;
    String out;
    serializeJson(res, out);
    return out;
  }

  // Check stop first — even mid-program, a new stop must be honored immediately
  if (programRunning && strcmp(cmd, "stop") == 0) {
    stopRequested = true;
    cmdQueue.clear();
    robot->getMotors().stop();
    StaticJsonDocument<64> res;
    res["status"] = "ok";
    res["cmd"] = "stop";
    String out;
    serializeJson(res, out);
    return out;
  }

  // run_program: spawns interpreter task on Core 1
  if (strcmp(cmd, "run_program") == 0) {
    if (programRunning) {
      StaticJsonDocument<64> res;
      res["status"] = "error";
      res["msg"] = "already_running";
      String out;
      serializeJson(res, out);
      return out;
    }
    if (!doc.containsKey("tree") || !doc["tree"].is<JsonArray>()) {
      StaticJsonDocument<64> res;
      res["status"] = "error";
      res["msg"] = "missing tree";
      String out;
      serializeJson(res, out);
      return out;
    }
    String treeStr;
    serializeJson(doc["tree"], treeStr);
    for (int i = 0; i < MAX_VARS; i++) varTable[i].used = false;
    InterpreterParams* taskParams = new InterpreterParams();
    taskParams->treeStr = treeStr;
    taskParams->robot = robot;
    taskParams->ws = &webSocket;
    taskParams->clientNum = activeClient;
    xTaskCreatePinnedToCore(interpreterTask, "interp", 16384, taskParams, 1, &interpreterTaskHandle, 1);
    StaticJsonDocument<64> res;
    res["status"] = "ok";
    res["cmd"] = "run_program";
    String out;
    serializeJson(res, out);
    return out;
  }

  // Unknown cmd
  StaticJsonDocument<64> reject;
  reject["status"] = "error";
  reject["msg"] = "unknown cmd";
  String out;
  serializeJson(reject, out);
  return out;
}

// ============== WEBSOCKET EVENTS ==============
void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.printf("[%u] Disconnected!\n", num);
            cmdQueue.emergencyStop(robot);
            if (activeClient == num) activeClient = 255;
            break;

        case WStype_CONNECTED: {
            IPAddress ip = webSocket.remoteIP(num);
            Serial.printf("[%u] Connected from %d.%d.%d.%d\n", num, ip[0], ip[1], ip[2], ip[3]);
            robot->setLED(true);
            activeClient = num;
            break;
        }

        case WStype_TEXT:
            Serial.printf("[%u] RX: %s\n", num, payload);

            if (strcmp((char*)payload, "OTA") == 0) {
                webSocket.sendTXT(num, "{\"status\":\"ok\",\"msg\":\"OTA ready\"}");
                ArduinoOTA.begin();
                return;
            }

            String response = handleCommand(String((char*)payload));
            Serial.printf("[%u] TX: %s\n", num, response.c_str());
            webSocket.sendTXT(num, response);
            break;
    }
}

// ============== SETUP ==============
void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n=== BeetleBot Starting ===");

    robot = new RobotContext();
    robot->begin();  // Initialize servo with boot test sweep

    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASS);
    Serial.println("✓ AP Mode Started!");
    Serial.print("AP IP: ");
    Serial.println(WiFi.softAPIP());

    ArduinoOTA.setHostname("beetlebot");
    ArduinoOTA.onStart([]() {
        String type = (ArduinoOTA.getCommand() == U_FLASH) ? "sketch" : "filesystem";
        Serial.println("OTA Start: " + type);
        robot->getMotors().stop();
    });
    ArduinoOTA.onEnd([]() {
        Serial.println("\nOTA End");
    });
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        Serial.printf("OTA Progress: %u%%\r", (progress / (total / 100)));
    });
    ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("OTA Error[%u]: ", error);
        if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
        else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
        else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
        else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
        else if (error == OTA_END_ERROR) Serial.println("End Failed");
    });
    ArduinoOTA.begin();
    Serial.println("OTA ready");

    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
    Serial.println("WebSocket server on port 8266");

    for (int i = 0; i < 3; i++) {
        robot->setLED(true);
        delay(100);
        robot->setLED(false);
        delay(100);
    }
    Serial.println("Ready!");
}

// ============== LOOP ==============
void loop() {
    ArduinoOTA.handle();
    webSocket.loop();
    cmdQueue.update(robot, &webSocket, activeClient);

    // Broadcast TOF distance ~6-7 Hz (every ~150ms)
    static unsigned long lastDistBroadcast = 0;
    unsigned long now = millis();
    if (now - lastDistBroadcast >= 150) {
        lastDistBroadcast = now;
        if (robot->getTOF().isReady()) {
            int dist = robot->getTOF().readDistance();
            if (dist >= 0) {
                String json = "{\"event\":\"distance\",\"value\":" + String(dist) + "}";
                webSocket.broadcastTXT(json);
            }
        }
    }
}
