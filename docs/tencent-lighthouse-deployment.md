# 騰訊 Lighthouse 試行部署

## 既定架構

`innovateacademy.net` 與 `www.innovateacademy.net` 經 Cloudflare Tunnel 進入同機 Caddy；API、worker 及 MySQL 只在 Docker 網絡通訊。MySQL 不發布主機連接埠。教材及證書存於一個私人 Tencent COS bucket，資料庫每日備份存於另一個私人 bucket。

Cloudflare 已建立遠端管理的 `innovate-academy-production` Tunnel，路由指向 `http://web:80`，並啟用 Always Use HTTPS。DNS 會在 VPS connector 健康後才發布，避免未完成部署期間出現 Tunnel 錯誤頁。

## 主機要求

- Ubuntu 22.04 或 24.04 LTS x86_64；2 vCPU、4 GB RAM 可供 50–100 人試行。
- Lighthouse 防火牆只開管理用 SSH 來源；毋須開 80、443、3306。
- 出站須允許 TCP 443，以及 TCP／UDP 7844 供 Cloudflare Tunnel 使用。
- 執行 `sudo deploy/tencent/bootstrap-ubuntu.sh` 安裝 Docker、Compose、AWS CLI、自動安全更新及 2 GB swap。

## COS 設定

在新加坡區建立兩個私人 bucket：一個保存 `media/` 及 `certificates/`，另一個保存 `mysql/daily/`。名稱須包含騰訊 AppID。禁止公共讀取；API 透過五分鐘簽署網址下載，管理員透過十五分鐘簽署網址上載。

建立兩個 CAM 子使用者／API key：

1. 執行時 key 只可對應用 bucket 列出及讀寫物件，包含 multipart upload 所需操作。
2. 備份 key 只可對備份 bucket 的 `mysql/daily/*` 列出、上載及讀取；還原演練需要讀取權限。不要給 bucket 刪除、ACL、政策或其他雲端產品權限。

可從 `cos-runtime-policy.example.json` 及 `cos-backup-policy.example.json` 建立自訂 CAM 政策，將 `REPLACE_APPID` 及 bucket 名稱換成實際值。應用 key 不含刪除權限，避免程式錯誤刪除教材或證書；資料保留由 COS 生命週期處理。

建議在備份 bucket 啟用版本控制及生命週期：每日備份保留 35 日，另保留每月一份 12 個月。兩個 bucket 均使用服務端 AES-256 加密。

COS XML API 設定為：

```text
S3_ENDPOINT=https://cos.ap-singapore.myqcloud.com
S3_REGION=ap-singapore
S3_CSP_ORIGIN=https://*.cos.ap-singapore.myqcloud.com
```

應用 bucket 另設 CORS：只允許 `https://innovateacademy.net`，methods 為 `GET`、`HEAD`、`PUT`，allowed headers 至少包含 `Content-Type`、`x-amz-*`，expose header 為 `ETag`，max age 為 600 秒。此設定供管理員直接上載私人教材；bucket 本身仍保持 private。

## 首次部署

在 VPS 將 repository 放於 `/opt/innovate-academy`。複製兩個範本並以 root-only 權限保存：

```sh
cd /opt/innovate-academy/deploy/tencent
cp .env.production.example .env.production
cp .env.backup.example .env.backup
chmod 600 .env.production .env.backup
```

以密碼產生器建立互不相同的 MySQL、JWT 與加密金鑰。`DATABASE_URL` 內密碼須作 URL encoding；最簡單做法是產生只含英數的長密碼。不要把實際機密提交 Git 或貼到對話。

完成環境檔後執行：

```sh
sudo ./deploy.sh
sudo ./install-backup-timer.sh
```

`deploy.sh` 會建置容器、先執行 migration、啟動服務，再從 web 容器驗證 API readiness。備份安裝程序會立即執行一次並啟用每日香港時間 03:20 的 timer。

建立首位管理員時透過一次性環境變數傳入帳戶資料，執行後清除 shell history 或使用 root-only 暫存檔：

```sh
docker compose --env-file .env.production run --rm -e ADMIN_EMAIL -e ADMIN_PASSWORD api node dist/database/create-admin.js
```

## 上線切換

確認 `docker compose ps` 全部正常、Tunnel 顯示 healthy，才把 apex 及 `www` CNAME 指向 Tunnel。之後驗證：

- `https://innovateacademy.net/health/ready`
- 註冊、驗證郵件、登入及重設密碼
- 私人教材簽署 URL、測驗、PDF 證書下載及 QR 驗證
- 每日備份存在、checksum 正確，並還原至 `pt_academy_restore`

正式試行仍保持 `DEMO_MODE=true`、`LIVE_PAYMENTS_ENABLED=false`。Stripe 測試流程驗收後才考慮正式付款。

## 更新與回復

更新前先建立備份並記下 Git commit：

```sh
sudo systemctl start innovate-academy-backup.service
git fetch origin
git checkout <已通過 CI 的 commit>
cd deploy/tencent && sudo ./deploy.sh
```

若新版本失敗，checkout 上一個已驗證 commit 並再次執行 `deploy.sh`。資料庫 migration 目前只允許向前；涉及破壞性 schema 變更前必須另備回復 migration。

還原演練：

```sh
BACKUP_OBJECT=mysql/daily/pt-academy-YYYY-MM-DDTHH-MM-SSZ.sql.gz sudo -E ./restore-from-cos.sh
```

腳本只還原到 `pt_academy_restore`，避免意外覆寫正式資料。
