# 首課私人媒體審核接入

本次是未發布的私人審核入口。公開首課的文字／工具免登入；MP4、字幕、封面與章節不在這個公開範圍。沒有變更正式 LMS 報讀、免費名額、版本、點數或付款權限。

## 存取與版本

- `FIRST_LESSON_PREVIEW_ENABLED` 預設 false。只有非 production 環境可用；正式環境即使誤設 true 仍回 404。
- `FIRST_LESSON_PREVIEW_DIR` 必須是儲存庫外的絕對私人路徑，工作副本目標為 `/workspace/pt-course-dev/private-media/first-lesson/v1/`。本輪沒有啟用此設定。
- 審核者使用既有管理員帳戶登入並完成 MFA，前往 `/?page=first-lesson&mediaPreview=1`。一般學員及未完成 MFA 的管理員沒有媒體存取權。
- 同源 metadata：`/api/v1/first-lesson-media/v1`；同源資產只有固定 `video`、`captions`、`poster`、`chapters` 四種，沒有任意檔案路徑參數或 Library URL。
- 每次 metadata／資產／HEAD／Range 請求均經既有 auth + admin MFA。版本固定 v1；未知版本回 404。每次檢查檔案種類、大小，拒絕檔案 symlink，並核對父端提供的 MP4、字幕 SHA-256。封面及章節尚無父端雜湊，僅可核對已確認 byte size／字幕格式，補齊本機雜湊與像素驗收後才可啟用審核。
- 回應 private, no-store；影片支援 Range 206／HEAD，無效 Range 416；字幕 `text/vtt`、zh-Hant，章節獨立 track。沒有第三方來源或公開靜態檔。
- 這個入口不能發布媒體。正式開放仍需要明確的公開示範發佈設計或既有 LMS 私人版本綁定；不能直接在 production 啟用此審核入口。

## 來源與目前阻礙

父端交付資料：379.583 秒、1920×1080p24 H.264／AAC 48k、Juno 粵語、165 條繁中字幕；父端技術／ASR／42 幀 QA 通過，未人工聽審。這些是父端交接資訊，尚非本機重驗結果。

四個確定 Library 參照成功解析。遵循當前 Library materialization 流程、使用官方 helper，首次及一次限定重試均回 `library file transfer failed: download failed`。四個正式檔案均未出現在工作目錄；沒有改用通用檔案 API、猜測網址或假設父子共用檔案系統。確認 ID／version／byte size／SHA 保存在私人目錄的 `intake.json`，不保存下載連結。

因此正式 MP4／字幕實際播放、379.583 秒與 165 cues 重驗、封面像素檢視及人工聽審**尚未完成**。私人預覽維持關閉，公開來源維持 null。

## 驗證與證據

- API 測試涵蓋匿名、一般學員、缺少 MFA、關閉及 production 拒絕；授權回應、快取標頭、206、HEAD、416、未知版本、字幕 MIME、相同長度遭竄改／缺檔拒絕。
- 播放器使用本機產生的 3 秒 H.264／AAC 合成測試片及繁中 VTT，明確標記為 fixture；不得當作正式成片驗收。桌面 1440px、手機 390／320px 檢查播放、暫停、seek、active cue、zh-Hant、inline 與橫向溢出。
- 本機 QA 證據 `.local/qa/media-fixture/`，包含測試腳本、報告及截圖；沒有把合成片放進正式媒體目錄或 Git。

本輪實際結果：6 項 unit／媒體權限測試、16 項 integration、9 項原有 E2E 及新增私人媒體拒絕／不可信來源回退測試通過；typecheck／build 通過。合成播放器三個尺寸均成功 seek 至 1.5 秒、讀取 zh-Hant active cue，沒有橫向溢出，見 [fixture 報告](player-fixture-qa.json)。
