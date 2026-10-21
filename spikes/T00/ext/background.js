// T00 實驗用背景腳本（Firefox MV3 事件頁面）。
//
// 模式：
//   silent    第一次啟動時開啟 connectNative 連線，之後完全不傳訊息。
//   heartbeat 同上，另外每 10 秒經由連線送一次 tick。
//   control   開啟連線 2 秒後主動中斷（對照組：預期約 30 秒後被暫停）。
//
// 第一次啟動時設定每 60 秒一次的 alarm（間隔大於 30 秒的閒置時限，所以 alarm
// 本身不會讓背景頁一直維持在「非閒置」）。alarm 觸發時（若背景頁已被暫停，
// alarm 會把它重新喚醒），以 sendNativeMessage 回報 storage 內的啟動次數、
// onSuspend 時間與本次執行個體的存活時間，由 host 寫進記錄檔；若原本的連線
// 還開著，也經由該連線送一份，證明連線本身仍可使用。
const HOST = 'com.chidi0716.t00_spike';
const T0 = Date.now();
const MODE = self.T00_MODE;
let port = null;

// 監聽器必須在頂層同步註冊。
browser.runtime.onSuspend.addListener(() => {
  browser.storage.local.set({ lastSuspendAt: Date.now() });
});

let initDone;
const init = new Promise((resolve) => (initDone = resolve));

browser.alarms.onAlarm.addListener(async () => {
  await init;
  const s = await browser.storage.local.get(null);
  const report = {
    type: 'report',
    mode: MODE,
    starts: s.starts,
    firstStart: s.firstStart,
    lastSuspendAt: s.lastSuspendAt ?? null,
    suspendAfterSec: s.lastSuspendAt ? (s.lastSuspendAt - s.firstStart) / 1000 : null,
    portDisconnectedAt: s.portDisconnectedAt ?? null,
    thisInstanceStartedAt: T0,
    thisInstanceUptimeSec: (Date.now() - T0) / 1000,
    portStillOpen: port !== null,
  };
  port?.postMessage({ ...report, type: 'report-via-port' });
  try {
    await browser.runtime.sendNativeMessage(HOST, report);
  } catch (e) {
    console.error('report failed', e);
  }
});

(async () => {
  const s = await browser.storage.local.get(['starts', 'firstStart']);
  const starts = (s.starts ?? 0) + 1;
  await browser.storage.local.set({ starts, firstStart: s.firstStart ?? T0 });
  initDone();
  if (starts > 1) return; // 被 alarm 喚醒的那次不再開連線

  browser.alarms.create('check', { when: T0 + 60_000, periodInMinutes: 1 });

  port = browser.runtime.connectNative(HOST);
  port.onDisconnect.addListener((p) => {
    port = null;
    browser.storage.local.set({ portDisconnectedAt: Date.now() });
  });
  port.postMessage({ type: 'hello', mode: MODE, t0: T0 });

  if (MODE === 'heartbeat') {
    setInterval(() => {
      port?.postMessage({ type: 'tick', uptimeSec: (Date.now() - T0) / 1000 });
    }, 10_000);
  }
  if (MODE === 'control') {
    setTimeout(() => {
      port?.disconnect();
      port = null;
    }, 2_000);
  }
})();
