# 創科學苑 / Innovate Academy · 香港醫護 AI 學習平台

供香港物理治療師學習使用 AI 的繁體中文 MVP。React / Vite 前端、Express / TypeScript / Sequelize 後端、MySQL 資料庫；課程影片、圖片、講義及證書使用私有物件儲存。

## 已實作

- 電郵註冊／驗證／密碼重設、短效登入 cookie、refresh token 輪替與重放撤銷、管理員 TOTP。
- Beginner / Advanced / Master 每人每級免費任選一課；免費名額不重設，已解鎖不重複扣點。
- 私有教材存取、影片續播、閱讀標記、跨裝置進度；**測驗達 80 分即可完成，不設觀看門檻，可不限次重考**。
- 付款點數批次及 FIFO 流水、Stripe Checkout、已驗證 webhook、整單退款凍結／扣回／失敗恢復、管理員對帳。
- 唯一完成證書、繁中 PDF、QR 驗證、遮罩姓名、撤銷與按新姓名重發。
- 課程草稿／不可變發布版本、題庫、MP4／PNG／JPEG／PDF 上載、點數套裝及營運後台。
- 持久化背景工作、失敗重試、稽核紀錄、版本化 SQL migrations、Docker、CI、DigitalOcean Terraform 設定及備份／還原腳本。

**這不是已上線收費服務。** 正式雲端帳戶、域名、商戶及郵件憑證尚未提供，因此外部服務尚未實際啟用。三門示範課是未公開、不可出售的測試教材；正式課程、售價、條款及 CPD 認可須由營運方提供。

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

## 介面與文件

- OpenAPI：`GET /api/v1/openapi.json`。
- 健康檢查：`GET /health/live`、`GET /health/ready`。
- [後端架構與決策](docs/architecture.md)
- [雲端部署及營運手冊](docs/operations.md)
- [本次驗收紀錄及未完成的外部驗收](docs/verification.md)
- [下一階段：雲端試行環境](docs/next-step.md)

## 首版邊界

平台不接駁 AI 模型 API，不核驗 PT 執業資格，不提供正式課程內容或自動 CPD 申報。CPD 資料保留獨立欄位；首版後台僅可設定「未認可／申請中」，證書不授予正式學分。認可後須按核准要求另行實作及驗收，不會追溯改寫舊證書。

沒有機構帳戶、訂閱制、雙語介面或自動部分退款。單機 API 是試行配置，不承諾高可用。證書、電郵、Stripe 與雲端營運的真實服務驗收均須於正式上線前完成。
