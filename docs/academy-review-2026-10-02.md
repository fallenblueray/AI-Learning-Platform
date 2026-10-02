# 第二輪介面與分享卡審核

已實際查看 1440px 桌面、390px 手機首頁及首課畫面，並以 Chromium 重拍。不使用合成設計稿代替驗收。前一版最新文件提交 `68a32dc` 的 [CI #17](https://github.com/fallenblueray/AI-Learning-Platform/actions/runs/37044241340) 已確認成功，並非僅引用前一程式提交。

## 保留與修正

- 保留海軍藍／奶白與薄荷綠的主要層次；暖橙只用於強調及作品配色。首頁只展示真正可操作的分享卡成果，不加入虛構見證、數據或保證收入的宣稱。正文與空白分隔仍以閱讀為主，不再堆疊裝飾卡片。
- 手機表單輸入改為 16px，主要教材正文 14px。小型英文標籤是次要裝飾，不承擔操作指示。
- 首課加上三個真實頁內跳轉，手機不必一路捲動才能找到步驟或提示。
- 待製作影片改用等待圖示，消除「播放按鈕卻不能播放」的錯誤暗示；影片 URL 仍為 null。
- 發現貼上 60 字時原 48 字上限會截去內容，現支援完整 60 字。SVG 預覽與 PNG 共用實際量字、換行及縮字計算。標題區保留在 y=350–810，裝飾到 y=326，頁腳分隔線 y=882。
- 檢視下載 PNG 時發現箭頭依賴字型會顯示成方框，已改成向量線條，不再依賴字型是否包含箭頭。

## 驗證

- 空字串、全空格會提示輸入標題；作者空白合法，不會留下假署名。
- 40／45／60 中文字 × 三色 × 390／1440px，共 18 組真實 PNG 下載，均 1080×1080；預覽量測沒有文字截斷、右側溢出或裝飾／頁腳重疊。PNG 已實際開圖檢查。
- TypeScript、production build 通過；8 項 E2E 通過（含新增長文字保護與既有帳戶／LMS）。
- 重新拍攝 24 張實際畫面，沒有頁面錯誤或橫向溢出。
- Library 正式截圖上載嘗試因環境連線錯誤未成功，沒有 confirmed Library IDs；未重複建立或宣稱保存成功。父端可從同一 PR 分支取得下列精確路徑，再透過自己的 Library 連線保存：
  - `docs/screenshots/home-desktop.jpg`
  - `docs/screenshots/home-mobile.jpg`
  - `docs/screenshots/first-lesson-desktop.jpg`
  - `docs/screenshots/first-lesson-mobile.jpg`

## 私人媒體交接（不部署、不公開）

- 目標 MP4：`first-lesson-juno-yue-v1.mp4`，H.264／AAC，1920×1080、25 或 30fps，fast-start，建議 ≤100 MiB。現有後台單檔上載介面限制 250 MiB；超過需先重新編碼，不自行擴大上載或儲存權限。
- 字幕：`first-lesson-zh-Hant-v1.vtt`，UTF-8 WebVTT，繁體書面中文，建議 ≤1 MiB；與最終 MP4 的實際時軸一致。配音為父任務指定 Juno Dragon HD 粵語，13 場景。
- 可選封面：`first-lesson-poster-v1.jpg`，1920×1080、≤2 MiB；未提供時保留現有 SVG。
- 持久保存：媒體原件存私人 Library，保留 confirmed `library_file_id`、版本、byte size、SHA-256。工作副本放在儲存庫外的 `/workspace/pt-course-dev/private-media/first-lesson/v1/`，資料夾權限 700；此本機副本不是長期備份。另一份私人備份只能使用既有授權目的地，不建立公開 bucket、不放進 public/GitHub。
- [manifest 範本](media/first-lesson-intake.example.json) 只存穩定識別、檔名、雜湊、時長與審核狀態，不存 Library 簽署下載 URL。素材收到後填入實際值；此範本的 null 不是已接入。
- 現有 LMS 支援私人 MP4 的授權短效連結；VTT 尚不在私人資產副檔名白名單內。私人字幕接入需有相同報讀授權及版本綁定，不能把 Library URL 或 VTT 放到 public 繞過授權。本輪僅交接保存規格，未修改白名單、商業權限或媒體公開狀態。
- 可替換性：版本用 v1／v2 分開，播放器配置與來源分離；新版本需重新核對 duration、字幕結尾、13 場景與桌面／手機播放。既有 immutable 報讀版本不被覆寫。

## 第三輪手機逐像素審核

針對 320／390px 的實際截圖再修正，未將獨立教學示範 HTML 混入網站：

- 頂欄保留圖標及「創科學苑」，不再只顯示頁面名稱；品牌與登入控制沒有碰撞。
- 沒有正式影片時，只顯示約 70px 的準備中提示。有影片來源後仍呈現原本的完整播放器。
- 手機順序改為短提示、64px 成果縮圖、進度及第一步、完整工具與檢查表、提示詞、自我檢查。320／390px、844px 高度的第一步標題下緣均為約 y=749，底部導航從 y=778 開始，首屏可辨識教學內容。
- 「開始第1步」是唯一深色主要跳轉，其餘為次要按鈕；明示「免登入開始 · 公開練習」，與實際行為一致。
- 功能標籤至少 12px，說明以 13–14px 為主，手機輸入維持 16px。步驟手機標籤縮為「目標／需求／實作／檢查／回顧」，避免小格內擠成多行。
- Chromium 實測 320／390px 展開選單，等待滑入完成再拍攝；沒有被裁切或橫向溢出。亦檢查首頁與首課完整長頁、桌面、登入及 LMS 畫面。
- TypeScript、production build 與 9 項 E2E 通過（新增品牌、提示高度、步驟順序、功能字級及展開選單測試）；24 張主要頁面重拍，零 pageerror／橫向溢出。既有 API 單元及整合測試由 CI 再核對；本次不修改後端。

四張既有截圖已更新，額外附上：

- [320px 完整首課](screenshots/first-lesson-320-full.jpg)
- [390px 完整首課](screenshots/first-lesson-mobile-full.jpg)
- [320px 展開選單](screenshots/menu-320.jpg)

正式配音及字幕尚未交付，來源仍為 null；沒有公開私人 MP4、VTT 或 Library 下載連結。原始示範 HTML 的隔離 QA 報告與成品在本機 `.local/qa/parent-sharecard/`，不納入此 PR。
