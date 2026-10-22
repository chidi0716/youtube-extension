// 內容腳本端與頁面橋接腳本溝通的封裝（plan 3.5）。
import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  parseBridgeResponse,
  type BridgeRequest,
  type BridgeRequestType,
  type BridgeResults,
} from './bridge';

type RequestArgs<T extends BridgeRequestType> = Omit<Extract<BridgeRequest, { type: T }>, 'id' | 'type'>;

export class PageBridgeError extends Error {
  constructor(readonly code: 'NO_PLAYER' | 'FAILED' | 'TIMEOUT') {
    super(`page bridge: ${code}`);
  }
}

/** 送出一個請求給頁面橋接腳本並等待回覆（逾時會 reject）。 */
export function callPageBridge<T extends BridgeRequestType>(
  type: T,
  args: RequestArgs<T>,
  timeoutMs = 2000,
): Promise<BridgeResults[T]> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const onResponse = (event: Event) => {
      const res = parseBridgeResponse((event as CustomEvent<unknown>).detail);
      if (!res || res.id !== id) return;
      cleanup();
      if (res.ok) resolve(res.result as BridgeResults[T]);
      else reject(new PageBridgeError(res.error));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new PageBridgeError('TIMEOUT'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
    };
    document.addEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
    document.dispatchEvent(
      new CustomEvent(BRIDGE_REQUEST_EVENT, { detail: JSON.stringify({ id, type, ...args }) }),
    );
  });
}

export const player = {
  getVideoData: () => callPageBridge('getVideoData', {}),
  getVolume: () => callPageBridge('getVolume', {}),
  setVolume: (volume: number) => callPageBridge('setVolume', { volume }),
  seekTo: (seconds: number) => callPageBridge('seekTo', { seconds }),
  getCurrentTime: () => callPageBridge('getCurrentTime', {}),
  getAvailableQualities: () => callPageBridge('getAvailableQualities', {}),
  getQuality: () => callPageBridge('getQuality', {}),
  setQuality: (quality: BridgeQuality) => callPageBridge('setQuality', { quality }),
  getAudioTracks: () => callPageBridge('getAudioTracks', {}),
  setAudioTrack: (trackId: string) => callPageBridge('setAudioTrack', { trackId }),
  getCaptionTracks: () => callPageBridge('getCaptionTracks', {}),
};

type BridgeQuality = Extract<BridgeRequest, { type: 'setQuality' }>['quality'];

/** YouTube 外觀選單（003 深色模式，T06d）：在外觀子選單的深色／淺色選項上加上標記。 */
export const appearanceMenu = {
  markThemeOptions: () => callPageBridge('markThemeOptions', {}, 1000),
};
