// 深色模式即時切換（003 FR-11、FR-16，T06b）中不依賴 DOM 的判斷，供 dark-mode.ts 使用並有單元測試。
import { readThemePreference, withThemePreference } from '@/utils/youtube/dom';

export type ThemeChoice = 'dark' | 'light';

/** 解析 getComputedStyle 回傳的 rgb()／rgba() 色彩；其他格式回傳 null。 */
export function parseCssColor(color: string): { r: number; g: number; b: number; a: number } | null {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(color.trim());
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number(m[4]);
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if (![r, g, b, alpha].every(Number.isFinite)) return null;
  return { r, g, b, a: alpha };
}

/** 這個背景色屬於深色或淺色主題（依相對亮度）；無法判斷或完全透明時回傳 null。 */
export function themeOfColor(color: string | null): ThemeChoice | null {
  const c = color === null ? null : parseCssColor(color);
  if (!c || c.a === 0) return null;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  return luminance < 0.18 ? 'dark' : 'light';
}

/**
 * 被 `:root:root` 固定的顏色變數，切換到指定主題時要覆寫成的值：取 YouTube 樣式表中該主題
 * （[dark] 或 [light]）的值；樣式表沒有該主題的值時不覆寫（維持原值）。
 */
export function pinnedVariableOverrides(
  vars: { pinned: ReadonlySet<string>; dark: ReadonlyMap<string, string>; light: ReadonlyMap<string, string> },
  theme: ThemeChoice,
): Array<[name: string, value: string]> {
  const source = theme === 'dark' ? vars.dark : vars.light;
  const out: Array<[string, string]> = [];
  for (const name of vars.pinned) {
    const value = source.get(name);
    if (value) out.push([name, value]);
  }
  return out;
}

/**
 * PREF 中的主題偏好與要維持的主題不同時，回傳修正後的 PREF 值（只改主題旗標，其他欄位原樣保留）；
 * 已經相同、或 f6 格式不對不能安全修改時回傳 null。
 */
export function prefNeedingFix(prefValue: string | null, desired: ThemeChoice): string | null {
  if (readThemePreference(prefValue) === desired) return null;
  return withThemePreference(prefValue, desired);
}

/**
 * <html> 的主題是否被別人（例如 YouTube 自己的外觀選單）改成與要維持的主題不同。
 * 深色時看 dark 是否還在；淺色時看是否被加上 dark。`light` 只有擴充功能會加，被移除時直接補回。
 */
export function htmlThemeChangedByOthers(desired: ThemeChoice, hasDark: boolean): boolean {
  return desired === 'dark' ? !hasDark : hasDark;
}

/**
 * 主題偏好被改掉時的寬限期判斷：第一次發現不同時只記下時間，持續超過 graceMs 才修正，
 * 避免蓋掉 YouTube 選單寫入後立即重新載入前的那一瞬間（實測 YouTube 寫入後約 2 ms 就開始重新載入）。
 * 回傳新的「開始不同的時間」與是否要修正。
 */
export function prefFixDecision(
  differs: boolean,
  since: number | null,
  now: number,
  graceMs: number,
): { since: number | null; fix: boolean } {
  if (!differs) return { since: null, fix: false };
  if (since === null) return { since: now, fix: false };
  if (now - since < graceMs) return { since, fix: false };
  return { since: null, fix: true };
}
