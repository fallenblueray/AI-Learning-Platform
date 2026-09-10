# 驗收紀錄

日期：2026-09-10。測試環境：Windows、Node.js 24、MariaDB 11.4.9（以 MySQL dialect 存取）、Chrome。正式部署目標為 MySQL 8.4，CI 已設定 MySQL 服務；本次沒有執行遠端 CI。

## 已實測

- TypeScript 前後端 strict 型別檢查及 Vite production build 通過。
- 21 項單元／資料庫整合測試通過：免費名額競爭、20 個同時付費解鎖只扣一次、FIFO、餘額不足回復、影片零觀看即可完成、答案保護、重複發證、證書 PDF、撤銷、姓名重發、發布版本隔離、付款重送／金額不符、退款成功／失敗、舊退款通知隔離、跨帳戶權限、CSRF、MFA、refresh 重放、註冊／驗證／重設密碼、示範課隔離及已簽署 webhook fixture 防竄改。
- 20 位獨立學員同時進行解鎖、取得教材、測驗及錢包查詢，共 80 個已登入 HTTP 請求全部成功；本次在本機約 0.8 秒完成，不代表外部網絡或雲端效能承諾。
- Chrome 實際執行登入 → 選示範課 → 免費解鎖 → 直接測驗 → 合格；桌面及 390px 手機畫面無 JavaScript 頁面錯誤，無橫向溢出。
- 可重跑的 Playwright 桌面／手機流程通過，包含證書下載按鈕及手機導覽。另以 Chrome 驗證管理員首次 MFA 設定、課程草稿編輯及私有 PNG 圖片上載，無頁面錯誤。
- PDF 使用繁中字型產生，經 Poppler 轉圖檢查姓名、課程、日期、QR 及未認可學分說明。
- 本機邏輯備份還原至獨立資料庫，20 張表的筆數全部一致。工具輸出見 `.local/restore-report.json`；本次資料量很小，不能推論正式資料量的恢復時間。
- Terraform 已成功 init 及格式化，provider schema 驗證受本機憑證環境阻擋（legacy Common Name / SAN handshake error），因此尚未宣稱 validate 通過。未關閉 TLS 驗證，需在部署環境重新驗證。

## 尚未取得外部條件的驗收

- DigitalOcean 實際建立、Terraform apply、Docker image 建置及容器部署：本機無 Docker，亦未提供雲端帳戶。
- Stripe 真實 sandbox 結帳、已簽署外部 webhook、退款及爭議：未提供 Stripe 金鑰。整合測試驗證付款服務及交易邏輯，不代表已完成 Stripe 端到端驗收。
- Spaces 真實上下載／CORS／TLS，Resend 真實投遞／網域驗證，正式 HTTPS 域名。
- 雲端備份、告警設定及正式規模的 RPO / RTO，正式教材／定價／條款審核。

## 依賴檢查

初次 npm audit 發現 Sequelize 6 的 uuid 8 傳遞依賴有中度漏洞通報（GHSA-w5hq-g745-h8pq），與 v3/v5/v6 的外部 buffer 路徑相關。平台識別碼使用 Node crypto.randomUUID，Sequelize 內部只引用 v1/v4，未使用通報路徑。不可依 npm 建議降級至 Sequelize 3。正式發布仍需覆核最新依賴狀態及供應商修復；CI 會阻擋 high / critical。
