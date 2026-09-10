# 雲端試行與營運

## 尚需營運方提供

DigitalOcean 帳戶與 SSH key、域名與 DNS 控制權、Spaces 存取憑證、已驗證寄件域名及 Resend 金鑰、Stripe 香港商戶與測試／正式金鑰、發證機構正式名稱、正式教材、定價及公開條款。不得把金鑰放進 Git 或聊天紀錄。

主資料庫及媒體預設在新加坡；Stripe、Resend 的處理位置與保存安排需另外記錄。公開註冊與收費前，營運方須提供私隱、聯絡、保留／刪除及退款條款。示範內容不得對外出售。

## 配置與預算

試行以單台 2 vCPU / 4GB Droplet、單節點託管 MySQL、Spaces 私有媒體與備份 bucket、Resend 交易郵件為起點。預算每月 HK$500–1,500，不含交易費、域名、教材製作及營運人力；建立資源前使用供應商當日报價核算，保留影片流量與備份增長空間。此配置不是高可用架構。

`deploy/infra` 提供 Terraform：新加坡 VPC、主機、限制 SSH 的防火牆、MySQL、僅允許應用主機的 DB firewall、私有媒體與備份 bucket、指定平台來源的 CORS。帳戶 token 與 Spaces 憑證以供應商環境變數注入。

```sh
cd deploy/infra
terraform init
terraform plan -var-file=example.tfvars -out=trial.tfplan
terraform apply trial.tfplan
```

先把範例值改為真實域名、SSH key ID、管理員固定 IP 及唯一 bucket 名稱；範例 IP 不可作實際設定。Terraform state 含資料庫密碼，需存於受限制且加密的 state backend。上述命令會建立計費資源，本次未執行 apply。

取得 DB 私有連線參數後，設定 `pt_app` 只可存取平台資料庫；migration 可另用部署帳戶。設定 DB CA：把 DigitalOcean CA 檔掛入 API、worker，設定 `NODE_EXTRA_CA_CERTS=/run/secrets/database-ca.crt`；`DB_SSL=true` 不可關閉驗證。DNS A 紀錄指向主機 IP。

## 建置與上線

在 CI 或可用 Docker 的建置機：

```sh
docker build --target api -t YOUR_REGISTRY/pt-api:COMMIT_SHA .
docker build --target web -t YOUR_REGISTRY/pt-web:COMMIT_SHA .
docker push YOUR_REGISTRY/pt-api:COMMIT_SHA
docker push YOUR_REGISTRY/pt-web:COMMIT_SHA
```

把 `deploy/` 複製到主機 `/opt/pt-academy/`。建立權限 600 的 `.env.production`，填入 `.env.example` 對應值；必須使用 HTTPS、DB TLS、S3、Resend、正式發證者及隨機金鑰。compose 會提供證書字型路徑。管理員與 worker 使用同一套加密及 JWT 金鑰。

設定 `API_IMAGE`、`WEB_IMAGE` 為不可變版本標籤；`SITE_ADDRESS` 為域名、`ACME_EMAIL` 為憑證聯絡電郵、`S3_ORIGIN` 為 `https://BUCKET.sgp1.digitaloceanspaces.com`。

```sh
bash deploy.sh
docker compose -f compose.production.yaml run --rm api node dist/database/seed.js
```

先用封閉試行及 Stripe test mode。正式上線前核對域名、郵件寄送／SPF／DKIM、實際 MP4 圖片 PDF 上下載、跨裝置登入、付款、退款、webhook 重送、證書及權限。管理員必須完成 MFA。關閉 `DEMO_MODE`，發布正式課程及價格，完成商戶和條款驗收後才設定 `LIVE_PAYMENTS_ENABLED=true` 及 live 金鑰／對應 webhook secret。

部署腳本先拉取已測試映像及套用相容 migrations，再更新容器並等待健康檢查。單台主機更新可能短暫中斷服務，不宣稱零停機。回復時改回前一組映像標籤並重新 `up -d --wait`；schema 必須保持向後相容。破壞性 migration 需另訂還原程序。

## Stripe 驗收

訂閱 checkout.session.completed、checkout.session.async_payment_succeeded、checkout.session.expired、refund.created、refund.updated、refund.failed、charge.refunded、charge.dispute.created。

測試：付款成功、取消、到期、重送同一事件、不同事件對應同一訂單、付款後尚未收到 webhook、已用點數的退款拒絕、未用點數退款、退款失敗、退款期間購課、控制台手動退款及爭議。

Stripe API 不確定／超時時不解除退款凍結。背景工作使用固定 idempotency key 重試；failed 工作在後台有重試入口。退款狀態長時間不變時，管理員使用「重新對帳」及 Stripe 控制台比對。若工作失敗需要新一輪退款，必須確認前一次的 Stripe 狀態，避免重複退還；例外處理須保留 audit 記錄。

## 備份與還原

使用託管資料庫備份，加上每日邏輯備份至獨立、私有 Spaces bucket。將 MySQL client 設定放在僅備份帳戶可讀的檔案，備份用 Spaces key 不與應用媒體 key 共用。另為每日備份設定保留政策（試行 30 日）；Terraform 的版本化物件不會自動刪除舊版本，需在正式帳戶設定 lifecycle。

```sh
MYSQL_CONFIG=/etc/pt-academy/backup.cnf \
BACKUP_BUCKET=YOUR_BACKUP_BUCKET \
BACKUP_ENDPOINT=https://sgp1.digitaloceanspaces.com \
bash backup.sh
```

排程每日本地時間 03:00 執行，上次成功備份超過 24 小時需告警。定期下載備份並使用 `restore.sh` 還原至全新、名稱以 `_restore` 結尾的獨立資料庫，不直接覆蓋正式庫。比對每張資料表的筆數，再以隔離應用執行登入、解鎖、測驗及證書檢查。還原測試環境不得接上正式 worker、Resend 或 Stripe 金鑰。

目標 RPO ≤24 小時、RTO ≤8 小時；本次僅完成本機相容資料庫的備份／還原比對，尚未在 DigitalOcean 實測此恢復目標。

## 監測及例行工作

- 每分鐘檢查 HTTPS `/health/ready`，連續三次失敗通知營運人員。
- 每五分鐘檢查後台 failed jobs、open review cases、超過一小時的 pending orders / refunds；人工對帳，不把 pending 訂單直接當已付款。
- 啟用 Droplet CPU／RAM／磁碟告警，以及月費用預算 80% 提醒；逐月檢查媒體流量與備份用量。
- 月度還原演練；每次部署前備份，記錄映像標籤、migration 與驗收結果。
- 定期清除已完成背景工作、過期 token／session；財務流水、證書及稽核資料保留政策須先由營運方確定，不自動刪除。

## 本機暫用工具

工作站沒有 Docker／MySQL，這次以 `.tools` 內的 MariaDB 11.4 在 127.0.0.1:3307 執行相容測試。正式 CI 使用 MySQL 8.4。這些工具、測試帳戶、SQL 備份與畫面擷圖均在 Git 忽略目錄，不屬於正式部署映像。
