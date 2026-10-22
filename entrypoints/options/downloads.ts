// 設定頁的「下載」區（002 FR-60、004 FR-11，tasks T23）：連線狀態（橋接程式、yt-dlp、ffmpeg、deno）、
// 更新 yt-dlp、下載資料夾、檔名格式、嵌入資訊開關。設定改變時立即寫入；背景腳本在下次下載時讀取。
import { checkHostStatus, HostError, pickFolder, updateYtDlp } from '@/features/downloads/host-client';
import { componentState, componentVersion, HOST_COMPONENTS, INSTALL_GUIDE_URL, installCommand, type HostComponent, type HostState } from '@/features/downloads/host-status';
import { detectOs } from '@/features/downloads/logic';
import { t, type MessageKey } from '@/utils/i18n';
import { downloadDir, embedInfo, namePreset } from '@/utils/settings';

const COMPONENT_LABELS: Record<HostComponent, MessageKey> = {
  host: 'hostComponentHelper',
  ytDlp: 'hostComponentYtDlp',
  ffmpeg: 'hostComponentFfmpeg',
  deno: 'hostComponentDeno',
};

/** 橋接程式內建的檔名格式（status 的 namePresets）；沒有連線時也能顯示目前的選擇。 */
const PRESET_LABELS: Record<string, MessageKey> = {
  'title-id': 'namePresetTitleId',
  title: 'namePresetTitle',
  'channel-title': 'namePresetChannelTitle',
  'date-title': 'namePresetDateTitle',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { dataset?: Record<string, string> } = {}, ...children: Array<Node | string>) {
  const node = document.createElement(tag);
  const { dataset, ...rest } = props;
  Object.assign(node, rest);
  if (dataset) Object.assign(node.dataset, dataset);
  node.append(...children);
  return node;
}

function group(id: string, title: MessageKey): HTMLFieldSetElement {
  const fieldset = el('fieldset', { className: 'group', dataset: { category: id } });
  fieldset.append(el('legend', { textContent: t(title) }));
  return fieldset;
}

const os = () => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectOs(nav.userAgentData?.platform || navigator.platform || '', navigator.userAgent);
};

export function renderDownloads(root: HTMLElement): void {
  let state: HostState | null = null;

  // ---- 連線狀態 ----
  const connection = group('connection', 'optionsConnection');
  const list = el('div', { className: 'status-list' });
  const install = el('div', { className: 'status-install' });
  const recheck = el('button', { type: 'button', className: 'button', id: 'downloads-recheck', textContent: t('hostRecheck') });
  const update = el('button', { type: 'button', className: 'button', id: 'downloads-update', textContent: t('updateYtDlp') });
  const updateResult = el('div', { className: 'option-desc update-result', id: 'downloads-update-result' });
  updateResult.setAttribute('role', 'status');
  connection.append(list, install, el('div', { className: 'actions' }, recheck, update), updateResult);

  // ---- 下載資料夾 ----
  const folder = group('folder', 'optionsFolder');
  const folderPath = el('span', { className: 'option-name folder-path', id: 'downloads-folder' });
  const choose = el('button', { type: 'button', className: 'button', id: 'downloads-choose', textContent: t('optionsFolderChoose') });
  const reset = el('button', { type: 'button', className: 'button', id: 'downloads-reset', textContent: t('optionsFolderReset') });
  const folderError = el('div', { className: 'option-desc error', id: 'downloads-folder-error' });
  folder.append(el('div', { className: 'option' }, el('span', { className: 'option-text' }, folderPath)), el('div', { className: 'actions' }, choose, reset), folderError);

  // ---- 下載的檔案：檔名格式、嵌入資訊 ----
  const files = group('files', 'optionsFiles');
  const select = el('select', { id: 'downloads-name-preset', className: 'select' });
  const embedInput = el('input', { type: 'checkbox', id: 'downloads-embed', className: 'switch' });
  embedInput.setAttribute('role', 'switch');
  embedInput.setAttribute('aria-describedby', 'downloads-embed-desc');
  files.append(
    el('div', { className: 'option', dataset: { option: 'namePreset' } }, el('label', { className: 'option-text', htmlFor: 'downloads-name-preset' }, el('span', { className: 'option-name', textContent: t('optionsNamePreset') })), select),
    el(
      'div',
      { className: 'option', dataset: { option: 'embed' } },
      el('label', { className: 'option-text', htmlFor: 'downloads-embed' }, el('span', { className: 'option-name', textContent: t('optionsEmbed') }), el('span', { className: 'option-desc', id: 'downloads-embed-desc', textContent: t('optionsEmbedDesc') })),
      embedInput,
    ),
  );

  root.append(connection, folder, files);

  const renderStatus = () => {
    list.replaceChildren();
    if (!state) {
      list.append(el('div', { className: 'option-desc', textContent: t('hostChecking') }));
      return;
    }
    for (const c of HOST_COMPONENTS) {
      const ok = componentState(state, c);
      const version = componentVersion(state, c);
      const text =
        ok === null
          ? t(c === 'host' ? 'hostStatusUnreachable' : 'hostStatusUnknown')
          : ok
            ? version
              ? t('hostStatusVersion', version)
              : t('hostStatusFound')
            : t(c === 'host' ? 'hostStatusUnreachable' : 'hostStatusMissing');
      list.append(
        el('div', { className: 'status-row', dataset: { component: c, ok: String(ok === true) } }, el('span', { textContent: t(COMPONENT_LABELS[c]) }), el('span', { className: 'option-desc', textContent: text })),
      );
    }
    install.replaceChildren();
    const missing = state.state === 'unreachable' || !state.status.complete;
    if (missing) {
      const command = installCommand(state, os());
      if (command) install.append(el('code', { className: 'code', textContent: command }));
      const link = el('a', { href: INSTALL_GUIDE_URL, target: '_blank', rel: 'noopener noreferrer', textContent: t('hostInstallGuide') });
      install.append(link);
    }
    const connected = state.state === 'connected';
    update.disabled = !connected || componentState(state, 'ytDlp') !== true;
    choose.disabled = !connected;
    renderFolder();
    renderPresets();
  };

  const renderFolder = async () => {
    const dir = await downloadDir.getValue();
    const defaultDir = state?.state === 'connected' ? state.status.defaultDir : '';
    folderPath.textContent = dir || (defaultDir ? t('optionsFolderDefault', defaultDir) : t('optionsFolderDefaultUnknown'));
    reset.disabled = !dir;
  };

  const renderPresets = async () => {
    const current = await namePreset.getValue();
    const presets = state?.state === 'connected' && state.status.namePresets.length ? state.status.namePresets : Object.keys(PRESET_LABELS).map((id) => ({ id }));
    select.replaceChildren(
      ...presets.map((p) => {
        const label = PRESET_LABELS[p.id] ? t(PRESET_LABELS[p.id]!) : p.id;
        return el('option', { value: p.id, textContent: label });
      }),
    );
    select.value = presets.some((p) => p.id === current) ? current : 'title-id';
  };

  const check = async (refresh: boolean) => {
    recheck.disabled = true;
    recheck.textContent = t('hostChecking');
    state = await checkHostStatus(refresh);
    recheck.disabled = false;
    recheck.textContent = t('hostRecheck');
    renderStatus();
  };

  recheck.addEventListener('click', () => void check(true));
  update.addEventListener('click', async () => {
    update.disabled = true;
    updateResult.textContent = t('updateRunning');
    try {
      const r = await updateYtDlp();
      updateResult.replaceChildren();
      if (!r.ran && r.command) updateResult.append(t('updateRunCommand'), el('code', { className: 'code', textContent: r.command }));
      else updateResult.textContent = r.updated ? t('updateDone', r.version ?? '') : t('updateUpToDate');
    } catch {
      updateResult.textContent = t('updateFailed');
    }
    update.disabled = false;
    void check(true);
  });
  choose.addEventListener('click', async () => {
    folderError.textContent = '';
    try {
      const path = await pickFolder();
      if (path) await downloadDir.setValue(path);
    } catch (err) {
      folderError.textContent = err instanceof HostError && err.code === 'UNSUPPORTED_PLATFORM' ? t('optionsFolderUnsupported') : t('errDownloadFailed');
    }
    void renderFolder();
  });
  reset.addEventListener('click', async () => {
    await downloadDir.setValue(null);
    void renderFolder();
  });
  select.addEventListener('change', () => void namePreset.setValue(select.value));
  embedInput.disabled = true;
  void embedInfo.getValue().then((v) => {
    embedInput.checked = v !== false;
    embedInput.disabled = false;
  });
  embedInput.addEventListener('change', () => void embedInfo.setValue(embedInput.checked));
  downloadDir.watch(() => void renderFolder());

  renderStatus();
  void check(false);
}
