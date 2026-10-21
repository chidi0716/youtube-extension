import { describe, expect, it, vi } from 'vitest';
import { handleBridgeRequest, parseBridgeRequest, parseBridgeResponse } from './bridge';
import type { YtPlayerApi } from './dom';

const req = (obj: unknown) => parseBridgeRequest(JSON.stringify(obj));

describe('parseBridgeRequest', () => {
  it('接受白名單內的請求', () => {
    expect(req({ id: 'a1', type: 'getVideoData' })).toEqual({ id: 'a1', type: 'getVideoData' });
    expect(req({ id: 'a1', type: 'getVolume' })).toEqual({ id: 'a1', type: 'getVolume' });
    expect(req({ id: 'a1', type: 'getCurrentTime' })).toEqual({ id: 'a1', type: 'getCurrentTime' });
    expect(req({ id: 'a1', type: 'setVolume', volume: 55 })).toEqual({ id: 'a1', type: 'setVolume', volume: 55 });
    expect(req({ id: 'a1', type: 'seekTo', seconds: 12.5 })).toEqual({ id: 'a1', type: 'seekTo', seconds: 12.5 });
  });

  it('多餘的欄位不會被帶進請求', () => {
    expect(req({ id: 'a1', type: 'getVolume', extra: 'x' })).toEqual({ id: 'a1', type: 'getVolume' });
  });

  it('拒絕未知的請求與不合法的參數', () => {
    expect(req({ id: 'a1', type: 'eval', code: '1' })).toBeNull();
    expect(req({ id: 'a1', type: 'setVolume', volume: 101 })).toBeNull();
    expect(req({ id: 'a1', type: 'setVolume', volume: -1 })).toBeNull();
    expect(req({ id: 'a1', type: 'setVolume', volume: '50' })).toBeNull();
    expect(req({ id: 'a1', type: 'seekTo', seconds: -3 })).toBeNull();
    expect(req({ id: 'a1', type: 'seekTo' })).toBeNull();
    expect(req({ type: 'getVolume' })).toBeNull();
    expect(req({ id: 'bad id!', type: 'getVolume' })).toBeNull();
  });

  it('拒絕不是 JSON 字串的 detail', () => {
    expect(parseBridgeRequest({ id: 'a1', type: 'getVolume' })).toBeNull();
    expect(parseBridgeRequest('not json')).toBeNull();
    expect(parseBridgeRequest('[1,2]')).toBeNull();
    expect(parseBridgeRequest('x'.repeat(5000))).toBeNull();
  });
});

describe('parseBridgeResponse', () => {
  it('解析成功與失敗回應', () => {
    expect(parseBridgeResponse(JSON.stringify({ id: 'a', ok: true, result: 3 }))).toEqual({ id: 'a', ok: true, result: 3 });
    expect(parseBridgeResponse(JSON.stringify({ id: 'a', ok: false, error: 'NO_PLAYER' }))).toEqual({
      id: 'a',
      ok: false,
      error: 'NO_PLAYER',
    });
    expect(parseBridgeResponse(JSON.stringify({ id: 'a', ok: false, error: '???' }))).toMatchObject({ error: 'FAILED' });
    expect(parseBridgeResponse(JSON.stringify({ ok: true }))).toBeNull();
  });
});

function fakePlayer(overrides: Partial<YtPlayerApi> = {}): YtPlayerApi {
  let volume = 40;
  let muted = true;
  return {
    getVideoData: () => ({ video_id: 'jNQXAC9IVRw', title: 'Me at the zoo', isLive: false }),
    getPlayerResponse: () => ({ videoDetails: { isLive: false, isUpcoming: false, lengthSeconds: '19' } }),
    getDuration: () => 19.1,
    getCurrentTime: () => 3.5,
    seekTo: vi.fn(),
    getVolume: () => volume,
    setVolume: (v: number) => {
      volume = v;
    },
    isMuted: () => muted,
    unMute: () => {
      muted = false;
    },
    ...overrides,
  };
}

describe('handleBridgeRequest', () => {
  it('找不到播放器時回傳 NO_PLAYER', () => {
    expect(handleBridgeRequest({ id: 'a', type: 'getVolume' }, null)).toEqual({ id: 'a', ok: false, error: 'NO_PLAYER' });
  });

  it('getVideoData 回傳精簡後的影片資料', () => {
    expect(handleBridgeRequest({ id: 'a', type: 'getVideoData' }, fakePlayer())).toEqual({
      id: 'a',
      ok: true,
      result: { videoId: 'jNQXAC9IVRw', title: 'Me at the zoo', duration: 19.1, isLive: false, isUpcoming: false },
    });
  });

  it('getVideoData 會標記直播與尚未開始的影片', () => {
    const live = fakePlayer({ getVideoData: () => ({ video_id: 'aaaaaaaaaaa', title: 't', isLive: true }) });
    expect(handleBridgeRequest({ id: 'a', type: 'getVideoData' }, live)).toMatchObject({ result: { isLive: true } });
    const upcoming = fakePlayer({
      getDuration: () => 0,
      getPlayerResponse: () => ({ videoDetails: { isUpcoming: true, lengthSeconds: '0' } }),
    });
    expect(handleBridgeRequest({ id: 'a', type: 'getVideoData' }, upcoming)).toMatchObject({
      result: { isUpcoming: true, duration: 0 },
    });
  });

  it('播放器沒有影片時 getVideoData 回傳 null', () => {
    const empty = fakePlayer({ getVideoData: () => ({}) });
    expect(handleBridgeRequest({ id: 'a', type: 'getVideoData' }, empty)).toEqual({ id: 'a', ok: true, result: null });
  });

  it('setVolume 設定音量，大於 0 時解除靜音', () => {
    const p = fakePlayer();
    handleBridgeRequest({ id: 'a', type: 'setVolume', volume: 72.4 }, p);
    expect(handleBridgeRequest({ id: 'b', type: 'getVolume' }, p)).toEqual({
      id: 'b',
      ok: true,
      result: { volume: 72, muted: false },
    });
  });

  it('seekTo 呼叫播放器跳轉', () => {
    const p = fakePlayer();
    handleBridgeRequest({ id: 'a', type: 'seekTo', seconds: 8 }, p);
    expect(p.seekTo).toHaveBeenCalledWith(8, true);
  });

  it('播放器方法丟出例外時回傳 FAILED', () => {
    const p = fakePlayer({
      getCurrentTime: () => {
        throw new Error('boom');
      },
    });
    expect(handleBridgeRequest({ id: 'a', type: 'getCurrentTime' }, p)).toEqual({ id: 'a', ok: false, error: 'FAILED' });
  });
});
