# T00 技術驗證：Firefox MV3 背景頁與原生訊息

日期：2026-10-21　負責：實作方

## 結論

**維持 plan 的做法：Firefox 也使用 MV3，不需要改用 MV2。**

- Firefox MV3 的背景腳本是事件頁面（non-persistent），閒置 30 秒（`extensions.background.idle.timeout`，預設 30000 ms）後會被終止。
- 但**只要背景頁開著 `runtime.connectNative()` 的連線**（或有 `runtime.sendNativeMessage()` 還在等回覆），Firefox 在閒置時限到期時會重設計時器、不終止背景頁。這是 Firefox 104 起的行為（Bugzilla 1770696）。
- 實測（Firefox 158.0.1 正式版，headless）：連線開著的背景頁持續存活 **超過 360 秒**，期間連線一直可用；對照組（連線關閉）在每次被喚醒後約 **30 秒**就被暫停。

## 文件證據

| 來源 | 內容摘要 |
|---|---|
| Firefox 原始碼 [`toolkit/components/extensions/parent/ext-backgroundPage.js`](https://github.com/mozilla-firefox/firefox/blob/main/toolkit/components/extensions/parent/ext-backgroundPage.js) | `terminateBackground()` 中：「extensions non-persistent background scripts with a nativeMessaging port still open or a sendNativeMessage request still pending an answer are exempt from being terminated when the idle timeout expires」。條件為 `extension.backgroundContext?.hasActiveNativeAppPorts`，成立時發出 `background-script-reset-idle`（reason `nativeapp`）後直接 return。同檔定義 `extensions.background.idle.timeout` 預設 30000 ms（範圍 100 ms–5 分鐘）。 |
| [Bugzilla 1770696](https://bugzilla.mozilla.org/show_bug.cgi?id=1770696)「MV3 non-persistent background pages vs native messaging host」 | RESOLVED FIXED，Target Milestone：Firefox 104。 |
| Firefox 測試 [`test_ext_native_messaging.js`](https://github.com/mozilla-firefox/firefox/blob/main/toolkit/components/extensions/test/xpcshell/test_ext_native_messaging.js) | `test_open_connectNativePort_resets_bgscript_idle_timeout`、`test_pending_sendNativeMessageReply_resets_bgscript_idle_timeout`：以 `persistent: false` 背景頁驗證連線開著時閒置計時被重設，連線關閉後 `runtime.onSuspend` 才會觸發。 |
| GeckoView 測試 [`test_ext_native_messaging_geckoview.js`](https://searchfox.org/firefox-main/source/mobile/shared/components/extensions/test/xpcshell/test_ext_native_messaging_geckoview.js) | 同樣行為；另外驗證**從擴充功能分頁（非背景頁）開的連線不會讓背景頁維持存活**。 |
| MDN [Background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts) | 事件頁面「unload after a few seconds of inactivity」；一般的 `runtime.Port`（擴充功能內部訊息）不能阻止事件頁面被關閉；DOM 計時器（`setTimeout`）在閒置後不會保留，需要喚醒請用 `alarms`。MDN 沒有提到原生訊息連線的例外。 |
| MDN [Native messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging) | 原生程式「stays running until the extension calls `Port.disconnect()` or the page that connected to it is closed」；程式送往瀏覽器的單一訊息上限 1 MB。 |
| Chrome 文件 [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | 參考：Chrome 105 起，`connectNative()` 的連線會讓 service worker 維持存活；原生程式結束、連線關閉後，service worker 會在計時結束後終止，建議在 `onDisconnect` 中重新連線。兩個瀏覽器行為一致。 |

## 實測

### 環境

- Firefox 158.0.1（從 archive.mozilla.org 下載官方 Linux x86_64 版，SHA-256 已驗證），`--headless`。
- 以 `web-ext run`（repo 已有的 devDependency）載入暫時附加元件；沒有開啟附加元件的 DevTools 工具箱（工具箱開著時 Firefox 本來就不會暫停背景頁，會影響結果）。
- `HOME` 與 `TMPDIR` 指向 `spikes/T00/.cache/` 內的資料夾，原生訊息設定檔寫在 `$HOME/.mozilla/native-messaging-hosts/`，不碰真正的家目錄。
- 閒置時限維持預設值（30 秒）。

### 程式（`spikes/T00/`）

| 檔案 | 用途 |
|---|---|
| `host/spike_host.py` | 最小原生訊息 host（Python 暫代）：記錄每個訊息與 stdin EOF 的時間並回覆 |
| `ext/manifest.json`、`ext/background.js` | 最小 MV3 擴充功能，`background.scripts` 事件頁面 |
| `run.sh <mode> [秒數]` | 建立設定檔、啟動 headless Firefox、收集記錄 |
| `fetch-firefox.sh` | 下載並驗證 Firefox |
| `summarize.py` | 把 host 記錄整理成時間軸 |
| `results/` | 原始記錄與整理結果（`summary-run2.txt` 為主要結果） |

三種模式同時跑 380 秒：

- **silent**：啟動時開一條 `connectNative` 連線，之後完全不送訊息。
- **heartbeat**：同上，另外每 10 秒經由連線送一次訊息。
- **control（對照組）**：開連線 2 秒後主動 `disconnect()`。

背景頁設定每 60 秒一次的 `alarms`（間隔大於 30 秒的閒置時限）。alarm 觸發時（若背景頁已被終止，alarm 會重新喚醒它）回報：啟動次數（存在 `storage.local`）、本次執行個體的存活時間、最近一次 `onSuspend` 的時間，以及原本的連線是否還在。連線還在時，也經由該連線送一份回報。

### 結果（`spikes/T00/results/summary-run2.txt`）

| 模式 | 啟動次數（380 秒內） | 背景頁連續存活 | 原連線 | `onSuspend` |
|---|---|---|---|---|
| silent | 1 | 361 秒（最後一次 alarm 時），沒有中斷 | 一直開著，每分鐘的回報都經由原連線送達同一個 host 程序 | 沒有觸發 |
| heartbeat | 1 | 361 秒，沒有中斷；37 次心跳全部送達 | 一直開著 | 沒有觸發 |
| control | 7（每次 alarm 都重新啟動） | 每次被喚醒後約 30 秒就被終止（`onSuspend` 時間：30.2、90.1、150.4、210.2、270.3、330.6 秒） | 2 秒時關閉 | 每次都觸發 |

第一輪（只有 120 秒時的一次 alarm，記錄在 `results/run1-*`）結果相同：silent 與 heartbeat 存活 120 秒以上，control 在 30.45 秒時被暫停。

### 回答 tasks.md 的問題

> 確認 Firefox MV3 在原生訊息連線期間，背景頁不會被暫停超過 30 秒。

確認：連線期間背景頁**完全不會被暫停**（實測 6 分鐘以上），不必另外送心跳。

## 對後續實作的建議

1. **維持 MV3**（plan 第 2 節與 R1 不需要修改）。
2. 下載進行中，背景腳本必須一直開著 `connectNative` 連線（T16 `utils/native.ts`）；連線**一定要從背景腳本開**，從彈出視窗、設定頁開的連線不會讓背景頁存活。
3. 沒有下載時可以關閉連線，讓背景頁正常閒置（省資源）；關閉後背景頁約 30 秒會被終止，`setTimeout` 等計時器會消失，所以背景腳本的狀態要放在 `storage.session`（plan 3.8 已如此規劃），所有事件監聽器要在頂層同步註冊。
4. 橋接程式意外結束時連線會關閉，背景頁之後可能被終止；`onDisconnect` 時若仍有進行中的工作要重新連線，並依 plan 4.6 由橋接程式的狀態檔補發結果。
5. 測試時注意：開著該附加元件的 DevTools 工具箱時，Firefox 不會暫停背景頁，手動測試「背景頁被暫停」相關行為時要關掉工具箱。
6. 本實驗在 Linux 上進行；這個行為位於 Firefox 跨平台的擴充功能程式碼中，與作業系統無關，但 T24 的 E2E 仍應在 macOS 與 Windows 的 Firefox 上確認「下載途中關閉 YouTube 分頁仍會完成」（002 驗收條件）。

## 重現方式

```bash
npm install
spikes/T00/fetch-firefox.sh                 # 下載 Firefox 158.0.1 到 spikes/T00/.cache/
spikes/T00/run.sh silent 380                # 也可以用 heartbeat、control
python3 -I spikes/T00/summarize.py spikes/T00/results/silent.host.log
```
