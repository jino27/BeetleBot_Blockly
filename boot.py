import network
import time

WIFI_SSID = "InnovationLabs"
WIFI_PASS = "C0nnectBuildInnovate#"

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if not wlan.isconnected():
        print("Connecting to WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASS)
        # WROOM-32E has better WiFi, shorter timeout ok
        timeout = 0
        while not wlan.isconnected() and timeout < 30:
            time.sleep(0.5)
            timeout += 1
    
    if wlan.isconnected():
        ip = wlan.ifconfig()[0]
        print("WiFi connected:", ip)
        return ip
    else:
        print("WiFi failed, starting AP mode")
        ap = network.WLAN(network.AP_IF)
        ap.active(True)
        ap.config(essid="BeetleBot-Setup", password="12345678")
        print("AP mode: 192.168.4.1")
        return "192.168.4.1"

ip = connect_wifi()