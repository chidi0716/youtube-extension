// 字幕面板（002 FR-40 至 FR-45）：字幕清單分成「上傳的字幕」與「自動產生的字幕」兩組，可選擇檔案格式，
// 由擴充功能直接下載並轉換（不需要橋接程式）。直接下載失敗時顯示錯誤並說明安裝橋接程式可改善
// （改用橋接程式的部分在 T21）。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { currentTitle, sendToBackground } from '@/features/downloads/content';
import { orderCaptions } from '@/features/downloads/logic';
import { CAPTION_FORMATS, type CaptionFormat } from '@/utils/filename';
import { t, type MessageKey } from '@/utils/i18n';
import type { CaptionTrack } from '@/utils/youtube/dom';
import { player } from '@/utils/youtube/player';
import { Button } from '../controls/Button';
import { Select } from '../controls/Select';
import { Icon } from '../icons';
import { PanelError, PanelLoading } from './PanelStatus';
import { isLiveOrUpcoming, useVideoData } from './useVideoData';

const FORMAT_LABELS: Record<CaptionFormat, MessageKey> = {
  srt: 'subtitlesFormatSrt',
  vtt: 'subtitlesFormatVtt',
  txt: 'subtitlesFormatTxt',
};
const SAVED_MS = 2500;

type TracksState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; tracks: CaptionTrack[] };
type DownloadState = { state: 'idle' } | { state: 'saving' } | { state: 'saved' } | { state: 'failed' };

const trackId = (track: CaptionTrack) => `${track.isAuto ? 'auto' : 'up'}-${track.languageCode}-${track.url.length}`;

export function SubtitlePanel({ videoId }: { videoId: string }) {
  const [attempt, setAttempt] = useState(0);
  const video = useVideoData(videoId, attempt);
  const [tracks, setTracks] = useState<TracksState>({ status: 'loading' });
  /** 使用者選擇的字幕；還沒選時使用預設（FR-43）。 */
  const [chosen, setChosen] = useState<CaptionTrack | null>(null);
  const [format, setFormat] = useState<CaptionFormat>('srt');
  const [download, setDownload] = useState<DownloadState>({ state: 'idle' });

  useEffect(() => {
    let current = true;
    setTracks({ status: 'loading' });
    setChosen(null);
    setDownload({ state: 'idle' });
    player
      .getCaptionTracks()
      .then((list) => current && setTracks({ status: 'ready', tracks: list }))
      .catch(() => current && setTracks({ status: 'error' }));
    return () => {
      current = false;
    };
  }, [videoId, attempt]);

  const ordered = useMemo(
    () => (tracks.status === 'ready' ? orderCaptions(tracks.tracks, browser.i18n.getUILanguage() || navigator.language) : null),
    [tracks],
  );
  const selected = chosen ?? ordered?.selected ?? null;

  useEffect(() => {
    if (download.state !== 'saved') return;
    const timer = setTimeout(() => setDownload({ state: 'idle' }), SAVED_MS);
    return () => clearTimeout(timer);
  }, [download]);

  if (video.status === 'loading' || tracks.status === 'loading') return <PanelLoading />;
  if (video.status === 'error' || tracks.status === 'error') return <PanelError onRetry={() => setAttempt((n) => n + 1)} />;
  if (isLiveOrUpcoming(video.data)) return <p class="yte-muted">{t('liveUnavailable')}</p>;
  if (!ordered || tracks.tracks.length === 0) return <p class="yte-muted">{t('subtitlesNone')}</p>;

  const start = async () => {
    if (!selected) return;
    setDownload({ state: 'saving' });
    const title = await currentTitle(videoId);
    const res = await sendToBackground({
      type: 'downloadCaption',
      videoId,
      title,
      languageCode: selected.languageCode,
      url: selected.url,
      format,
    });
    setDownload({ state: res.ok ? 'saved' : 'failed' });
  };

  const group = (key: 'uploaded' | 'auto', title: MessageKey) => {
    const list = ordered.groups[key];
    if (list.length === 0) return null;
    return (
      <fieldset class="yte-fieldset yte-subs-group" data-group={key}>
        <legend class="yte-subs-legend">{t(title)}</legend>
        {list.map((track) => (
          <label key={trackId(track)} class="yte-radio yte-subs-track" data-lang={track.languageCode} data-auto={track.isAuto ? '' : undefined}>
            <input type="radio" name="yte-subs-track" checked={selected === track} onChange={() => setChosen(track)} />
            <span>{track.name}</span>
            {track.isAuto && (
              <span class="yte-subs-auto" title={t('subtitlesAutoBadge')} aria-label={t('subtitlesAutoBadge')}>
                <Icon name="graphic_eq" size={18} />
              </span>
            )}
          </label>
        ))}
      </fieldset>
    );
  };

  return (
    <div class="yte-subs">
      <div class="yte-subs-list">
        {group('uploaded', 'subtitlesUploaded')}
        {group('auto', 'subtitlesAuto')}
      </div>
      <div class="yte-subs-footer">
        <label class="yte-field yte-subs-format">
          <span>{t('subtitlesFormat')}</span>
          <Select
            id="yte-subs-format"
            value={format}
            options={CAPTION_FORMATS.map((value) => ({ value, label: t(FORMAT_LABELS[value]) }))}
            onChange={setFormat}
          />
        </label>
        <Button variant="primary" disabled={!selected || download.state === 'saving'} onClick={() => void start()}>
          <Icon name="download" size={18} />
          <span>{t('download')}</span>
        </Button>
      </div>
      <p class="yte-subs-status" aria-live="polite">
        {download.state === 'saved' && (
          <span class="yte-subs-saved">
            <Icon name="check" size={18} />
            {t('downloadSaved')}
          </span>
        )}
      </p>
      {download.state === 'failed' && (
        <div class="yte-status yte-status-error yte-subs-error" role="alert">
          <Icon name="error" />
          <span>{t('subtitlesDirectFailed')}</span>
          <Button variant="secondary" onClick={() => void start()}>
            <Icon name="refresh" size={18} />
            <span>{t('retry')}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
