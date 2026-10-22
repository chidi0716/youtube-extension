import { describe, expect, it } from 'vitest';
import type { AudioTrackInfo } from '@/utils/youtube/dom';
import { CONTINUE_MIN_IDLE_MS, CONTINUE_PAUSE_WINDOW_MS, pickOriginalTrack, shouldAutoContinue } from './script-logic';

const t = (id: string, flags: Partial<AudioTrackInfo> = {}): AudioTrackInfo => ({
  id,
  name: id,
  isDefault: false,
  isAutoDubbed: false,
  isOriginal: false,
  ...flags,
});

describe('pickOriginalTrack（005 FR-10、FR-11）', () => {
  const original = t('en.4', { isDefault: true });
  const es = t('es.3', { isAutoDubbed: true });
  const ja = t('ja.3', { isAutoDubbed: true });

  it('預設播放自動配音時切換到原始語音（預設語音軌）', () => {
    expect(pickOriginalTrack([original, es, ja], 'es.3')).toBe('en.4');
  });

  it('有明確標示 acont=original 時優先使用', () => {
    const human = t('fr.2', { isDefault: true });
    const tagged = t('de.4', { isOriginal: true });
    expect(pickOriginalTrack([human, tagged, es], 'es.3')).toBe('de.4');
  });

  it('沒有標示也沒有預設時，使用唯一不是自動配音的語音軌', () => {
    expect(pickOriginalTrack([t('en.4'), es], 'es.3')).toBe('en.4');
  });

  it('無法確定哪一個是原始語音時不做任何事', () => {
    expect(pickOriginalTrack([t('en.4'), t('fr.4'), es], 'es.3')).toBeNull();
    expect(pickOriginalTrack([t('en.4', { isDefault: true }), t('fr.4', { isDefault: true }), es], 'es.3')).toBeNull();
    expect(pickOriginalTrack([es, ja], 'es.3')).toBeNull();
  });

  it('只有一個語音軌、或預設就不是自動配音時不做任何事（FR-11）', () => {
    expect(pickOriginalTrack([original], 'en.4')).toBeNull();
    expect(pickOriginalTrack([], null)).toBeNull();
    expect(pickOriginalTrack([original, es], 'en.4')).toBeNull();
    // 人工配音（不是自動配音）不處理
    expect(pickOriginalTrack([original, t('es.2')], 'es.2')).toBeNull();
  });

  it('讀不到目前的語音軌時不做任何事', () => {
    expect(pickOriginalTrack([original, es], null)).toBeNull();
    expect(pickOriginalTrack([original, es], 'xx.1')).toBeNull();
  });
});

describe('shouldAutoContinue（005 FR-30、FR-31）', () => {
  const base = { dialogVisible: true, videoPaused: true, msSinceUserInput: Number.POSITIVE_INFINITY, msSincePause: 200 };

  it('使用者長時間沒有操作、對話框出現且影片剛被暫停時繼續播放', () => {
    expect(shouldAutoContinue(base)).toBe(true);
    expect(shouldAutoContinue({ ...base, msSinceUserInput: CONTINUE_MIN_IDLE_MS })).toBe(true);
  });

  it('沒有對話框、或影片沒有暫停時不做任何事', () => {
    expect(shouldAutoContinue({ ...base, dialogVisible: false })).toBe(false);
    expect(shouldAutoContinue({ ...base, videoPaused: false })).toBe(false);
  });

  it('使用者剛操作過（例如自己按暫停或開啟其他對話框）時不自動播放（FR-31）', () => {
    expect(shouldAutoContinue({ ...base, msSinceUserInput: 1_000 })).toBe(false);
    expect(shouldAutoContinue({ ...base, msSinceUserInput: CONTINUE_MIN_IDLE_MS - 1 })).toBe(false);
  });

  it('影片很久以前就已暫停（不是這個對話框造成的）時不自動播放（FR-31）', () => {
    expect(shouldAutoContinue({ ...base, msSincePause: CONTINUE_PAUSE_WINDOW_MS + 1 })).toBe(false);
    expect(shouldAutoContinue({ ...base, msSincePause: Number.POSITIVE_INFINITY })).toBe(false);
  });
});
