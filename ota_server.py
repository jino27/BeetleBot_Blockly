#!/usr/bin/env python3
"""
BeetleBot OTA Server
Run this on your PC, then trigger update from ESP32
"""

import socket
import os
import sys

OTA_PORT = 8267
BUFFER_SIZE = 1024

def send_file(filename, host, port):
    """Send a file to ESP32 for OTA update"""
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return False
    
    filesize = os.path.getsize(filename)
    print(f"Sending {filename} ({filesize} bytes) to {host}:{port}")
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.connect((host, port))
        
        # Send filename and size
        header = f"{filename}:{filesize}\n".encode()
        s.sendall(header)
        
        # Send file data
        with open(filename, 'rb') as f:
            while True:
                chunk = f.read(BUFFER_SIZE)
                if not chunk:
                    break
                s.sendall(chunk)
        
        # Wait for confirmation
        response = s.recv(100).decode().strip()
        print(f"ESP32 response: {response}")
        return response == "OK"

def start_ota_server():
    """Wait for ESP32 to request files"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(('0.0.0.0', OTA_PORT))
        s.listen(1)
        print(f"OTA Server listening on port {OTA_PORT}")
        
        while True:
            conn, addr = s.accept()
            print(f"OTA request from {addr}")
            
            try:
                # Receive request
                request = conn.recv(100).decode().strip()
                print(f"Request: {request}")
                
                if request.startswith("GET:"):
                    filename = request[4:]
                    if os.path.exists(filename):
                        with open(filename, 'rb') as f:
                            data = f.read()
                        conn.sendall(data)
                        print(f"Sent {len(data)} bytes")
                    else:
                        conn.sendall(b"ERROR:File not found")
                
                elif request.startswith("UPDATE:"):
                    # Trigger update mode on ESP32
                    conn.sendall(b"OK:UPDATE_MODE")
                    
            except Exception as e:
                print(f"Error: {e}")
            finally:
                conn.close()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "server":
        start_ota_server()
    elif len(sys.argv) > 2:
        # python ota_server.py <file> <esp_ip>
        send_file(sys.argv[1], sys.argv[2], OTA_PORT)
    else:
        print("Usage:")
        print("  python ota_server.py server              # Start OTA server")
        print("  python ota_server.py main.py 192.168.1.100  # Send file")