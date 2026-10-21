# T06a 深色模式：YouTube 主題偏好的儲存方式

日期：2026-10-21　負責：實作方

> T06b 已改為即時切換、不重新載入（見 [`T06b-dark-mode-instant.md`](./T06b-dark-mode-instant.md)）。本筆記的 `PREF` 格式仍然適用；「改偏好後重新載入」只作為退回方案，手動驗證步驟以 T06b 筆記為準。

## 結論

YouTube 把「外觀」（深色主題／淺色主題）存在 **`PREF` cookie** 的 **`f6`** 欄位：

| 項目 | 內容 |
|---|---|
| cookie | `PREF`，網域 `.youtube.com`，路徑 `/`，`Secure`，`SameSite=Lax`，不是 HttpOnly（頁面的 `document.cookie` 讀得到、寫得了），YouTube 設定的期限為 400 天 |
| 值的格式 | 以 `&` 分隔的 `key=value`，例如 `f5=30000&f6=408&hl=en&gl=US&tz=UTC`；值保持原始文字（例如 `tz=Asia%2FTaipei`） |
| `f6` | 十六進位旗標。**`0x400` = 深色主題**、**`0x80000` = 淺色主題**；兩者都沒有時沒有明確設定（依 YouTube 預設，帳號設為「使用裝置主題」時推測也是如此，見「未確認」） |
| 其他位元／欄位 | 屬於其他偏好（例如 `f5` 與自動播放有關），從 YouTube 選單切換主題時原樣保留 |

YouTube 在伺服器端依這個 cookie 輸出 `<html dark>` 與 `"userInterfaceTheme":"USER_INTERFACE_THEME_DARK"`；在頁面上用 `document.cookie` 寫入修改後的值、重新載入，YouTube 就以新的主題繪製整頁，也不會把 cookie 改回去。

### 實作（`utils/youtube/dom.ts`、`features/viewing/dark-mode.ts`）

1. 按下按鈕時依頁面**目前實際顯示**的主題（`<html dark>`）決定要改成淺色或深色（003 FR-13）。
2. 讀取 `PREF`，只改 `f6` 的 `0x400`／`0x80000` 兩個位元；其他位元、其他欄位與欄位順序原樣保留；原本沒有 `f6` 時加在最後（與 YouTube 選單的結果相同）。`f6` 不是十六進位時不修改（記錄在 console）。
3. 以與 YouTube 相同的屬性寫回：`PREF=<值>; domain=.youtube.com; path=/; max-age=34560000; secure; samesite=lax`。
4. 確認寫入成功後以 `location.replace()` 重新載入，觀看頁的網址加上 `t=<目前秒數>s`，保留目前影片與時間點（不到 1 秒時移除 `t`）。
5. 按鈕狀態只讀 `<html dark>`，以 `MutationObserver` 同步（使用者從 YouTube 選單切換時跟著更新）。不另外存任何設定；移除了舊的 `sync:darkMode` 與「5 秒內有使用者操作就記住」的判斷。
6. 不需要新權限：內容腳本本來就在 `*.youtube.com` 執行，`document.cookie` 讀寫的是頁面自己的 cookie。

## 證據

### 實測（主要依據）

所有實測都**沒有載入擴充功能**、只連到 YouTube，腳本與原始輸出放在 `spikes/T06a/`。

1. **YouTube 自己的選單寫入的值**（`probe-menu.mjs`，未登入，Chromium headless，裝置模擬為深色）：

   | 操作 | 之後的 `PREF` | `<html dark>` |
   |---|---|---|
   | 起始（沒有 `f6`） | `tz=UTC` | 否 |
   | 選「Dark theme」 | `tz=UTC&f6=400` | 是 |
   | 選「Light theme」 | `tz=UTC&f6=80000` | 否 |

   預先放入其他欄位時（`results-menu-preserve.txt`）：

   | 操作 | 之後的 `PREF` |
   |---|---|
   | 起始 | `f5=30000&f6=8&hl=en&gl=US&tz=UTC` |
   | 選「Dark theme」 | `f5=30000&f6=408&hl=en&gl=US&tz=UTC` |
   | 選「Light theme」 | `f5=30000&f6=80008&hl=en&gl=US&tz=UTC` |

   cookie 屬性：網域 `.youtube.com`、路徑 `/`、`Secure`、`SameSite=Lax`、非 HttpOnly、期限 400 天。

   未登入時，「Appearance」子選單只有「Dark theme」「Light theme」兩項，並註明「Setting applies to this browser only」；沒有「Use device theme」。裝置模擬為深色、`PREF` 沒有 `f6` 時，未登入的頁面仍是淺色。

2. **伺服器依 `f6` 輸出主題**（`probe-pref.sh`、`probe-theme-config.sh`，curl 取首頁）：沒有 `PREF`、`f6=80000`、`f6=8` 時 `<html>` 沒有 `dark`，`userInterfaceTheme` 為 `USER_INTERFACE_THEME_LIGHT`；`f6=400`、`480`、`80400`、`40000400` 時有 `dark`，為 `USER_INTERFACE_THEME_DARK`。

3. **以 `document.cookie` 寫入後重新載入**（`probe-write.mjs`，與擴充功能相同的寫法，`results-write.txt`）：深色→淺色、淺色→深色、未設定→深色三種情況，重新載入後主題都正確，`PREF` 只有一個（網域 `.youtube.com`），YouTube 只在最後補上 `tz`，沒有改回原本的主題。

4. 真實觀看頁在本環境的瀏覽器中被 YouTube 驗證頁擋住（已停止，沒有繞過），所以擴充功能本身的按鈕只在假觀看頁驗證；上面的實測使用 YouTube 首頁。

### 公開資料

- ResetEra 討論串（2022-03-07，#36）：使用者回報主題一直被改回淺色，在瀏覽器開發者工具中把 `PREF` 加上 `&app=desktop&f6=400&hl=en-US&gl=US&f5=30000` 後恢復深色。<https://www.resetera.com/threads/is-youtube-autoplay-constantly-turning-itself-back-on-for-anybody-else.560038/>
- Winaero（2019）：說明 YouTube 的介面偏好存在 `PREF` cookie 的 `f5`、`f6` 等欄位（該文以 `f6=8` 切換舊版版面）。<https://winaero.com/disable-new-youtube-layout-polymer-2019/>
- cooki.fi 的 `PREF` 說明：YouTube 用來「store user preferences」。<https://cooki.fi/cookies/pref>

搜尋結果中有第三方 YouTube 使用者腳本與擴充功能也談到這個 cookie；依 constitution 第 1 點，我**沒有開啟或閱讀**這些項目，結論只依上面的實測與一般文章。

## 未確認（寫入 QUESTIONS Q15）

- **登入帳號**：未登入時 YouTube 註明設定只套用在這個瀏覽器，也就是存在 cookie 中。登入帳號是否也同樣只看 `PREF`（而不是帳號端的設定），在本環境無法驗證。
- **「使用裝置主題」**：未登入時選單沒有這個選項；推測它對應「`f6` 沒有兩個主題旗標」，由頁面依 `prefers-color-scheme` 決定。這點無法在本環境驗證。按鈕在這個狀態下按下後會改為明確的深色或淺色（FR-13），不受影響。

## 給專案擁有者的手動驗證步驟

在 Zen（或 Firefox、Chrome）載入最新建置的擴充功能，打開任一影片頁（例如 <https://www.youtube.com/watch?v=jNQXAC9IVRw>），讓影片播放到約 1 分鐘後暫停。以下三種起始狀態各測一次（用 YouTube 右上角頭像或 ⋮ 選單 →「外觀」設定起始狀態）：

### A. 起始為「深色主題」（回報問題的情境）

1. 確認頁面為深色，工具列的深色模式按鈕為「開啟」（圓形背景）。
2. 按深色模式按鈕：頁面自動重新載入，**整頁變成淺色**，影片停在原本的時間點附近（網址帶 `t=…s`），按鈕變成「關閉」。
3. 打開 YouTube「外觀」選單：應顯示「淺色主題」。
4. 重新整理頁面、在 YouTube 內換到另一部影片、關閉並重新開啟瀏覽器：都維持淺色。
5. 再按一次按鈕：重新載入後回到深色，「外觀」選單顯示「深色主題」。

### B. 起始為「淺色主題」

1. 確認頁面為淺色、按鈕為「關閉」。
2. 按按鈕：重新載入後整頁深色、按鈕「開啟」、「外觀」選單顯示「深色主題」；重新整理後仍是深色。
3. 再按一次回到淺色。

### C. 起始為「使用裝置主題」

1. 作業系統設為深色模式；YouTube「外觀」選「使用裝置主題」。確認頁面為深色、按鈕為「開啟」。
2. 按按鈕：重新載入後整頁淺色，「外觀」選單改為「淺色主題」（不再跟隨裝置）。
3. 作業系統改為淺色模式、YouTube「外觀」選「使用裝置主題」，確認頁面為淺色、按鈕為「關閉」；按按鈕後整頁深色，「外觀」選單為「深色主題」。

### 共通

- 從 YouTube「外觀」選單切換主題時，按鈕狀態立即跟著改變（不需要重新載入）。
- 關閉工具列（✕ 或彈出視窗的「啟用」）時，YouTube 的主題不變。
- 其他 YouTube 偏好（例如語言、地區、自動播放）在切換前後不變。
- 若有任何一步不符合，請記下瀏覽器、是否登入、該步驟前後開發者工具中 `PREF` cookie 的值（Application／儲存空間 → Cookie → `https://www.youtube.com` → `PREF`）。
