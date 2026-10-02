# Codex Cloud 日常開發與全新工作驗證

## 環境與追溯

日常開發使用已發布的私密 saved cloud 環境 **PT course development**，儲存庫為 [fallenblueray/AI-Learning-Platform](https://github.com/fallenblueray/AI-Learning-Platform)。

- 環境設定 ID：`2e6ff5e6-62e2-45ef-b178-4a557e51a4f8~asenvcfg_5114fa47a758819189a68548de1f2401`。
- [官方環境管理頁](https://chatgpt.com/settings/codex-cloud)。名稱、私密及發布成功狀態由設定工作核實後交接；本驗證工作未重新讀取設定後台。
- 本次全新雲端工作 ID：`01a0fbbf-6009-77b8-a586-374a58b6f0e9`（由 runtime 的 `CODEX_THREAD_ID` 與 `CODEX_SESSION_ID` 核對）。未取得可靠的工作 URL，因此不推測連結。
- 本次 runtime environment ID：`ccarenv_b64_Y2NhcmVudl80ZDQ4ZWI1ZmM4OTQ4MTkxYjc3MzAzNDJjZjU5MmY3ZA`（啟動工具與 `CODEX_ENVIRONMENT_ID` 一致）。設定 ID 與 runtime ID 是不同識別碼。
- 驗證日期：2026-10-02 UTC；起始 checkout 與遠端 main 均為 [`cd4f89d5770c983375b40afb6e9dc856f47b2929`](https://github.com/fallenblueray/AI-Learning-Platform/commit/cd4f89d5770c983375b40afb6e9dc856f47b2929)。

所有本次命令都在所選雲端環境的 `/workspace/AI-Learning-Platform` 執行，沒有呼叫本機 executor、複製本機工具、憑證或資料庫。雲端工作可獨立 checkout、安裝、型別檢查與建置，但本次資料庫還原尚未成功，不能把「已發布環境」等同於「全新工作全部驗證通過」。

後續第二次 fresh 工作已驗證資產還原及手動啟動後的完整測試，詳見下方追加紀錄；上述描述與首次實測表保留為首次工作的歷史證據。整體遷移仍未完成：自動啟動未驗收，GitHub 推送／PR 仍受權限 403 阻擋。

## 每次工作的流程

1. 選擇上述環境建立新工作，核對 `pwd`、`git status --short --branch`、`git remote -v`、`git rev-parse HEAD`、`git ls-remote --heads origin`。先查現有分支及 PR，避免重複工作。
2. 閱讀 README、適用的 AGENTS.md、`.agents/skills`、架構及驗證文件、`.github/workflows/ci.yml`。本次儲存庫及工作區未找到 AGENTS.md，工作區 `.agents` 為空；未發現額外專案技能。
3. **每個新任務必須先手動執行 `bash /workspace/pt-course-dev/mysql-start.sh`，再驗證 readiness**。確認 MySQL 為 8.4.x、資料庫為 `pt_academy_test`、主機綁定 `127.0.0.1:3307`，並以該隔離測試庫設定 `DATABASE_URL`；啟動失敗或尚未 ready 時不可執行 integration。不能假定容器會自動啟動。
4. 在新分支修改；保留既有歷史文件，提交前檢查 `git diff --check`、變更範圍與敏感資訊。不得提交 `.env`、`.local`、測試帳戶、資料庫備份或個人路徑。
5. 執行下列驗證，記錄每項退出碼、失敗原因及未跑項目。完成後推送分支、建立 draft PR，核對遠端 SHA 與該 SHA 的 CI；不自行合併 main。

## Node、依賴與隔離資料庫

**現行操作以保存的 `/workspace/pt-course-dev/mysql-start.sh` 及 loopback 3307 為準。下列 `docker run`、3306 連線與 `npm ci` 是首次驗證的歷史操作，不是第二次已還原環境的啟動指令；不要照抄 3306 設定覆蓋現行測試設定。**

`package.json` 要求 Node `>=22.12`；環境 setup 應選 Node **24**，與 CI `actions/setup-node` 一致。本次實際為 Node **24.19.0**、npm **11.9.0**。新工作開始時沒有 `node_modules`，以下命令成功安裝 354 個套件，未改動 lockfile：

```sh
npm ci --cache /tmp/pt-npm-cache --no-audit
```

資料庫只能使用本工作新建的 MySQL **8.4**，名稱為 `pt_academy_test`，綁定 loopback。以下為可重跑的建立方式；若已有同名容器或佔用連接埠，先確認擁有者與用途，不能刪除他人的資源。範例值只供隔離測試：

```sh
docker run -d --name pt-cloud-fresh-mysql \
  --label purpose=pt-cloud-fresh-validation \
  -e MYSQL_ROOT_PASSWORD=cloud_test_root_only \
  -e MYSQL_DATABASE=pt_academy_test \
  -e MYSQL_USER=pt -e MYSQL_PASSWORD=pt_test \
  -p 127.0.0.1:3306:3306 mysql:8.4
```

映像成功下載後，等待 `docker exec pt-cloud-fresh-mysql mysqladmin ping --silent` 成功，再以容器內 MySQL 查詢 `SELECT VERSION(), DATABASE();` 核對版本與測試庫。普通 `compose.yaml` 建立的是 `pt_academy`，不能直接作為整合測試資料庫。測試本身檢查名稱以 `_test` 結尾並套用 migrations；仍必須人工確認 host 與用途，不能只依賴名稱保護。

不要匯入正式 `.env`。在乾淨 shell 明確設定測試值，付款、郵件與物件儲存憑證保持空白：

```sh
export NODE_ENV=test APP_URL=http://localhost:5173
export DATABASE_URL=mysql://pt:pt_test@127.0.0.1:3306/pt_academy_test
export JWT_SECRET=cloud-test-only-jwt-secret-minimum-32-characters
export ENCRYPTION_KEY=cloud-test-only-encryption-key-minimum-32-characters
export DEMO_MODE=true LIVE_PAYMENTS_ENABLED=false DB_SSL=false
export STORAGE_DRIVER=local LOCAL_STORAGE_PATH=/tmp/pt-cloud-test-storage
export STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= RESEND_API_KEY=
export S3_ACCESS_KEY= S3_SECRET_KEY=
npm run typecheck
npm run build
npm test
npm run test:integration
npm audit --audit-level=high
```

## 首次全新工作實測結果

| 項目             | 實際結果                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| checkout／remote | 乾淨 checkout；origin 為上述 GitHub 儲存庫，起始 main SHA 一致                                       |
| 依賴             | `npm ci` 退出 0，354 個套件；lockfile 未修改                                                         |
| typecheck        | 退出 0，API／web 均通過                                                                              |
| build            | 退出 0；Vite 有既存大於 500 kB 的 chunk 警告                                                         |
| unit             | 退出 0；5 通過、0 失敗、0 跳過                                                                       |
| integration      | **退出 1；16 失敗、0 通過**。共同 migration 前置步驟遭 `ECONNREFUSED 127.0.0.1:3306`，業務測試未完成 |
| audit 高風險門檻 | 退出 0；6 項 moderate，沒有 high／critical；不等於零漏洞                                             |

本次 Docker 28.4.0 可用，但沒有預載映像或運行中的容器。`mysql:8.4` 下載遇 Docker Hub 匿名 pull rate limit；ECR 公開鏡像與 Oracle 官方 registry 遭 Forbidden，MySQL 官方下載網站遭網絡代理 HTTP 403。未使用正式憑證或擴大權限處理限制。需讓 saved environment 的 setup 能可靠取得／快取 MySQL 8.4，並在新任務啟動隔離 DB 後重新驗證；本次不能確認 MySQL 還原成功。先前 onboarding 的 unit 5／integration 16 通過，不能替代本次結果。

Audit 的 moderate 涉及 ip-address／express-rate-limit、moment／moment-timezone／sequelize，以及 uuid；本次沒有執行會改寫依賴的 `npm audit fix`。歷史驗收文件保留原日期與內容。

未執行：瀏覽器 E2E、正式／外部 Stripe、郵件、COS／S3、部署、Terraform、正式資料庫操作及備份還原。整合測試只嘗試連接隔離 loopback 測試庫，沒有連接正式資料庫。

## 第二次 fresh 工作：資產還原成功，須手動啟動

證據工作 ID：`01a0fbce-00ff-7150-902a-4dede2c0d0ff`。以下結果由 parent 交接該獨立雲端工作的實測紀錄；不是在本文件編輯工作重新執行，也不是引用先前 onboarding 的通過結果。未取得可靠工作 URL，因此只記錄 ID。

最新環境的映像 tar 與 scripts 成功跨 snapshot 還原，依賴亦已還原，`npm ls` 退出 0；該工作**未重跑 `npm ci`**。初始 MySQL container 狀態為 **Exited 255**，所以自動 startup 仍未驗收。

手動執行保存的啟動腳本後，隔離 MySQL **8.4.11**、`pt_academy_test` 及 loopback **127.0.0.1:3307** 均正常：

```sh
bash /workspace/pt-course-dev/mysql-start.sh
```

每個新任務都必須執行此步驟，再確認容器運行、MySQL readiness，以及使用測試連線查詢 `SELECT VERSION(), DATABASE();` 的結果。只有版本為 8.4.x、資料庫為 `pt_academy_test` 且連線使用 loopback 3307 時，才執行 integration。腳本成功返回不能替代 readiness 與連線目標核對；測試設定仍不得使用正式 DB 或真實服務 secrets。

| 項目               | 第二次 fresh 工作結果                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| 資產／依賴還原     | tar／scripts 成功跨 snapshot 還原；`npm ls` 退出 0，未重跑 `npm ci`               |
| 初始容器／自動啟動 | Exited 255；自動 startup 未驗收                                                   |
| 手動啟動與 DB      | 保存的 `mysql-start.sh` 啟動成功；MySQL 8.4.11、`pt_academy_test`、127.0.0.1:3307 |
| typecheck／build   | 均通過；仍有 bundle 大於 500 kB 警告                                              |
| unit               | 5 項通過                                                                          |
| integration        | 16 項通過                                                                         |
| audit 高風險門檻   | 通過；仍有 6 項 moderate                                                          |

這次結果證明雲端資產與依賴可還原，且手動啟動後可完成上述驗證，沒有本機依賴；**不代表全自動 startup 已成功，也不代表 GitHub CI 已執行**。先前 onboarding 通過仍不能替代 fresh 工作驗證。GitHub 錯誤帳戶造成的 403 尚未修正，成果未推送、未建立 PR，因此整體遷移尚未完成。

## 雲端、本機與 GitHub 的分工

雲端負責新分支日常開發、測試、提交及 draft PR；GitHub 保存共同版本與 CI 證據。本機可保留開發介面或人工驗收，但雲端提交不會自動更新本機工作目錄：本機須先保存未提交工作，再 `git fetch origin` 並切換需要的分支，使用 `git pull --ff-only` 更新。PR 未合併前，pull main 不會取得 PR 內容。

舊工作與對話不會自動搬移到雲端。交接提供的本機準備分支 `codex/cloud-development-preparation-20261002`、commit `36d4acf656d51cbbaf01b670dc414f5185cb21e8` 只有 66 行同名說明文件且未推送；本次遠端只見 main，本地物件庫亦無該 commit。本文件從遠端 main 新建，未 cherry-pick 該 commit，無法作逐行比較。後續銜接應人工比較兩版文件，避免重複新增；沒有遺漏的程式碼變更需要搬運。含個人路徑的本機協作文件不納入本次提交。

CI 目前只做 install、typecheck、build、unit、integration、audit，沒有部署步驟。外部 GitHub hooks／GitHub Apps 的副作用未能核實，不能保證推送不觸發任何外部自動化。本工作不執行正式部署或服務操作。

## 本次提交與遠端狀態

文件分支：`codex/cloud-development-validation-20261002`。雲端 Git 推送收到儲存庫權限 HTTP 403；實際 Git 身份與擁有者 connector 不同。已停止遠端寫入，沒有改用另一帳戶或 API 繞過拒絕。需要先由擁有者修正此 saved environment 的 Git 身份／授權，再明確恢復推送工作。

推送失敗後重新 `git ls-remote --heads origin`，遠端仍只有 main，SHA 仍為上述 `cd4f89d…`；本次分支與文件提交尚未在遠端，亦未建立 draft PR。新 commit 沒有可驗證的遠端 CI。對 main 查詢的 commit statuses 為空；connector 的 workflow 查詢僅涵蓋 PR 觸發且結果為空，不能據此宣稱 push CI 成功或從未執行。GitHub CLI 的 REST／GraphQL 讀取亦遭 Forbidden，因此完整 Actions 狀態未能確認。
