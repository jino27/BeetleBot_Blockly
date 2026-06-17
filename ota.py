# ota.py - MicroPython OTA updater
import socket
import machine
import os

OTA_PORT = 8267
PC_IP = "192.168.1.50"  # Your PC's IP address
CHUNK_SIZE = 1024

def download_file(filename, pc_ip):
    """Download file from PC OTA server"""
    print(f"Downloading {filename} from {pc_ip}...")
    
    s = socket.socket()
    s.connect((pc_ip, OTA_PORT))
    s.send(f"GET:{filename}\n".encode())
    
    # Receive file data
    data = b""
    while True:
        chunk = s.recv(CHUNK_SIZE)
        if not chunk:
            break
        data += chunk
    
    s.close()
    
    # Save to filesystem
    with open(filename + ".tmp", "wb") as f:
        f.write(data)
    
    # Backup old file, replace with new
    if filename in os.listdir():
        os.rename(filename, filename + ".bak")
    os.rename(filename + ".tmp", filename)
    
    print(f"Downloaded {len(data)} bytes")
    return True

def update_from_pc(pc_ip, files=None):
    """Update multiple files from PC"""
    if files is None:
        files = ["boot.py", "main.py"]
    
    success = True
    for f in files:
        try:
            download_file(f, pc_ip)
        except Exception as e:
            print(f"Failed to update {f}: {e}")
            success = False
    
    if success:
        print("Update complete! Rebooting...")
        machine.reset()
    else:
        print("Update failed. Check PC server.")

def check_for_updates(pc_ip):
    """Check if updates available (call this periodically)"""
    try:
        s = socket.socket()
        s.settimeout(2)
        s.connect((pc_ip, OTA_PORT))
        s.send(b"CHECK\n")
        response = s.recv(100).decode().strip()
        s.close()
        return response == "UPDATE_AVAILABLE"
    except:
        return False