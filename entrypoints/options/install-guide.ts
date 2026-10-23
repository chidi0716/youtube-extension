// 設定頁「下載」區的安裝說明（008 FR-2）：與影片／MP3 面板相同的一行指令、複製、三步驟與「這個指令會做什麼？」。
// 設定頁不使用 Preact，以 DOM API 建立（資料來自 features/downloads/install-guide.ts）。
import { createIconElement } from '@/components/icon-data';
import {
  detailSource,
  INSTALL_COMMANDS,
  INSTALL_DETAILS,
  INSTALL_STEPS,
  INSTALL_TITLES,
  platformToOs,
  REVIEW_COMMANDS,
} from '@/features/downloads/install-guide';
import { detectOs, type HostOs } from '@/features/downloads/logic';
import { t } from '@/utils/i18n';

/** 作業系統：runtime.getPlatformInfo（不需要權限，plan 3.10）；失敗時依 user agent。 */
export async function platformOs(): Promise<HostOs> {
  try {
    return platformToOs((await browser.runtime.getPlatformInfo()).os);
  } catch {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    return detectOs(nav.userAgentData?.platform || navigator.platform || '', navigator.userAgent);
  }
}

function text<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, content: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = content;
  return el;
}

/** 指令與「複製」按鈕；無法寫入剪貼簿時選取指令文字。 */
export function copyCommand(command: string, id: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'command';
  const code = text('code', 'code command-text', command);
  code.id = id;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.setAttribute('aria-describedby', id);
  const label = document.createElement('span');
  const setLabel = (copied: boolean) => {
    button.replaceChildren(createIconElement(copied ? 'check' : 'content_copy', 18), label);
    label.textContent = copied ? t('installCopied') : t('installCopy');
  };
  setLabel(false);
  const status = text('span', 'option-desc command-status', '');
  status.setAttribute('role', 'status');
  let timer: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', () => {
    status.textContent = '';
    const write = navigator.clipboard?.writeText(command) ?? Promise.reject(new Error('clipboard unavailable'));
    write.then(
      () => {
        setLabel(true);
        clearTimeout(timer);
        timer = setTimeout(() => setLabel(false), 2000);
      },
      () => {
        status.textContent = t('installCopyFailed');
        window.getSelection()?.selectAllChildren(code);
      },
    );
  });
  wrap.append(code, button, status);
  return wrap;
}

/** 依作業系統的安裝說明。 */
export function installGuide(os: HostOs, idPrefix: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'install-guide';
  wrap.dataset.os = os;
  wrap.append(text('p', 'option-name install-title', t(INSTALL_TITLES[os])));
  if (os === 'other') {
    wrap.append(text('p', 'option-desc', t('hostOtherOs')));
    return wrap;
  }
  const steps = document.createElement('ol');
  steps.className = 'install-steps';
  for (const key of INSTALL_STEPS[os]) steps.append(text('li', '', t(key)));

  const details = document.createElement('details');
  details.className = 'install-details';
  details.append(text('summary', '', t('installWhatTitle')));
  const list = document.createElement('ol');
  for (const d of INSTALL_DETAILS) {
    const li = text('li', '', t(d.text));
    const source = detailSource(d, os);
    if (source) li.append(text('code', 'inline-code', source));
    list.append(li);
  }
  details.append(list, text('p', 'option-desc', t('installWhatNote')), text('p', 'option-desc', t('installReview')), text('code', 'code review-code', REVIEW_COMMANDS[os].join('\n')));

  wrap.append(copyCommand(INSTALL_COMMANDS[os], `${idPrefix}-command`), steps, details);
  return wrap;
}
