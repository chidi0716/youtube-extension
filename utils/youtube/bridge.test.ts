import { describe, expect, it, vi } from 'vitest';
import { handleBridgeRequest, parseBridgeRequest, parseBridgeResponse } from './bridge';
import type { BridgePlayer } from './bridge';

const req = (obj: unknown) => parseBridgeRequest(JSON.stringify(obj));

describe('parseBridgeRequest', () => {
  it('接受白名單內的請求', () => {
    expect(req({ id: 'a1', type: 'getVideoData' })).toEqual({ id: 'a1', type: 'getVideoData' });
    expect(req({ id: 'a1', type: 'getVolume' })).toEqual({ id: 'a1', type: 'getVolume' });
    expect(req({ id: 'a1', type: 'getCurrentTime' })).toEqual({ id: 'a1', type: 'getCurrentTime' });
    expect(req({ id: 'a1', type: 'setVolume', volume: 55 })).toEqual({ id: 'a1', type: 'setVolume', volume: 55 });
    expect(req({ id: 'a1', type: 'seekTo', seconds: 12.5 })).toEqual({ id: 'a1', type: 'seekTo', seconds: 12.5 });
    expect(req({ id: 'a1', type: 'markThemeOptions' })).toEqual({ id: 'a1', type: 'markThemeOptions' });
  });

  it('markThemeOptions 不接受任何參數（多餘的欄位被丟掉），也沒有其他外觀相關的請求', () => {
    expect(req({ id: 'a1', type: 'markThemeOptions', theme: 'dark', selector: 'body' })).toEqual({ id: 'a1', type: 'markThemeOptions' });
    expect(req({ id: 'a1', type: 'setTheme', theme: 'dark' })).toBeNull();
    expect(req({ id: 'a1', type: 'click', selector: 'button' })).toBeNull();
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

function fakePlayer(overrides: Partial<BridgePlayer> = {}): BridgePlayer {
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
  it('markThemeOptions 不需要播放器；沒有文件時回報找不到選項', () => {
    expect(handleBridgeRequest({ id: 'a', type: 'markThemeOptions' }, null)).toEqual({
      id: 'a',
      ok: true,
      result: { dark: false, light: false },
    });
  });

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

describe('畫質請求（004 第 1 節、plan 3.5）', () => {
  it('接受 getAvailableQualities、getQuality 與白名單內的 setQuality', () => {
    expect(req({ id: 'q', type: 'getAvailableQualities' })).toEqual({ id: 'q', type: 'getAvailableQualities' });
    expect(req({ id: 'q', type: 'getQuality' })).toEqual({ id: 'q', type: 'getQuality' });
    for (const quality of ['tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'hd2880', 'highres', 'auto']) {
      expect(req({ id: 'q', type: 'setQuality', quality })).toEqual({ id: 'q', type: 'setQuality', quality });
    }
  });

  it('拒絕白名單以外的畫質參數', () => {
    for (const quality of ['1080p', 'HD1080', 'hd1080 ', '', 'unknown', 'toString', '__proto__', 1080, null, ['hd720'], { q: 1 }]) {
      expect(req({ id: 'q', type: 'setQuality', quality })).toBeNull();
    }
    expect(req({ id: 'q', type: 'setQuality' })).toBeNull();
  });

  function qualityPlayer(levels: unknown, current: unknown) {
    return fakePlayer({
      getAvailableQualityLevels: () => levels,
      getPlaybackQuality: () => current,
      setPlaybackQuality: vi.fn(),
      setPlaybackQualityRange: vi.fn(),
    });
  }

  it('getAvailableQualities 只回傳已知的代號（去掉 auto 與未知值）', () => {
    const p = qualityPlayer(['hd1080', 'hd720', 'weird', 'auto', 7], 'hd720');
    expect(handleBridgeRequest({ id: 'a', type: 'getAvailableQualities' }, p)).toEqual({ id: 'a', ok: true, result: ['hd1080', 'hd720'] });
    expect(handleBridgeRequest({ id: 'a', type: 'getAvailableQualities' }, qualityPlayer(undefined, null))).toEqual({
      id: 'a',
      ok: true,
      result: [],
    });
  });

  it('getQuality 回傳目前畫質；未知時為 null', () => {
    expect(handleBridgeRequest({ id: 'a', type: 'getQuality' }, qualityPlayer([], 'hd720'))).toEqual({ id: 'a', ok: true, result: 'hd720' });
    expect(handleBridgeRequest({ id: 'a', type: 'getQuality' }, qualityPlayer([], 'unknown'))).toEqual({ id: 'a', ok: true, result: null });
  });

  it('setQuality 把畫質範圍與畫質設成同一個代號', () => {
    const p = qualityPlayer(['hd1080'], 'hd720');
    expect(handleBridgeRequest({ id: 'a', type: 'setQuality', quality: 'hd1080' }, p)).toEqual({ id: 'a', ok: true, result: null });
    expect(p.setPlaybackQualityRange).toHaveBeenCalledWith('hd1080', 'hd1080');
    expect(p.setPlaybackQuality).toHaveBeenCalledWith('hd1080');
    handleBridgeRequest({ id: 'b', type: 'setQuality', quality: 'auto' }, p);
    expect(p.setPlaybackQualityRange).toHaveBeenLastCalledWith('auto', 'auto');
  });

  it('播放器沒有畫質方法時不會出錯', () => {
    const p = fakePlayer();
    expect(handleBridgeRequest({ id: 'a', type: 'getAvailableQualities' }, p)).toEqual({ id: 'a', ok: true, result: [] });
    expect(handleBridgeRequest({ id: 'a', type: 'getQuality' }, p)).toEqual({ id: 'a', ok: true, result: null });
    expect(handleBridgeRequest({ id: 'a', type: 'setQuality', quality: 'hd720' }, p)).toEqual({ id: 'a', ok: true, result: null });
  });
});

describe('語音軌請求（005 FR-10、plan 3.7.2）', () => {
  // 物件結構依真實播放器的 getAudioTrack()：id、xtags、內含 name／id／isDefault／isAutoDubbed 的子物件（短名稱）。
  const track = (id: string, name: string, isDefault: boolean, isAutoDubbed: boolean, xtags = '') => ({
    id,
    Nb: { name, id, isDefault, isAutoDubbed },
    xtags,
    captionTracks: [],
  });
  const original = track('en.4', 'English original', true, false);
  const dubbed = track('es.3', 'Spanish (auto-dubbed)', false, true);

  function audioPlayer(time = 42) {
    let current: unknown = dubbed;
    let t = time;
    return fakePlayer({
      getAvailableAudioTracks: () => [original, dubbed],
      getAudioTrack: () => current,
      setAudioTrack: vi.fn((tr: unknown) => {
        current = tr;
        return true;
      }),
      getCurrentTime: () => t,
      seekTo: vi.fn((s: number) => {
        t = s;
      }),
      _restart: () => {
        t = 0;
      },
    } as Partial<BridgePlayer>);
  }

  it('接受 getAudioTracks 與格式正確的 setAudioTrack', () => {
    expect(req({ id: 'a', type: 'getAudioTracks' })).toEqual({ id: 'a', type: 'getAudioTracks' });
    for (const trackId of ['en.4', 'es-419.3', 'und', 'en-US.4:x']) {
      expect(req({ id: 'a', type: 'setAudioTrack', trackId })).toEqual({ id: 'a', type: 'setAudioTrack', trackId });
    }
  });

  it('拒絕格式不對的語音軌 ID', () => {
    for (const trackId of ['', 'en 4', 'a'.repeat(65), '<script>', 'en/4', 4, null, { id: 'en.4' }]) {
      expect(req({ id: 'a', type: 'setAudioTrack', trackId })).toBeNull();
    }
    expect(req({ id: 'a', type: 'setAudioTrack' })).toBeNull();
  });

  it('getAudioTracks 回傳整理後的清單與目前的語音軌', () => {
    expect(handleBridgeRequest({ id: 'a', type: 'getAudioTracks' }, audioPlayer())).toEqual({
      id: 'a',
      ok: true,
      result: {
        tracks: [
          { id: 'en.4', name: 'English original', isDefault: true, isAutoDubbed: false, isOriginal: false },
          { id: 'es.3', name: 'Spanish (auto-dubbed)', isDefault: false, isAutoDubbed: true, isOriginal: false },
        ],
        current: 'es.3',
      },
    });
  });

  it('getAudioTracks 依 xtags 判斷原始語音與自動配音', () => {
    const p = fakePlayer({
      getAvailableAudioTracks: () => [{ id: 'en.4', xtags: 'acont=original:lang=en' }, { id: 'fr.3', xtags: 'acont=dubbed-auto:lang=fr' }, 'junk'],
      getAudioTrack: () => ({ id: 'fr.3', xtags: 'acont=dubbed-auto:lang=fr' }),
    });
    expect(handleBridgeRequest({ id: 'a', type: 'getAudioTracks' }, p)).toMatchObject({
      result: {
        tracks: [
          { id: 'en.4', isOriginal: true, isAutoDubbed: false },
          { id: 'fr.3', isOriginal: false, isAutoDubbed: true },
        ],
        current: 'fr.3',
      },
    });
  });

  it('setAudioTrack 只切換到清單中存在的語音軌', () => {
    const p = audioPlayer();
    expect(handleBridgeRequest({ id: 'a', type: 'setAudioTrack', trackId: 'en.4' }, p)).toEqual({ id: 'a', ok: true, result: true });
    expect(p.setAudioTrack).toHaveBeenCalledWith(original);
    expect(handleBridgeRequest({ id: 'b', type: 'setAudioTrack', trackId: 'de.3' }, p)).toEqual({ id: 'b', ok: true, result: false });
    expect(p.setAudioTrack).toHaveBeenCalledTimes(1);
  });

  it('切換後播放位置跳回開頭時，回到原本的位置（FR-13）', () => {
    const p = audioPlayer(42);
    (p.setAudioTrack as ReturnType<typeof vi.fn>).mockImplementation(() => {
      (p as unknown as { _restart: () => void })._restart();
      return true;
    });
    handleBridgeRequest({ id: 'a', type: 'setAudioTrack', trackId: 'en.4' }, p);
    expect(p.seekTo).toHaveBeenCalledWith(42, true);
  });

  it('播放器沒有語音軌方法時不會出錯', () => {
    const p = fakePlayer();
    expect(handleBridgeRequest({ id: 'a', type: 'getAudioTracks' }, p)).toEqual({ id: 'a', ok: true, result: { tracks: [], current: null } });
    expect(handleBridgeRequest({ id: 'a', type: 'setAudioTrack', trackId: 'en.4' }, p)).toEqual({ id: 'a', ok: true, result: false });
  });
});
