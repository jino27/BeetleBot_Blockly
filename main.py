import uasyncio as asyncio
from machine import Pin, PWM
import time

# ============== PINS (WROOM-32E Safe) ==============
STBY = Pin(17, Pin.OUT, value=1)
PWMA = PWM(Pin(25), freq=5000)
PWMB = PWM(Pin(26), freq=5000)
AIN1 = Pin(27, Pin.OUT)
AIN2 = Pin(14, Pin.OUT)
BIN1 = Pin(16, Pin.OUT)
BIN2 = Pin(13, Pin.OUT)

# Servo on GPIO 4 (safe, avoids GPIO 15 boot conflict)
SERVO_PIN = 4
servo = PWM(Pin(SERVO_PIN), freq=50)

# LED on GPIO 2 (built-in)
LED = Pin(2, Pin.OUT)

# ============== CONFIG ==============
CLAW_OPEN = 90
CLAW_CLOSED = 10
SPEED_DEFAULT = 150
SPEED_MIN = 60
SPEED_MAX = 255
SPEED_STEP = 20

current_speed = SPEED_DEFAULT

# ============== MOTOR FUNCTIONS ==============
def stop():
    AIN1.value(0); AIN2.value(0)
    BIN1.value(0); BIN2.value(0)
    PWMA.duty(0); PWMB.duty(0)

def forward(speed):
    AIN1.value(1); AIN2.value(0)
    BIN1.value(1); BIN2.value(0)
    PWMA.duty(speed); PWMB.duty(speed)

def backward(speed):
    AIN1.value(0); AIN2.value(1)
    BIN1.value(0); BIN2.value(1)
    PWMA.duty(speed); PWMB.duty(speed)

def turn_left(speed):
    AIN1.value(0); AIN2.value(1)
    BIN1.value(1); BIN2.value(0)
    PWMA.duty(speed); PWMB.duty(speed)

def turn_right(speed):
    AIN1.value(1); AIN2.value(0)
    BIN1.value(0); BIN2.value(1)
    PWMA.duty(speed); PWMB.duty(speed)

def brake():
    AIN1.value(1); AIN2.value(1)
    BIN1.value(1); BIN2.value(1)
    PWMA.duty(1023); PWMB.duty(1023)
    time.sleep_ms(100)
    stop()

# ============== SERVO ==============
def angle_to_duty(angle):
    pulse_ms = 0.5 + (angle / 180.0) * 2.0
    return int((pulse_ms / 20.0) * 1023)

def claw_open():
    servo.duty(angle_to_duty(CLAW_OPEN))
    return "CLAW:OPEN"

def claw_close():
    servo.duty(angle_to_duty(CLAW_CLOSED))
    return "CLAW:CLOSE"

# ============== LED FEEDBACK ==============
def blink_led(count=1, delay_ms=100):
    for _ in range(count):
        LED.value(1)
        time.sleep_ms(delay_ms)
        LED.value(0)
        time.sleep_ms(delay_ms)

# ============== COMMAND HANDLER ==============
def handle_command(cmd):
    global current_speed
    
    cmd = cmd.strip().upper()
    
    if cmd == "F" or cmd == "FORWARD":
        forward(current_speed)
        blink_led(1, 50)
        return "MOVE:FORWARD"
    elif cmd == "B" or cmd == "BACKWARD":
        backward(current_speed)
        blink_led(1, 50)
        return "MOVE:BACKWARD"
    elif cmd == "L" or cmd == "LEFT":
        turn_left(current_speed)
        blink_led(1, 50)
        return "MOVE:LEFT"
    elif cmd == "R" or cmd == "RIGHT":
        turn_right(current_speed)
        blink_led(1, 50)
        return "MOVE:RIGHT"
    elif cmd == "S" or cmd == "STOP":
        stop()
        return "MOVE:STOP"
    elif cmd == "BRAKE":
        brake()
        return "MOVE:BRAKE"
    elif cmd == "O" or cmd == "OPEN":
        return claw_open()
    elif cmd == "C" or cmd == "CLOSE":
        return claw_close()
    elif cmd == "+":
        current_speed = min(current_speed + SPEED_STEP, SPEED_MAX)
        return f"SPEED:{current_speed}"
    elif cmd == "-":
        current_speed = max(current_speed - SPEED_STEP, SPEED_MIN)
        return f"SPEED:{current_speed}"
    elif cmd.startswith("SPEED:"):
        current_speed = max(SPEED_MIN, min(int(cmd[6:]), SPEED_MAX))
        return f"SPEED:{current_speed}"
    else:
        return f"UNKNOWN:{cmd}"

# ============== TCP SERVER ==============
async def handle_client(reader, writer):
    addr = writer.get_extra_info('peername')
    print("Client connected from", addr)
    blink_led(2, 100)
    
    try:
        while True:
            data = await reader.read(100)
            if not data:
                break
            
            cmd = data.decode().strip()
            if cmd:
                print("RX:", cmd)
                response = handle_command(cmd)
                print("TX:", response)
                writer.write(response.encode() + b'\n')
                await writer.drain()
    except Exception as e:
        print("Client error:", e)
    finally:
        stop()
        writer.close()
        await writer.wait_closed()
        print("Client disconnected")
        blink_led(1, 200)

async def main():
    from boot import ip
    print(f"BeetleBot WROOM-32E starting...")
    print(f"Server on {ip}:8266")
    blink_led(3, 100)
    
    server = await asyncio.start_server(handle_client, "0.0.0.0", 8266)
    print("Server running!")
    
    async with server:
        await server.serve_forever()

# ============== START ==============
try:
    asyncio.run(main())
except KeyboardInterrupt:
    stop()
    LED.value(0)
    print("Server stopped")