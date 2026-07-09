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

    // Kill motors + clear firmware command queue
    this.wifi.sendCommand({cmd:"stop"}).catch(() => {});
    this.wifi.sendCommand({cmd:"clear"}).catch(() => {});
    return endIdx + 1;
  }

  private async readDistance(): Promise<number> {
    // Use the cached distance from the WebSocket broadcast
    return this.wifi.getLatestDistance();
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
    this.wifi.sendCommand({cmd:"clear"}).catch(() => {});
  }

  private async executeItem(item: CommandItem, signal?: AbortSignal): Promise<void> {
    switch (item.cmd) {
      case 'WAIT':
        await this.sleep(item.ms || 0, signal);
        break;
      case 'SPEED':
        await this.wifi.sendCommand({cmd:"speed", params:{value: item.val}});
        break;
      case 'SPEED_DELTA': {
        const dir = (item.val || 0) >= 0 ? 'increase' : 'decrease';
        await this.wifi.sendCommand({cmd:"speed", params:{delta: dir}});
        break;
      }
      default: {
        const jsonCmd = item.params ? { cmd: item.cmd, params: item.params } : { cmd: item.cmd };
        await this.wifi.sendCommand(jsonCmd);
        await this.sleep(50, signal);
      }
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
