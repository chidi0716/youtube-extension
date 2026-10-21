import './style.css';
import { applyI18n, t } from '@/utils/i18n';
import { enabled } from '@/utils/settings';

// 介面文字一律來自 public/_locales，依瀏覽器語言自動選擇（預設英文）。
applyI18n(document);
document.title = t('extName');

// 「啟用」開關控制工具列是否顯示；工具列上的 ✕ 等同把它關掉（001 FR-16）。
const checkbox = document.querySelector<HTMLInputElement>('#enabled')!;
checkbox.checked = await enabled.getValue();
checkbox.addEventListener('change', () => enabled.setValue(checkbox.checked));
enabled.watch((value) => {
  checkbox.checked = value;
});
