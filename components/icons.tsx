// Google Material Symbols（Outlined，weight 400，Apache 2.0）以 SVG 字串打包進擴充功能
// （constitution 第 6 點）。這裡只取出 path，再用 JSX 畫出 <svg>，不使用 innerHTML。
import arrowDropDown from '@material-symbols/svg-400/outlined/arrow_drop_down.svg?raw';
import close from '@material-symbols/svg-400/outlined/close.svg?raw';
import darkMode from '@material-symbols/svg-400/outlined/dark_mode.svg?raw';
import dragIndicator from '@material-symbols/svg-400/outlined/drag_indicator.svg?raw';
import error from '@material-symbols/svg-400/outlined/error.svg?raw';
import help from '@material-symbols/svg-400/outlined/help.svg?raw';
import image from '@material-symbols/svg-400/outlined/image.svg?raw';
import keep from '@material-symbols/svg-400/outlined/keep.svg?raw';
import keepOff from '@material-symbols/svg-400/outlined/keep_off.svg?raw';
import lightbulb from '@material-symbols/svg-400/outlined/lightbulb.svg?raw';
import moreVert from '@material-symbols/svg-400/outlined/more_vert.svg?raw';
import movie from '@material-symbols/svg-400/outlined/movie.svg?raw';
import musicNote from '@material-symbols/svg-400/outlined/music_note.svg?raw';
import photoCamera from '@material-symbols/svg-400/outlined/photo_camera.svg?raw';
import pictureInPictureAlt from '@material-symbols/svg-400/outlined/picture_in_picture_alt.svg?raw';
import progressActivity from '@material-symbols/svg-400/outlined/progress_activity.svg?raw';
import refresh from '@material-symbols/svg-400/outlined/refresh.svg?raw';
import repeat from '@material-symbols/svg-400/outlined/repeat.svg?raw';
import settings from '@material-symbols/svg-400/outlined/settings.svg?raw';
import subtitles from '@material-symbols/svg-400/outlined/subtitles.svg?raw';
import brandingWatermark from '@material-symbols/svg-400/outlined/branding_watermark.svg?raw';

const SOURCES = {
  arrow_drop_down: arrowDropDown,
  branding_watermark: brandingWatermark,
  close,
  dark_mode: darkMode,
  drag_indicator: dragIndicator,
  error,
  help,
  image,
  keep,
  keep_off: keepOff,
  lightbulb,
  more_vert: moreVert,
  movie,
  music_note: musicNote,
  photo_camera: photoCamera,
  picture_in_picture_alt: pictureInPictureAlt,
  progress_activity: progressActivity,
  refresh,
  repeat,
  settings,
  subtitles,
} as const;

export type IconName = keyof typeof SOURCES;

/** 從 Material Symbols 的 SVG 字串取出 viewBox 與所有 path 的 d 屬性。 */
export function parseSymbolSvg(svg: string): { viewBox: string; paths: string[] } {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 -960 960 960';
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]!);
  return { viewBox, paths };
}

const PARSED = Object.fromEntries(
  Object.entries(SOURCES).map(([name, svg]) => [name, parseSymbolSvg(svg)]),
) as Record<IconName, { viewBox: string; paths: string[] }>;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const { viewBox, paths } = PARSED[name];
  return (
    <svg
      class="yte-icon"
      width={size}
      height={size}
      viewBox={viewBox}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
