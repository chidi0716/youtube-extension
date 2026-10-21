# 專案原則（Constitution）

所有規格、計畫與實作都必須遵守以下原則。規格與原則衝突時，以原則為準，並回頭修正規格。

## 1. Clean-room

- 本專案的實作只能依據 `specs/` 內的文件、本 repo 既有的程式碼，以及公開的官方文件與開源套件。
- 不得取得、閱讀或參考任何第三方 YouTube 擴充功能的原始碼、打包檔、CSS、圖示、翻譯檔或其他素材。
- 規格不清楚時，回報問題給規格方，不得自行去找其他擴充功能的做法來補。
- 流程與紀錄見 [`CLEANROOM.md`](./CLEANROOM.md)。

## 2. 隱私與網路

- 不收集任何使用資料，不送出任何分析或追蹤請求。
- 擴充功能只會連線到 YouTube 自家網域（`youtube.com`、`ytimg.com`、`googlevideo.com`）以及本機的原生橋接程式。
- 不使用任何第三方下載或轉檔服務。影片資料只在使用者的電腦上處理。

## 3. 不執行遠端程式碼

- 所有程式碼都打包在擴充功能內，不從 CDN 或任何網址載入腳本、樣式或 iframe。
- 不使用 `eval`、`new Function`、字串形式的 `setTimeout` 等動態執行程式碼的方式。
- 不注入 `<script>` 到 YouTube 頁面；需要存取頁面資料時，用 WXT 提供的 main world 內容腳本並限制在必要範圍。

## 4. 最小權限

- 內容腳本只在 `*.youtube.com` 執行。
- 只申請功能真正需要的權限，每項權限都要在計畫文件中寫明用途。
- 原生橋接程式只接受事先定義好的指令，不接受任意命令列參數或任意網址。

## 5. 支援範圍

- 瀏覽器：Chrome（Manifest V3）、Firefox 128 以上。Zen 等以 Firefox 為基礎的瀏覽器一律比照 Firefox 處理，不做特別調整；之後若發現問題再修正。
- 作業系統：macOS（Apple Silicon 與 Intel）、Windows 10/11（x64）。
- 不需要原生橋接程式的功能，在沒安裝橋接程式時也必須能正常使用。

## 6. 外觀與 YouTube 一致

- 顏色優先使用 YouTube 頁面本身的 CSS 變數（例如 `--yt-spec-base-background`、`--yt-spec-text-primary`），讓深色／淺色主題自動跟隨 YouTube。
- 字型沿用 YouTube 頁面字型，不另外打包字型檔。
- 圖示使用 Google Material Symbols（Apache 2.0），以 SVG 形式打包進擴充功能。
- 擴充功能的樣式不得影響 YouTube 原本的版面；使用 Shadow DOM 或有前綴的 class 隔離。

## 7. 面對 YouTube 改版

- 所有依賴 YouTube 頁面結構的選擇器與邏輯集中在單一模組，方便改版時修正。
- 找不到預期的元素時，安靜地放棄該功能並在 console 記錄，不得讓 YouTube 頁面出錯或卡住。
- 下載相關的解析一律交給 yt-dlp，擴充功能本身不解析影片串流網址。

## 8. 語言

- 介面提供繁體中文與英文，依瀏覽器語言自動選擇，預設英文。
- 規格文件（`specs/`）以繁體中文撰寫。
- README 以英文為主：`README.md` 為英文版，`README.zh-TW.md` 為繁體中文版；兩份檔案開頭都有語言切換連結（`**English** | [繁體中文](./README.zh-TW.md)`），內容保持同步。

## 9. 品質

- `npm run compile`（TypeScript 型別檢查）必須通過。
- 不依賴 DOM 的邏輯（例如畫質標籤、時間格式轉換、指令驗證）要有單元測試。
- 原生橋接程式的通訊協定要有測試，至少涵蓋正常指令、錯誤指令與非法參數。
- Chrome 與 Firefox 兩個版本都要能成功打包。

## 10. 版本控制

- commit 訊息以英文為主、中文為輔：第一行是英文摘要，空一行後以繁體中文補充說明。
- commit 訊息不加入 AI 署名、Co-Authored-By 或工作階段連結。

範例：

```
T03 Add toolbar shell and panel manager

新增工具列外框與面板管理：Shadow DOM 掛載、單一面板、Esc 與點外面收起、釘選。
```
