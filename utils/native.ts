// 背景腳本端的橋接程式連線（plan 3.1、tasks T16）：連線、請求與回應配對、事件、自動重連。
// 連線方式（connectNative）由外部注入，單元測試以假的連接埠代替。
import { parseHostMessage, type HostCommand, type HostErrorCode, type HostMessage } from './native-protocol';

/** runtime.Port 中用到的部分。 */
export interface PortLike {
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: { addListener(fn: (message: unknown) => void): void };
  onDisconnect: { addListener(fn: (port: unknown) => void): void };
}

export class HostRequestError extends Error {
  constructor(
    readonly code: HostErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'HostRequestError';
  }
}

/** 各指令等待回應的上限（橋接程式本身的時限再加一點餘裕；選擇資料夾要等使用者操作）。 */
export const REQUEST_TIMEOUT_MS: Record<HostCommand, number> = {
  status: 45_000,
  getInfo: 100_000,
  download: 30_000,
  cancel: 30_000,
  jobs: 15_000,
  reveal: 15_000,
  pickFolder: 30 * 60_000,
  updateYtDlp: 6 * 60_000,
  // 008（plan 4.9）：都只是寫入狀態檔或啟動分離的程序，立即回應。
  setAutoUpdate: 15_000,
  checkUpdates: 15_000,
  uninstall: 30_000,
};

/** 自動重連的間隔（毫秒）：1、2、4、8、16、30、30… 秒。 */
export function reconnectDelay(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}

export type HostEvent = Exclude<HostMessage, { kind: 'response' }>;

export interface NativeClientOptions {
  /** 開啟連線（browser.runtime.connectNative）；失敗時可以丟出例外。 */
  connect: () => PortLike;
  /** 連線中斷時讀取原因（runtime.lastError 或 port.error）。 */
  lastError?: (port: unknown) => string | undefined;
  /** 收到進度、完成、失敗事件。 */
  onEvent?: (event: HostEvent) => void;
  /** 每次（重新）連線成功後呼叫，例如同步工作清單。 */
  onConnect?: () => void;
  /** 連線中斷時呼叫。 */
  onDisconnect?: (reason: string | undefined) => void;
  /** 連線中斷時是否要自動重連（例如還有進行中的下載）。 */
  shouldReconnect?: () => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

interface Pending {
  resolve: (result: Record<string, unknown>) => void;
  reject: (err: HostRequestError) => void;
  timer: unknown;
}

export class NativeClient {
  private port: PortLike | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private reconnectTimer: unknown = null;
  private attempts = 0;
  /** 這次連線是否收到過任何訊息（確認橋接程式真的啟動了）。 */
  private alive = false;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (timer: unknown) => void;

  constructor(private readonly options: NativeClientOptions) {
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  }

  get connected(): boolean {
    return this.port !== null;
  }

  /** 等待回應中的指令數。 */
  get pendingCount(): number {
    return this.pending.size;
  }

  /** 送出指令並等待回應。找不到橋接程式時以 HOST_UNREACHABLE 失敗。 */
  request(cmd: HostCommand, args?: Record<string, unknown>, timeoutMs = REQUEST_TIMEOUT_MS[cmd]): Promise<Record<string, unknown>> {
    let port: PortLike;
    try {
      port = this.ensurePort();
    } catch (err) {
      return Promise.reject(new HostRequestError('HOST_UNREACHABLE', String(err)));
    }
    const id = `r${Date.now().toString(36)}-${(++this.seq).toString(36)}`;
    return new Promise((resolve, reject) => {
      const timer = this.setTimer(() => {
        this.pending.delete(id);
        reject(new HostRequestError('TIMEOUT', `${cmd} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        port.postMessage(args ? { id, cmd, args } : { id, cmd });
      } catch (err) {
        this.settle(id, new HostRequestError('HOST_UNREACHABLE', String(err)));
      }
    });
  }

  /** 開始連線（例如有進行中的下載時，為了接收事件）。 */
  connect(): void {
    try {
      this.ensurePort();
    } catch {
      this.scheduleReconnect();
    }
  }

  close(): void {
    if (this.reconnectTimer !== null) this.clearTimer(this.reconnectTimer);
    this.reconnectTimer = null;
    const port = this.port;
    this.port = null;
    port?.disconnect();
    this.rejectAll('HOST_UNREACHABLE', 'closed');
  }

  private ensurePort(): PortLike {
    if (this.port) return this.port;
    const port = this.options.connect();
    this.port = port;
    this.alive = false;
    port.onMessage.addListener((raw) => this.onMessage(port, raw));
    port.onDisconnect.addListener((p) => this.onPortDisconnect(port, p));
    if (this.reconnectTimer !== null) {
      this.clearTimer(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.options.onConnect?.();
    return port;
  }

  private onMessage(port: PortLike, raw: unknown) {
    if (port !== this.port) return;
    this.alive = true;
    this.attempts = 0;
    const msg = parseHostMessage(raw);
    if (!msg) return;
    if (msg.kind === 'response') {
      if (msg.id === null) return;
      if (msg.ok) this.settle(msg.id, null, msg.result);
      else this.settle(msg.id, new HostRequestError(msg.error.code, msg.error.message));
      return;
    }
    this.options.onEvent?.(msg);
  }

  private onPortDisconnect(port: PortLike, p: unknown) {
    if (port !== this.port) return;
    this.port = null;
    const reason = this.options.lastError?.(p);
    // 從來沒有收到訊息就中斷：找不到或無法啟動橋接程式。
    this.rejectAll('HOST_UNREACHABLE', reason ?? 'disconnected');
    this.options.onDisconnect?.(reason);
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null || !this.options.shouldReconnect?.()) return;
    const delay = reconnectDelay(this.alive ? 0 : this.attempts);
    this.attempts++;
    this.reconnectTimer = this.setTimer(() => {
      this.reconnectTimer = null;
      if (this.port || !this.options.shouldReconnect?.()) return;
      this.connect();
    }, delay);
  }

  private settle(id: string, error: HostRequestError | null, result?: Record<string, unknown>) {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    this.clearTimer(p.timer);
    if (error) p.reject(error);
    else p.resolve(result ?? {});
  }

  private rejectAll(code: HostErrorCode, message: string) {
    for (const id of [...this.pending.keys()]) this.settle(id, new HostRequestError(code, message));
  }
}
