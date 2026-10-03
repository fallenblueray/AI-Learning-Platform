# 創科學苑 / Innovate Academy

面向想用 AI 製作社群內容、整理工作流程及探索副業的上班族。以 ChatGPT 為主線，由自己的筆記、帖文、圖像及短片循序漸進，不保證收入、接案或固定完成時間。繁體中文介面；React / Vite 前端、Express / TypeScript / Sequelize 後端、MySQL 資料庫。

## 2026-10 社群 AI 改版

- 首頁、課程探索、橫向導覽及手機導航全面重設；原創 CSS 內容工作室插畫，不使用參考網站素材。
- 新課程規劃：`/?page=social-course`。雙欄課程簡介、黏頂章節導覽、桌面資訊卡、手機固定 CTA、可展開的 7 章 28 課、18 項規劃資源及真實 FAQ。
- **新課程尚未開放報名、定價或交付教材**。章節及資源明確標示規劃；沒有假播放器、評價、學員數或收入數字。HKD 為定價幣別提示，不改寫資料庫價格。
- 首課主題是自己的筆記 → 固定設定 → 三個 AI 草稿 → 人工選改 → 配圖 → 換材料重做。**新影片、粵語配音與繁中字幕的可審版已由父端完成，但網站端尚未取得可讀素材，未開放播放**；普通話版本僅為未來規劃。舊影片未接入。
- 原分享卡仍可從探索課程底部進入 `/?page=first-lesson`，是獨立公開練習，不是新課程已交付的首課；保留三色 1080 PNG、五步教材及自我檢查。
- 既有 LMS、MFA、點數、每帳戶每級一次整門課免費名額、不可變課程版本、私有字幕授權、測驗及證書保留。未改後端、收費規則或權限。
- 本輪驗收與媒體待辦見 [社群 AI 改版紀錄](docs/social-academy-redesign.md)。沒有部署、合併或啟用正式付款。

## 已實作

- 電郵註冊／驗證／密碼重設、短效登入 cookie、refresh token 輪替與重放撤銷、管理員 TOTP。
- Beginner / Advanced / Master 每人每級免費任選一課；免費名額不重設，已解鎖不重複扣點。
- 私有教材存取、影片續播、閱讀標記、跨裝置進度；**測驗達 80 分即可完成，不設觀看門檻，可不限次重考**。
- 付款點數批次及 FIFO 流水、Stripe Checkout、已驗證 webhook、整單退款凍結／扣回／失敗恢復、管理員對帳。
- 唯一完成證書、繁中 PDF、QR 驗證、遮罩姓名、撤銷與按新姓名重發。
- 課程草稿／不可變發布版本、題庫、MP4／PNG／JPEG／PDF 上載、點數套裝及營運後台。
- 持久化背景工作、失敗重試、稽核紀錄、版本化 SQL migrations、Docker、CI、DigitalOcean Terraform 設定及備份／還原腳本。

**這不是已驗收的正式收費服務。** 三門舊示範課是未公開、不可出售的測試教材。正式課程、售價及條款須由營運方確認；完成證書不代表正式 CPD 認證。既有部署設定保留，本次改版只在隔離本機環境驗證，不代表外部服務已驗收。

## 本機開始

需要 Node.js 22.12+（建議 24）、npm，以及 MySQL 8.4。已安裝 Docker 時：

```sh
npm ci
cp .env.example .env
docker compose up -d mysql
npm run db:migrate
npm run db:seed
npm run dev
```

另開終端執行背景工作：

```sh
npm run worker -w @pt/api
```

瀏覽 `http://localhost:5173`。APP_URL 與瀏覽器的來源必須一致；`localhost` 和 `127.0.0.1` 不能混用。`.env` 必須換上兩個不同的隨機金鑰，正式環境拒絕範例金鑰。開發環境未設定 Resend 時，郵件存於 `.local/mail/`，不會真的寄出；可開啟其中的 HTML 完成驗證／重設密碼。

建立管理員（請透過環境變數或機密管理器提供實際值）：

```sh
ADMIN_EMAIL=admin@example.org ADMIN_PASSWORD='<至少12字元>' npm run admin -w @pt/api
```

PowerShell 請使用 `$env:ADMIN_EMAIL` 及 `$env:ADMIN_PASSWORD`，再執行相同 npm 指令。首次登入後，開啟右上角帳戶設定並設定驗證器，後台才會解鎖。沒有預設管理員密碼。

建立受邀示範學員（需要 `DEMO_MODE=true`）：

```sh
DEMO_EMAIL=learner@example.org DEMO_PASSWORD='<至少12字元>' npm run demo-user -w @pt/api
```

一般註冊帳戶看不到未公開示範課。若要讓一般學員試讀，管理員須另建並發布正式課程；範例課本身禁止公開發布或付費購買。

此工作站已另設本機 MariaDB 11.4 相容測試環境，連接埠 3307，工具存於被 Git 忽略的 `.tools/`。這不代表已驗證正式 MySQL 雲端部署。受邀本機測試帳戶記錄於 `.local/test-accounts.json`；勿提交或用於正式環境。

在這部 Windows 工作站可使用 `./scripts/start-local.ps1` 重新啟動本機環境。測試管理員已完成 MFA 驗收；其開發用驗證器金鑰亦在同一帳戶檔案，請加入驗證器後登入。這些帳戶只供本機驗收。

## Stripe 與媒體

先設定 `sk_test_…`、測試 webhook secret，保持 `LIVE_PAYMENTS_ENABLED=false`。註冊 `/api/v1/webhooks/stripe` 接收 checkout 完成／到期、退款更新及爭議事件。管理員新增點數套裝後可測試結帳。

付款金額以**港幣分**保存；點數為整數。後端核對訂單 ID、session ID、金額、貨幣、付款狀態及模式。付款返回頁不入帳。發生網絡不確定的退款仍保持凍結，工作重試使用相同 Stripe idempotency key，避免重複退款。Stripe 控制台手動操作及爭議列為人工核對個案。

本機媒體與證書置於 `.local/storage/`；正式環境強制 S3，下載 URL 有效 5 分鐘，上載 URL 有效 15 分鐘。管理員可上載教材，學員沒有上載病人資料的入口。正式 CORS 僅允許平台域名。

## 測試

```sh
npm run typecheck
npm run build
npm test
DATABASE_URL=mysql://pt:password@127.0.0.1:3306/pt_academy_test npm run test:integration
```

整合測試只接受名稱以 `_test` 結尾的資料庫，先套用 migrations；不清空現有資料。涵蓋競爭解鎖、FIFO、退款、付款重送、未觀看即發證、重複發證、姓名重發、權限、CSRF、refresh 重放及 MFA。

瀏覽器測試需要運行 API、前端及 worker，並提供受邀示範學員：

```sh
E2E_EMAIL=learner@example.org E2E_PASSWORD='<密碼>' npm run test:e2e
```

預設使用已安裝的 Chrome；亦可 `npx playwright install chromium` 後調整設定使用 Playwright Chromium。瀏覽器測試只改動該測試學員的免費名額、進度及證書。

若使用已安裝的 Chromium，可設定 `E2E_EXECUTABLE_PATH=/usr/bin/chromium`。新增公開首課測試不需帳戶；原 LMS 與帳戶測試需要隔離受邀學員，並會暫時修改再還原其姓名。真實瀏覽器截圖可用相同環境變數執行 `node scripts/capture-academy.mjs`，輸出至 Git 忽略的 `.local/qa/`。請勿提供正式環境帳戶。

## 介面與文件

- OpenAPI：`GET /api/v1/openapi.json`。
- 健康檢查：`GET /health/live`、`GET /health/ready`。
- [後端架構與決策](docs/architecture.md)
- [雲端部署及營運手冊](docs/operations.md)
- [騰訊 Lighthouse、Cloudflare Tunnel、COS 與同機 MySQL 部署](docs/tencent-lighthouse-deployment.md)
- [本次驗收紀錄及未完成的外部驗收](docs/verification.md)
- [下一階段：雲端試行環境](docs/next-step.md)
- [創科學苑改版、首課媒體接入與本次驗收](docs/academy-redesign.md)

## 首版邊界

平台不接駁 AI 模型 API；首課提示由學員自行貼到選用的 AI 工具，不傳送分享卡輸入到伺服器。既有 CPD 欄位保留供相容性使用，後台僅可設定「未認可／申請中」，證書不授予正式學分。本次定位以一般 AI 實作為主，不核驗專業資格或自動申報 CPD。

沒有機構帳戶、訂閱制、雙語介面或自動部分退款。單機 API 是試行配置，不承諾高可用。證書、電郵、Stripe 與雲端營運的真實服務驗收均須於正式上線前完成。

字幕接入：影片單元可在課程草稿加入多語 WebVTT，隨發布版本保存；學員依原報讀版本取得五分鐘授權字幕，播放器支援選軌／關閉。私人首課審核維持關閉，正式素材未在本環境驗收。詳見 [版本字幕與權限決策](docs/media/versioned-captions.md)。
