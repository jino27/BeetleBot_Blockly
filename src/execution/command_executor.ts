import { WiFiWebSocket } from '../wifi/web_socket';

export class CommandExecutor {
  private wifi: WiFiWebSocket;
  private abortController: AbortController | null = null;
  private running = false;

  constructor(wifi: WiFiWebSocket) {
    this.wifi = wifi;
  }

  get isRunning(): boolean {
    return this.running;
  }

  newAbortSignal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  start(): void {
    this.running = true;
    this.abortController = new AbortController();
  }

  finish(): void {
    this.running = false;
    this.abortController = null;
  }

  stop(): void {
    if (this.abortController) this.abortController.abort();
    this.running = false;
    this.wifi.sendCommand({cmd:"clear"}).catch(() => {});
  }
}
