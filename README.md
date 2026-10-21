# youtube-extension

一個 YouTube 瀏覽器擴充功能，使用 [WXT](https://wxt.dev) + TypeScript 開發，同時支援 Chrome（Manifest V3）與 Firefox。

## 開發

```bash
npm install
npm run dev           # Chrome，會自動開啟瀏覽器並熱重載
npm run dev:firefox   # Firefox
```

## 建置與打包

```bash
npm run build           # 輸出到 .output/chrome-mv3
npm run build:firefox   # 輸出到 .output/firefox-mv2
npm run zip             # 打包成可上架的 zip
npm run zip:firefox
```

## 手動載入

- **Chrome**：開啟 `chrome://extensions`，打開「開發人員模式」，點「載入未封裝項目」，選擇 `.output/chrome-mv3`。
- **Firefox**：開啟 `about:debugging#/runtime/this-firefox`，點「載入臨時附加元件」，選擇 `.output/firefox-mv2/manifest.json`。

## 專案結構

```
entrypoints/
  background.ts   背景腳本
  content.ts      注入 YouTube 頁面的內容腳本
  popup/          點擊工具列圖示時的彈出視窗
utils/
  storage.ts      共用設定（自動匯入）
public/icon/      擴充功能圖示
```
