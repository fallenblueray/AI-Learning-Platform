# 創科學苑改版與交付

日期：2026-10-02。基準：`main` / `cd4f89d5770c983375b40afb6e9dc856f47b2929`。工作分支：`feat/innovate-academy-studio`。開始時工作樹乾淨；沒有適用的 AGENTS.md 或本機 `.agents/skills`。舊 migration Draft PR 不在本分支內。

真實 Chromium 畫面（公開頁、非合成稿）：[桌面首頁](screenshots/home-desktop.jpg)、[手機首頁](screenshots/home-mobile.jpg)、[桌面首課](screenshots/first-lesson-desktop.jpg)、[手機首課](screenshots/first-lesson-mobile.jpg)。更多帳戶流程的本機截圖保留在 `.local/qa/`。

## 方向與頁面

為零程式背景、想做小工具及探索創業的人而設。採海軍藍、奶白、薄荷綠及暖橙的實作工作室視覺；用原創 CSS/SVG 展示第一件作品，沒有使用收入數字、學員數、見證、CPD 認證或複製競爭產品的承諾。

| 入口                               | 用途                                                           |
| ---------------------------------- | -------------------------------------------------------------- |
| `/`、`?page=home`                  | 成果導向首頁、首課介紹、方法與常見問題                         |
| `?page=catalog`                    | 公開首課入口、後端真實課程搜尋／級別／工具篩選、詳情及原有解鎖 |
| `?page=first-lesson`               | 原創分享卡公開練習、影片接入位置、五步教材、完整提示、自我檢查 |
| `?page=learning`                   | 原 LMS 報讀與進度、教材、測驗                                  |
| `?page=certificates`               | 原有完成證書；等待背景製作時自動查詢完成狀態                   |
| `?page=wallet`、`profile`、`admin` | 原有點數、帳戶、MFA 與營運功能                                 |

首課練習不呼叫解鎖、進度或測驗寫入 API，不建立證書，不消耗任何免費名額。練習進度與文字只在頁面記憶體保存；重新整理會重設。這是新增公開教學體驗，沒有重新定價或改造 LMS。

## 媒體交接：尚未收到最終影片

父任務正在製作 Juno Dragon HD 粵語配音影片，字幕為繁體書面中文。本分支沒有產生或假填配音／影片 URL；`apps/web/src/firstLesson.ts` 的 `firstLessonMedia.video`、`captions` 目前均為 `null`。所有待製作狀態均明示。

接入時：

1. 交付審核過的 MP4（H.264 + AAC，建議 16:9）和時間軸一致的 UTF-8 WebVTT。依父任務最新要求，交付素材預設私人保存，不放入 `apps/web/public`、GitHub 或公開 bucket。存於私人 Library，工作副本置於 `/workspace/pt-course-dev/private-media/first-lesson/v1/`。交接 manifest 見 [範本](media/first-lesson-intake.example.json)。
2. 最終 MP4 與 VTT 的私人保存不等於網站公開授權。正式接入前，須選定原 LMS 的授權資產流程或另行明確授權的公開首課來源；未定前 `firstLessonMedia.video/captions` 保持 `null`。不得將 Library 下載 URL 寫入程式或 manifest。封面已有原創 SVG，可另替換。播放器使用 `controls`、`playsInline`、`preload="metadata"`、`track kind="captions" srclang="zh-Hant" default`，不自動播放。
3. 首頁 FAQ、首課卡片及播放器狀態由同一媒體設定自動切換；另外更新 README 與本文件的交付狀態。媒體錯誤會顯示可重試訊息並保留文字教材。
4. 用桌面／手機真實播放確認：音訊為審核聲線、片頭／片中／片尾字幕對時、暫停／跳轉／全螢幕、無聲播放可理解、重新載入／錯誤處理、HTTP MIME `video/mp4` 和 `text/vtt` 正確。
5. 目前 WebVTT 整合針對**公開首課**。原 LMS 的私人媒體仍採既有 `asset_key` 與授權短效 URL；未擴大儲存權限、未公開私人教材，也沒有把舊報讀綁到新媒體。正式課程若要新增私人字幕，需另增有版本控制的字幕欄位與授權資產流程。

本次未有最終影片，因此不能宣稱配音品質、正式字幕同步或正式影片播放已驗收。

## 已核實並保持的規則

- `CourseService.unlock` 在交易內鎖使用者；`FreePick` 仍限制每帳戶每級一次，可選整門課程，不是每級只試看一節。
- 重複解鎖返回原報讀；付費仍使用未凍結批次的 FIFO 點數。前端會提示已使用免費名額，真正授權仍由後端決定。
- 報讀固定 `version_id`。後續發布增加新 `course_versions`，不能把新首課或影片直接套到舊報讀；沒有改舊示範課或 migration。
- 測驗 80 分可完成，不設觀看門檻，可重考；證書、MFA、管理、退款與支付防重邏輯保留。
- 沒有部署、merge、啟用真付款、刪除資料、更改憑證、擴大外部權限。

## 本機驗收

環境：Node 24.19.0、npm 11.9.0、MySQL 8.4.11（`127.0.0.1:3307/pt_academy_test`）、系統 Chromium。所有帳戶及資料均屬隔離測試環境。

- GitHub [CI #15](https://github.com/fallenblueray/AI-Learning-Platform/actions/runs/37043891832) 在程式提交 `29014d13eb9a5c7e42ad3949e44bc462281345b2` 通過：安裝、型別、建置、單元、MySQL 整合及 `npm audit --audit-level=high`。本文件的後續提交只補上此驗收記錄。
- `npm run typecheck` 通過。
- `npm run build` 通過（API TypeScript 與 Vite production bundle）。
- `npm test`：5/5 通過。
- `npm run test:integration`：16/16 通過；涵蓋免費競爭、FIFO、退款、不可變版本、發證、20 位測試學員並行、MFA、refresh、CSRF、註冊重設及已簽署 Stripe fixture。
- `npm run test:e2e`：7/7 通過；公開首課、真實三色 PNG（檔案簽章、1080×1080、RGB）、空標題／長標題、作者選填、提示複製、五步練習、自我檢查、瀏覽器返回、鍵盤 modal、手機導航、載入失敗重試、LMS 學習／測驗／證書、閱讀進度、姓名及測試點數頁。
- 本機 production bundle 套用與 Caddy 相同的嚴格 CSP 後，三色即時預覽與 PNG 下載正常；沒有 CSP violation。未修改 CSP 或部署設定。
- 隔離測試管理員經真實瀏覽器完成首次 MFA 設定、開啟後台與課程編輯器；桌面／手機無頁面錯誤及溢出，未發布課程或更改外部權限。另有 3 張後台截圖。
- 24 張真實 Chromium 畫面涵蓋首頁、首課、列表、詳情、登入、我的學習、LMS 教材、測驗、證書與點數，桌面 1440×1000／手機 390×844，無頁面 JavaScript 錯誤。
- 另以全新學員重跑 LMS 流程通過，確認背景 PDF 完成後下載按鈕自行更新，並非使用舊 PDF。
- 排版檢查：320、390、768、1024、1440px 無橫向溢出。實際截圖由 `scripts/capture-academy.mjs` 產生，位於 `.local/qa/`；`capture-report.json` 記錄 viewport 與頁面錯誤。

驗收中曾遇到的問題與處理：

- 既有證書頁只載入一次，背景工作完成後仍顯示製作中：新增僅在等待未撤銷 PDF 時運作的輪詢，離開頁面即停止。
- 既有閱讀按鈕會在 API 失敗時先顯示儲存成功：成功通知移至伺服器成功回應後。
- 新增測試初版的「作者」定位同時選到 checklist，以及把 session refresh 視為教學寫入：改用 textbox 角色與課程／報讀／付款 API 範圍，實際功能未受影響。
- 截圖腳本 `networkidle` 等待在開發環境不穩定：改為等待實際頁面元素，沒有以合成畫面替代截圖。

## 未執行／仍待驗證

- 最終配音影片、正式字幕同步：素材未交付。
- 真實 Stripe sandbox 外部結帳、webhook、退款；實際 S3/COS、郵件投遞及正式域名：沒有使用外部服務憑證。通過的支付測試是隔離 fixture，不能當成商戶端驗收。
- 正式發布課程、定價、條款與首課轉入 LMS：沒有自行更動；公開練習與正式報讀分開。
- 實機 iOS Safari／Android、正式部署：本機 Chromium 不等同這些環境。

`.local/qa/` 含測試環境截圖、PNG 與記錄，不提交測試密碼或私人資料。既有 `docs/verification.md` 為歷史驗收，未把其結果冒充本次實測。
