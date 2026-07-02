/**
 * BeetleBot ESP32-WROOM-32E
 * WebSocket control + OTA updates + Timed Command Queue + WiFi Config
 * PWA-compatible + TOF Sensor
 */

#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoOTA.h>
#include <Wire.h>
#include <VL53L0X.h>

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

// ============== SERVO CONFIG ==============
#define SERVO_FREQ  50
#define SERVO_RES   16
#define OPEN_US     1500
#define CLOSE_US    500

// ============== TOF CONFIG ==============
#define TOF_DETECT_DISTANCE  200  // mm - trigger distance

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
    bool tofTriggered;  // Flag to prevent repeated triggers
    bool tofAutoTriggerEnabled;  // Enable/disable auto-trigger
    
    static const int SPEED_DEFAULT = 100;
    static const int SPEED_MIN = 60;
    static const int SPEED_MAX = 255;
    static const int SPEED_STEP = 20;

public:
    RobotContext() : currentSpeed(SPEED_DEFAULT), tofTriggered(false), tofAutoTriggerEnabled(false) {
        pinMode(LED_PIN, OUTPUT);
        digitalWrite(LED_PIN, LOW);
    }

    void begin() {
        // 1. Initialize claw first (boot test)
        claw.begin();
        delay(500);

        // 2. Initialize TOF sensor
        bool tofOk = tof.begin();
        delay(500);

        // 3. If TOF detected, run claw test 5 times
        if (tofOk) {
            Serial.println("\n=== TOF Detected! Running Claw Test (5x) ===");
            claw.testCycle(5);
            Serial.println("=== Claw Test Complete ===\n");
        } else {
            Serial.println("\n=== TOF Not Found - Skipping Claw Test ===\n");
        }
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

    // Check TOF and trigger action if object detected
    void checkTOFTrigger() {
        if (!tof.isReady() || !tofAutoTriggerEnabled) return;
        
        int dist = tof.readDistance();
        if (dist > 0 && dist < TOF_DETECT_DISTANCE && !tofTriggered) {
            Serial.println("[TOF] Object detected at " + String(dist) + "mm! Triggering claw...");
            tofTriggered = true;
            claw.testCycle(5);  // Close/open 5 times
        }
        else if (dist > TOF_DETECT_DISTANCE || dist < 0) {
            tofTriggered = false;  // Reset when object moves away
        }
    }
    
    void setTOFAutoTrigger(bool enable) {
        tofAutoTriggerEnabled = enable;
        if (!enable) tofTriggered = false;
        Serial.println("[TOF] Auto-trigger " + String(enable ? "ENABLED" : "DISABLED"));
    }
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
                    ws->sendTXT(clientNum, "DONE:" + currentAction);
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
                ws->sendTXT(clientNum, "EXEC:" + currentAction);
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

// ============== COMMAND HANDLER ==============
String handleCommand(String cmd) {
  cmd.toUpperCase();

  auto enqueueTurn = [&](char direction, int degrees) -> String {
    if (direction == 'L') {
      cmdQueue.enqueue("L", degrees);
      return "QUEUED:TURN_LEFT:" + String(degrees);
    }
    cmdQueue.enqueue("R", degrees);
    return "QUEUED:TURN_RIGHT:" + String(degrees);
  };

  // New TOF commands (respond immediately with data)
  if (cmd == "DIST") {
    int dist = robot->getTOF().readDistance();
    return "DIST:" + String(dist);
  }
  else if (cmd.startsWith("DIST_THRESHOLD:")) {
    int thresh = cmd.substring(15).toInt();
    int dist = robot->getTOF().readDistance();
    bool result = (dist > 0 && dist < thresh);
    return "BOOL:" + String(result);
  }
  else if (cmd.startsWith("TOF_TRIGGER:")) {
    int enable = cmd.substring(12).toInt();
    robot->setTOFAutoTrigger(enable);
    return "TOF_TRIGGER:OK";
  }
  else if (cmd.startsWith("TURN:")) {
    int firstColon = cmd.indexOf(':');
    int secondColon = cmd.indexOf(':', firstColon + 1);
    if (firstColon != -1 && secondColon != -1) {
      String dir = cmd.substring(firstColon + 1, secondColon);
      int degrees = cmd.substring(secondColon + 1).toInt();
      if (dir == "L" || dir == "LEFT") {
        return enqueueTurn('L', degrees);
      }
      if (dir == "R" || dir == "RIGHT") {
        return enqueueTurn('R', degrees);
      }
    }
    return "TURN:ERROR:BAD_FORMAT";
  }

  if (cmd == "F" || cmd == "FORWARD") {
    cmdQueue.enqueue("F");
    return "QUEUED:FORWARD";
  }
  else if (cmd == "B" || cmd == "BACKWARD") {
    cmdQueue.enqueue("B");
    return "QUEUED:BACKWARD";
  }
  else if (cmd == "L" || cmd == "LEFT") {
    return enqueueTurn('L', 90);
  }
  else if (cmd == "R" || cmd == "RIGHT") {
    return enqueueTurn('R', 90);
  }
  else if (cmd == "S" || cmd == "STOP" || cmd == "/") {
    cmdQueue.enqueue("S");
    return "QUEUED:STOP";
  }
  else if (cmd == "BRAKE") {
    cmdQueue.enqueue("BRAKE");
    return "QUEUED:BRAKE";
  }
  else if (cmd == "O" || cmd == "OPEN") {
    cmdQueue.enqueue("O");
    return "QUEUED:OPEN";
  }
  else if (cmd == "C" || cmd == "CLOSE") {
    cmdQueue.enqueue("C");
    return "QUEUED:CLOSE";
  }
  else if (cmd == "+") {
    cmdQueue.enqueue("+");
    return "QUEUED:SPEED+";
  }
  else if (cmd == "-") {
    cmdQueue.enqueue("-");
    return "QUEUED:SPEED-";
  }
  else if (cmd.startsWith("SPEED:")) {
    int spd = cmd.substring(6).toInt();
    cmdQueue.enqueue("SPEED:", spd);
    return "QUEUED:SPEED:" + String(spd);
  }
  else if (cmd == "CLAWTEST") {
    cmdQueue.enqueue("CLAWTEST");
    return "QUEUED:CLAWTEST";
  }
  else if (cmd == "CLEAR") {
    cmdQueue.clear();
    robot->getMotors().stop();
    return "QUEUE:CLEARED";
  }
  else if (cmd == "STATUS") {
    String status = "SPEED:" + String(robot->getSpeed());
    status += " QUEUE:" + String(cmdQueue.isEmpty() ? "EMPTY" : "BUSY");
    status += " CLAW:" + String(robot->getClaw().isAttached() ? "OK" : "ERR");
    status += " TOF:" + String(robot->getTOF().isReady() ? "OK" : "ERR");
    return status;
  }

  return "UNKNOWN:" + cmd;
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
                webSocket.sendTXT(num, "OTA:READY");
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
    
    // Auto-trigger claw when object detected by TOF
    robot->checkTOFTrigger();
}
