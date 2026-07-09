export class WiFiWebSocket {
  private ws: WebSocket | null = null;
  private connected = false;
  private espIp: string;
  private msgId = 0;
  private pending = new Map<number, (data: any) => void>();
  private latestDistance = -1;

  constructor(espIp: string = "192.168.4.1") {
    this.espIp = espIp;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  getLatestDistance(): number {
    return this.latestDistance;
  }

  setIp(ip: string): void {
    this.espIp = ip;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://${this.espIp}:8266`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = event.data.toString().trim();
        try {
          const parsed = JSON.parse(data);
          
          // Handle distance broadcast from ESP32
          if (parsed.event === "distance" && typeof parsed.value === "number") {
            this.latestDistance = parsed.value;
            return;
          }
          
          // Handle command responses with id correlation
          if (parsed.id !== undefined && this.pending.has(parsed.id)) {
            const resolver = this.pending.get(parsed.id)!;
            this.pending.delete(parsed.id);
            resolver(parsed);
            return;
          }
        } catch {
          // Not JSON, ignore or could be legacy format
        }
        
        // Legacy format fallback: "id:payload"
        const colonIdx = data.indexOf(':');
        if (colonIdx > 0) {
          const id = parseInt(data.substring(0, colonIdx), 10);
          const payload = data.substring(colonIdx + 1);
          const resolver = this.pending.get(id);
          if (resolver) {
            this.pending.delete(id);
            resolver(payload);
            return;
          }
        }
      };

      this.ws.onerror = () => reject(new Error("Failed to connect"));
      this.ws.onclose = () => { this.connected = false; };
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.latestDistance = -1;
  }

  async sendCommand(cmd: object): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    this.ws.send(JSON.stringify(cmd));
  }

  async sendCommandWithResponse(cmd: object, timeoutMs = 2000): Promise<any | null> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    return new Promise((resolve) => {
      const id = ++this.msgId;
      const fullCmd = { ...cmd, id };
      this.pending.set(id, resolve);
      this.ws!.send(JSON.stringify(fullCmd));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(null);
        }
      }, timeoutMs);
    });
  }
}