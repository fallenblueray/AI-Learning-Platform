# 後端架構及附件調整

採用模組化單體。前端只透過 `/api/v1` 存取後端，不可直接讀取資料庫、題目答案或私有物件儲存。

## 請求流程

Route 綁定 HTTP 路徑及權限 → Controller 擷取參數 → Service 執行業務與交易 → Sequelize Model。DTO 使用 class-validator / class-transformer；複雜課程草稿使用 Zod。TypeDI 管理 Service，統一 HttpException 及 Winston 日誌。

認證、課程、付款、評核、儲存與背景工作分成獨立 Service。資料模型集中於 models/index.ts 作為首版明確的型別與欄位映射，未照搬原附件「一表一檔」；原附件的遊戲、同步、IAP、WebSocket 及 RabbitMQ 已移除。後續可在保持輸出型別相同下拆檔。

## 一致性

- 所有錢包、免費名額、解鎖、評核及退款，先鎖定使用者資料列，再鎖業務資料列。`atomic` 明確建立 transaction、commit / rollback；外部 Stripe、郵件及檔案操作不在資料庫鎖內。
- `(user_id, level)` 免費名額唯一；`(user_id, course_id)` 報讀唯一；`order_id` 點數批次唯一；Stripe 事件以主鍵防止重送；點數批次具有非負剩餘量限制。
- FIFO 依 `created_at, id` 排序，退款凍結批次不可消費。流水只追加，不直接修改既有交易。
- 完成評核鎖定使用者後，檢查 enrollment.completed_at。只有首次完成建立證書；重考不恢復已撤銷證書。
- 重發證書先撤銷舊證書，再更新 enrollment 的目前證書 ID。姓名、課程、發證者、完成時間及 CPD 狀態保留證書快照。
- 課程每次發布新增 course_versions；報讀固定 version_id。公開列表使用已發布內容，編輯草稿不修改既有報讀。已發布課程的級別與工具分類不能變動。

## 安全與工作

密碼使用 bcrypt；輸入限制為 12 字元以上、72 bytes 以內。Access cookie 15 分鐘，refresh cookie 7 日、僅以 hash 儲存；重放撤銷其 family 及帳戶舊 access token。所有修改操作需同源 Origin，webhook 改以 Stripe 簽章驗證原始內容。cookie 為 HttpOnly、SameSite=Strict，HTTPS 時 Secure。

管理員登入使用 TOTP，已使用時間窗不得重放；TOTP secret 用 AES-256-GCM 加密。無線上管理員 MFA 重設入口，遺失驗證器須由有伺服器權限的營運人員按已核實身份的維運流程處理。

outbox 與業務紀錄同交易寫入。worker 以 `FOR UPDATE SKIP LOCKED` 取得工作，使用 lease token 防止舊 worker 覆寫新工作。失聯工作 10 分鐘後可回收；失敗指數退避，8 次後交給管理員重試。PDF 寫入固定物件 key，完成後才排程通知。郵件用 Resend idempotency key；外部服務 idempotency 保留時間不代表無限期 exactly-once。

## 資料庫演進

`migrations/001_initial.sql` 是固定快照，不在啟動時執行 `sync`。Runner 以 MySQL advisory lock 防止同時部署，記錄 SHA-256；套用過的 migration 不得修改。新欄位透過新增 SQL 檔案演進。MySQL DDL 可能自行 commit；發布須先備份，採新增相容欄位的 expand / contract 方式。失敗部署先確認 schema 狀態，再重試或回復容器，不自動刪表。

## 重要首版取捨

續讀不是出席認證，不能據此宣稱符合日後 CPD 要求。首版不公開正式學分狀態。媒體採原始 MP4 及 signed URL，沒有自動轉碼、DRM 或逐片段簽章；長影片 URL 到期後需重新取得連結。PDF 只供學員下載，公開驗證遮罩姓名，已簽出的下載連結可能在 5 分鐘內仍有效。
