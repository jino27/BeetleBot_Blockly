export class WiFiWebSocket {
  private ws: WebSocket | null = null;
  private onDataCallback: ((data: string) => void) | null = null;
  private connected = false;
  private espIp: string;
  private msgId = 0;
  private pending = new Map<number, (data: string) => void>();

  constructor(espIp: string = "192.168.1.100") {
    this.espIp = espIp;
  }

  get isConnected(): boolean {
    return this.connected;
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
        // Check for response format: "id:data"
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
        if (this.onDataCallback) this.onDataCallback(data);
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
  }

  async sendCommand(cmd: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    this.ws.send(cmd);
  }

  async sendCommandWithResponse(cmd: string, timeoutMs = 2000): Promise<string | null> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    return new Promise((resolve) => {
      const id = ++this.msgId;
      const fullCmd = `${id}:${cmd}`;
      this.pending.set(id, resolve);
      this.ws!.send(fullCmd);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve(null);
        }
      }, timeoutMs);
    });
  }

  onData(callback: (data: string) => void): void {
    this.onDataCallback = callback;
  }
}