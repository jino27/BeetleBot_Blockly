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
        await this.executeItem(queue[i], this.abortController.signal);
      }
    } finally {
      this.running = false;
      this.abortController = null;
    }
  }

  stop(): void {
    if (this.abortController) this.abortController.abort();
    this.running = false;
    this.wifi.sendCommand('CLEAR').catch(() => {});
  }

  private async executeItem(item: CommandItem, signal?: AbortSignal): Promise<void> {
    switch (item.cmd) {
      case 'WAIT':
        await this.sleep(item.ms || 0, signal);
        break;
      case 'SPEED':
        await this.wifi.sendCommand(`SPEED:${item.val}`);
        break;
      case 'SPEED_DELTA': {
        const sign = (item.val || 0) >= 0 ? '+' : '-';
        await this.wifi.sendCommand(sign);
        break;
      }
      case 'TOF_TRIGGER':
        await this.wifi.sendCommand(`TOF_TRIGGER:${item.val}`);
        break;
      case 'DIST':
      case 'DIST_THRESHOLD':
        // These are handled by the generated code's async functions directly
        // No queue action needed - the generated code calls sendCommand directly
        break;
      default:
        await this.wifi.sendCommand(item.cmd);
        await this.sleep(50, signal);
    }
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
        resolve();
      };

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}
