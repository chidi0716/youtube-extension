import './style.css';
import { applyI18n, t } from '@/utils/i18n';

// 設定頁的佔位：說明面板的「開啟設定頁」需要一個目的地（001 FR-17）。
// 下載資料夾、檔名格式、連線狀態等設定在 T23 加入。
applyI18n(document);
document.title = t('optionsTitle');
