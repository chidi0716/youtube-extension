import './style.css';
import { TIDY_CATEGORIES, type TidyOption } from '@/features/tidy/options';
import { applyI18n, initI18n, onLocaleChange, resolveLocale, setLocale, t, UI_LANGUAGES } from '@/utils/i18n';
import { UI_LANGUAGE_VALUES, uiLanguage, type UiLanguagePreference } from '@/utils/settings';
import { renderDownloads } from './downloads';
import { renderToolbarSettings } from './toolbar';

// 設定頁：偏好設定依類別分組，每個選項一個開關、附一行說明（constitution 第 7a 點、005 FR-1）。
// 開關後立即寫入 sync 設定；已開啟的 YouTube 分頁由內容腳本監聽設定變更而立即生效（005 FR-3）。

function optionRow(option: TidyOption, cleanups: Array<() => void>): HTMLElement {
  const row = document.createElement('div');
  row.className = 'option';
  row.dataset.option = option.id;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = `option-${option.id}`;
  input.className = 'switch';
  input.setAttribute('role', 'switch');
  input.setAttribute('aria-describedby', `option-${option.id}-desc`);

  const text = document.createElement('label');
  text.className = 'option-text';
  text.htmlFor = input.id;
  const name = document.createElement('span');
  name.className = 'option-name';
  name.textContent = t(option.label);
  const desc = document.createElement('span');
  desc.className = 'option-desc';
  desc.id = `option-${option.id}-desc`;
  desc.textContent = t(option.description);
  text.append(name, desc);

  row.append(text, input);

  // 讀到設定前先停用，避免使用者在讀取完成前切換造成覆蓋。
  input.disabled = true;
  void option.item.getValue().then((value) => {
    input.checked = value === true;
    input.disabled = false;
  });
  input.addEventListener('change', () => {
    void option.item.setValue(input.checked);
  });
  // 其他分頁或其他裝置（同步）改變設定時更新。
  cleanups.push(
    option.item.watch((value) => {
      input.checked = value === true;
    }),
  );
  return row;
}

/** 介面語言選單（007 FR-1、FR-5）。 */
function renderLanguage(root: HTMLElement, focus: boolean): () => void {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'group';
  fieldset.dataset.category = 'language';
  const row = document.createElement('div');
  row.className = 'option';
  const label = document.createElement('label');
  label.className = 'option-text';
  label.htmlFor = 'ui-language';
  const name = document.createElement('span');
  name.className = 'option-name';
  name.textContent = t('optionsLanguage');
  const note = document.createElement('span');
  note.className = 'option-desc';
  note.id = 'ui-language-note';
  note.textContent = t('optionsLanguageNote');
  label.append(name, note);
  const select = document.createElement('select');
  select.id = 'ui-language';
  select.className = 'select';
  select.setAttribute('aria-describedby', note.id);
  for (const option of UI_LANGUAGES) {
    const el = document.createElement('option');
    el.value = option.value;
    // 語言名稱以該語言本身顯示，「跟隨瀏覽器」以目前的介面語言顯示。
    el.textContent = option.label ? t(option.label) : (option.native ?? option.value);
    if (option.native) el.lang = option.value === 'zh_TW' ? 'zh-TW' : option.value;
    select.append(el);
  }
  select.disabled = true;
  void uiLanguage.getValue().then((value) => {
    select.value = UI_LANGUAGE_VALUES.includes(value) ? value : 'auto';
    select.disabled = false;
    if (focus) select.focus();
  });
  select.addEventListener('change', async () => {
    const value = select.value as UiLanguagePreference;
    // 寫入設定（已開啟的 YouTube 分頁跟著改變），再立即以新語言重新繪製設定頁（007 FR-3）。
    await uiLanguage.setValue(value);
    setLocale(resolveLocale(value));
  });
  row.append(label, select);
  fieldset.append(row);
  root.append(fieldset);
  return () => {};
}

/** 繪製整個設定頁；介面語言改變時以新語言重新繪製（007 FR-3）。回傳取消監聽的函式。 */
function renderPage(focusId?: string): () => void {
  applyI18n(document);
  document.title = t('optionsTitle');
  const cleanups: Array<() => void> = [];
  const container = (id: string) => {
    const el = document.querySelector<HTMLElement>(id)!;
    el.replaceChildren();
    return el;
  };
  cleanups.push(renderLanguage(container('#language-groups'), focusId === 'ui-language'));
  // 工具列（T34）
  cleanups.push(renderToolbarSettings(container('#toolbar-groups')));
  const groups = container('#tidy-groups');
  for (const category of TIDY_CATEGORIES) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'group';
    fieldset.dataset.category = category.id;
    const legend = document.createElement('legend');
    legend.textContent = t(category.title);
    fieldset.append(legend, ...category.options.map((o) => optionRow(o, cleanups)));
    groups.append(fieldset);
  }
  // 下載（T23）
  cleanups.push(renderDownloads(container('#downloads-groups')));
  return () => cleanups.forEach((c) => c());
}

await initI18n();
let dispose = renderPage();
onLocaleChange(() => {
  const focusedId = (document.activeElement as HTMLElement | null)?.id;
  dispose();
  dispose = renderPage(focusedId);
  if (focusedId && focusedId !== 'ui-language') document.getElementById(focusedId)?.focus();
});
