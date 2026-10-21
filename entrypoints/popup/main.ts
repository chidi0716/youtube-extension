import './style.css';

// 介面文字一律來自 public/_locales，依瀏覽器語言自動選擇（預設英文）。
document.documentElement.lang = browser.i18n.getUILanguage();
document.title = browser.i18n.getMessage('extName');
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  el.textContent = browser.i18n.getMessage(el.dataset.i18n as Parameters<typeof browser.i18n.getMessage>[0]);
}

const checkbox = document.querySelector<HTMLInputElement>('#enabled')!;

checkbox.checked = await enabled.getValue();
checkbox.addEventListener('change', () => enabled.setValue(checkbox.checked));
