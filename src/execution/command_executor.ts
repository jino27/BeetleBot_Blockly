import type { CommandItem } from '../generators/beetlebot_generator';
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

  async execute(queue: CommandItem[]): Promise<void> {
    if (this.running) return;
    if (!this.wifi.isConnected) throw new Error('Connect first');

    this.running = true;
    this.abortController = new AbortController();

    try {
      for (let i = 0; i < queue.length; i++) {
        if (this.abortController.signal.aborted) break;
        await this.executeItem(queue[i]);
      }
    } finally {
      this.running = false;
      this.abortController = null;
    }
  }

  stop(): void {
    if (this.abortController) this.abortController.abort();
    this.running = false;
    this.wifi.sendCommand('S').catch(() => {});
    this.wifi.sendCommand('BRAKE').catch(() => {});
  }

  private async executeItem(item: CommandItem): Promise<void> {
    switch (item.cmd) {
      case 'WAIT':
        await this.sleep(item.ms || 0);
        break;
      case 'SPEED':
        await this.wifi.sendCommand(`SPEED:${item.val}`);
        break;
      case 'SPEED_DELTA': {
        const sign = (item.val || 0) >= 0 ? '+' : '-';
        await this.wifi.sendCommand(sign);
        break;
      }
      default:
        await this.wifi.sendCommand(item.cmd);
        await this.sleep(50);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}