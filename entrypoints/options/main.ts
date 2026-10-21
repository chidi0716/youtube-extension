import './style.css';
import { TIDY_CATEGORIES, type TidyOption } from '@/features/tidy/options';
import { applyI18n, t } from '@/utils/i18n';

// 設定頁：偏好設定依類別分組，每個選項一個開關、附一行說明（constitution 第 7a 點、005 FR-1）。
// 開關後立即寫入 sync 設定；已開啟的 YouTube 分頁由內容腳本監聽設定變更而立即生效（005 FR-3）。
// 下載資料夾、檔名格式、連線狀態等設定在 T23 加入。
applyI18n(document);
document.title = t('optionsTitle');

function optionRow(option: TidyOption): HTMLElement {
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
  option.item.watch((value) => {
    input.checked = value === true;
  });
  return row;
}

const groups = document.querySelector<HTMLElement>('#tidy-groups')!;
for (const category of TIDY_CATEGORIES) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'group';
  fieldset.dataset.category = category.id;
  const legend = document.createElement('legend');
  legend.textContent = t(category.title);
  fieldset.append(legend, ...category.options.map(optionRow));
  groups.append(fieldset);
}
