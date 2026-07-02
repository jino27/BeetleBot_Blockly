import type { CommandItem } from '../generators/beetlebot_generator';
import { buildProgram } from '../generators/beetlebot_generator';
import { WiFiWebSocket } from '../wifi/web_socket';

interface WhileItem extends CommandItem {
  threshold?: number;
  op?: string;
  until?: boolean;
}

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

  async runCode(code: string): Promise<void> {
    if (this.running) return;
    if (!this.wifi.isConnected) throw new Error('Connect first');

    const run = buildProgram(code, this.wifi);
    const queue = await run();
    await this.execute(queue);
  }

  async execute(queue: CommandItem[]): Promise<void> {
    if (this.running) return;
    if (!this.wifi.isConnected) throw new Error('Connect first');

    this.running = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      let i = 0;
      while (i < queue.length && !signal.aborted) {
        const item = queue[i] as WhileItem;
        if (item.cmd === '_WHILE') {
          i = await this.executeRealTimeWhile(queue, i, signal);
        } else if (item.cmd === '_ENDWHILE') {
          i++;
        } else {
          await this.executeItem(item, signal);
          i++;
        }
      }
    } finally {
      this.running = false;
      this.abortController = null;
    }
  }

  private async executeRealTimeWhile(
    queue: CommandItem[],
    startIdx: number,
    signal: AbortSignal,
  ): Promise<number> {
    let endIdx = -1;
    for (let j = startIdx + 1; j < queue.length; j++) {
      if (queue[j].cmd === '_ENDWHILE') { endIdx = j; break; }
    }
    if (endIdx === -1) return startIdx + 1;

    const bodyItems = queue.slice(startIdx + 1, endIdx);
    const { threshold = 200, op = 'LT', until } = queue[startIdx] as WhileItem;

    while (!signal.aborted) {
      const dist = await this.readDistance();
      if (dist < 0) break;

      const match = until ? !this.compareDist(dist, threshold, op) : this.compareDist(dist, threshold, op);
      if (!match) break;

      for (const bi of bodyItems) {
        await this.executeItem(bi, signal);
        if (signal.aborted) break;
      }
    }

    // Kill motors + clear firmware command queue + disable TOF auto-trigger
    this.wifi.sendCommand('S').catch(() => {});
    this.wifi.sendCommand('CLEAR').catch(() => {});
    this.wifi.sendCommand('TOF_TRIGGER:0').catch(() => {});
    return endIdx + 1;
  }

  private async readDistance(): Promise<number> {
    try {
      const res = await this.wifi.sendRawCommandWithResponse('DIST');
      if (!res) return -1;
      const idx = res.lastIndexOf(':');
      const num = idx >= 0 ? res.substring(idx + 1) : res;
      const val = parseInt(num, 10);
      return isNaN(val) ? -1 : val;
    } catch {
      return -1;
    }
  }

  private compareDist(d: number, threshold: number, op: string): boolean {
    switch (op) {
      case 'LT':  return d < threshold;
      case 'LTE': return d <= threshold;
      case 'GT':  return d > threshold;
      case 'GTE': return d >= threshold;
      case 'EQ':  return d === threshold;
      case 'NEQ': return d !== threshold;
      default:    return d < threshold;
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
