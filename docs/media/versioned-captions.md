# 與既有課程版本綁定的字幕

字幕是 `CourseContent.lessons[].captions` 的一部分，與影片同時存入 `course_versions.content`；不使用獨立公開 sidecar。既有無字幕版本仍可讀，不需 migration，也不改变價格、免費名額或報讀規則。

## 授權與資料契約

- 每個影片單元最多八條：`id`、`language`、`label`、`asset_key`、可選 `default`。ID 不可重複，最多一條預設字幕；只接受 `media/<id>.vtt`，不接受任意 URL／路徑，非影片單元不可有字幕。
- `GET /enrollments/:id/lessons/:lesson/asset` 現回傳影片 URL 及字幕 URL 陣列。新增 `GET /enrollments/:id/lessons/:lesson/captions/:caption` 可重新取得單條字幕連結。
- 兩者均使用既有 `ownedEnrollment`，再讀該 enrollment 的 `version_id`。不查目前已發布版本、不接受外部 key／version。一般 learning payload 隱藏字幕 asset_key；未登入、他人 enrollment、未知單元／字幕均不能取得授權連結。
- URL 完全沿用影片的五分鐘 bearer 授權：local HMAC 或 S3 presigned URL。已發出的連結在登出後仍可能有效至到期，與原影片規則一致；這不同於私人 preview 每次存取即時驗證 session。未偷偷改成新的商業權限／撤銷規則。
- 「immutable」指報讀版本的內容快照及字幕 key 綁定；不宣稱外部 object storage 已提供 write-once／版本鎖定。新上載使用新 UUID key；外部既有物件覆寫／保留政策沿用原媒體設計，沒有在此變更 bucket 權限。

## 管理與播放

管理員透過原有 MFA 上載流程新增 WebVTT，可設定語言、名稱、預設軌或移除草稿字幕。上載新檔產生新 key；發布新版本才更新新報讀內容，舊報讀保持原字幕。介面檢查 1MB 和 WEBVTT 檔頭；local 上載亦在伺服器驗證。S3 直接上載沿用原 presigned 流程，未聲稱已實測遠端 body validation。

播放器提供字幕選單及關閉選項，並同步原生選軌變化。重新取得教材會一起更新字幕授權，保留選軌並重建播放器以免殘留 cue。VTT 用 `text/vtt`；跨來源 S3 須沿用既有受信來源並配置正確 CORS，不能為此公開 bucket。local 同源實測已完成；外部 S3/COS 尚未驗收。

## 私人審核與公開首課決策

私人 preview 只供非 production、管理員 MFA 審核；不可拿它作公開首課或付費課的捷徑。公開首課現有媒體配置保持 null（default-off），沒有加入能把私人檔案直接公開的開關。正式發布需另有明確公開版本與素材授權決策；通用課程字幕已可經正常版本流程接入，但本次沒有發布任何正式課程或媒體。

## 驗證

- Schema：舊版本相容、VTT key、重複 ID、預設軌限制及非影片拒絕。
- 真實 API：他人報讀拒絕、私有 key 不外洩、未知字幕拒絕、五分鐘 TTL／過期拒絕；發布 v2 後，v1 報讀仍下載 v1 字幕。
- 真實本機 LMS + Chromium：1440／390／320px 合成 MP4＋繁中／英文字幕，播放、雙語切換、關閉、重新取得連結與選軌保留；無橫向溢出或 pageerror。
- 合成 fixture 可用 `scripts/seed-caption-qa.ts` 建立（只接受 `_test` 資料庫、local storage，拒絕 production；需先在 `.local/qa/media-fixture/fixture.mp4` 放入明確標示的測試短片）。以產生的隔離帳戶設定 `E2E_CAPTION_EMAIL`／`E2E_CAPTION_PASSWORD` 執行 `tests/browser/captions.spec.ts`。不含正式 Library 媒體。
- 正式影片、封面像素、字幕時軸、真人聽審仍待取得來源檔；禁止用 fixture 結果代替。

本輪結果：7 項 unit、18 項 integration、11 項 E2E、typecheck 及 production build 通過。額外實際管理員登入＋MFA，完成 VTT 上載、語言／名稱／預設驗證與移除草稿字幕，未發布課程。見 [QA 報告](caption-integration-qa.json)、[手機播放器](../screenshots/lms-caption-mobile.jpg)、[桌面播放器](../screenshots/lms-caption-desktop.jpg)、[手機字幕編輯器](../screenshots/caption-admin-mobile.jpg)。
