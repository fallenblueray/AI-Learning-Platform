# 社群行銷 × AI 副業：2026-10-03 改版

## 已實作範圍

- `SocialAcademy.tsx`：原創首頁、主題課程卡、獨立課程詳情；首頁以內容、創作、流程及副業驗證串起學習路線。
- `socialCourse.ts`：父端提供的香港書面語 v2 課綱（7 章／28 課）及 18 項資源規劃。這是編輯資料，不送入報名、付款或課程發布 API。
- `social-academy.css`：橫向導覽、手機抽屜、桌面雙欄簡介與資訊卡、章節黏頂導覽、手機單一固定操作列。插畫為原創 CSS，不使用 Hahow 截圖或素材。
- `App.tsx`：新增 `page=social-course`、瀏覽器返回與頁面標題；真正已上架的課程仍取自原 API，原課程卡與解鎖流程保留。
- 分享卡練習移至課程列表下方的獨立入口，並保留原路由及回歸測試；沒有把它當成新社群 AI 首課。
- `LearningPage` 的字幕切換、播放器重掛載、請求取消、媒體 scope 及不可變版本邏輯沒有改動；後端與資料庫 schema 沒有改動。

## 資料與交易狀態

新課程明示「製作中／尚未開放報名」，主 CTA 為「查看課綱」。售價與開放日期待公布；HKD 只是未來定價幣別，未覆蓋任何資料庫金額。沒有假評價、學員數、折扣、倒數、收入或播放按鈕。18 項資源與社群均明示規劃中，尚無下載／加入承諾。

既有每帳戶每級一次免費解鎖整門課規則、點數扣款、測验發證與既有課程版本不變。新頁面的操作不會送出報名或付款請求，已由瀏覽器測試驗證。

## 參考圖存取狀態

父端提供 Hahow 公開頁桌面調研：白底雙欄課程簡介、下方黏頂章節導覽、淡底內容與右側修課資訊卡、章節 accordion、講師／作品區塊。本輪依該文字調研採用資訊層級，自主原創視覺。

四個新 Library 參考 ID：

- `libfile_b1b55e963ce081918760843508450985`
- `libfile_4231c0e6e5248191becd48808c40aa8e`
- `libfile_647f48caed3c8191a12bf41f5385cd8b`
- `libfile_d4bf43a58f8c8191a6a133922759828f`

正式準備成功，但四個檔案的 Library helper 均回報 `library file transfer failed: download failed`。本機沒有圖檔，因此**未看過參考圖像素，也未完成逐像素比較**。未改用其他下載方式、未繞過權限，參考圖未放進網站或 Git。

## 驗證

隔離 MySQL 8.4 `pt_academy_test`；Node 24／npm 11。測試帳戶、私有媒體與帳密只在 Git 忽略的本機資料夾。

- TypeScript：API／web 通過。
- Production build：通過。
- Unit：7／7 通過。
- Integration：18／18 通過；涵蓋免費名額競爭、重複扣點、版本固定、CSRF／MFA、refresh 重放、Stripe 簽章與退款、私有影片／字幕授權。
- Chromium E2E：21／21 通過，無跳過。涵蓋 320／390／768／1024／1440px、公開練習 PNG、登入／導覽、LMS 閱讀／測驗／證書、測試付款、字幕選軌、播放器重掛載、過期／遲到媒體回應，以及新課程課綱、FAQ、黏頂導覽與非交易 CTA。
- 沒有 lint script；使用 Prettier 與 `git diff --check`。新增測試只覆蓋實際互動與重要商業狀態，沒有重建既有後端測試。
- 首次新 FAQ 捲動測試把頁尾位置硬限定在 100px，實際因文件剩餘高度為 148px；改為驗證內容進入可見區域，非掩蓋溢出。其餘既有回歸全部保留。

截圖由真實 Chromium、真實本機前端與隔離 API 產生。資料庫含既有及 integration 測試教材，課程列表中的測試項目不是正式商品。無套用 API mock 以美化截圖。

- [桌面首頁](screenshots/social-academy/home-1440.jpg)
- [桌面主課程](screenshots/social-academy/social-course-1440.jpg)
- [桌面課程完整頁](screenshots/social-academy/social-course-1440-full.jpg)
- [桌面展開課綱](screenshots/social-academy/curriculum-1440.jpg)
- [390px 首頁](screenshots/social-academy/home-390.jpg)
- [390px 課程頁](screenshots/social-academy/social-course-390.jpg)
- [320px 課程頁](screenshots/social-academy/social-course-320.jpg)
- [768px 課程頁](screenshots/social-academy/social-course-768.jpg)
- [手機抽屜](screenshots/social-academy/navigation-mobile.jpg)
- 完整拍攝清單：[capture-manifest.json](screenshots/social-academy/capture-manifest.json)。重跑：`node scripts/capture-social-academy.mjs`。

## 尚待交付／未執行

1. 父端已完成並交付新首課可審版參照；網站端正式 Library 下載失敗，尚未取得可讀素材。因此正式媒體播放、配音聽檢及字幕時序驗收尚未完成；通過的影片測試只使用明示為 QA 的合成媒體。
2. 新首課內容是自己的筆記 → 固定設定 → AI 三個草稿 → 人工選改 → 配圖 → 換材料重跑；不接入舊 Juno／桌椅／陶藝影片。
3. 新媒體應依原有 LMS 私有資產／版本化字幕流程接入新課程草稿或隔離驗收版本，不能覆寫既有報讀版本；舊固定檔名的私人首課 preview route 保持未啟用。
4. 普通話僅規劃，沒有假可播放語言。Gemini 如加入，只作有真實示範的對照，不提供繞區教學。
5. 未部署、未合併、未啟用真付款；沒有改正式 DB、刪資料或擴大權限。Draft PR 保留供父端驗收。

## 獨立視覺審查修正

- 平板主題卡曾真實裁切：767px 時卡片底部 678.58px，CTA 底部 745.45px。新增測試先重現失敗；移除插畫 `height:100%` 的高度耦合，900px 以下改為單欄，767／768／820／1024px 均驗證價格狀態與 CTA 完整落在卡片內，並可點入課程。
- 390／768px 抽屜皆有覆蓋全畫面的 backdrop；關閉時 inert／aria-hidden，開啟時 modal 語意並隔離背景。按鈕、Escape、backdrop 關閉後還原焦點；跨 900px 斷點會關閉抽屜並解除 body lock。Tab 不會進入關閉的抽屜。
- 拍攝等待抽屜實際 transform／邊界到位，不採固定延遲。加入 API 可用性及異常通知檢查；本輪曾因本機 API 中斷而中止／重跑，失敗狀態不作最終證據。
- 首頁改為「用 AI 做好內容，開始你的社群副業」，課程列表改為「從內容創作，開始學社群行銷」。320／390px 標題沒有單字孤行。移除封面「課程主視覺・非影片預覽」角標。
- 章節副標、規劃中及價格日期狀態至少 12px、文字色 #53634f；320／390／768px 以 computed style 驗證對比至少 4.5:1。這是 Chromium 自動化與像素複核，不代表已驗證所有真機／螢幕閱讀器。
- 四項新增 E2E 加上原有 17 項，共 21 項。原有 19 張截圖與 manifest 已重新拍攝，另加 `featured-card-768.jpg`，完整顯示平板卡片及 CTA。

## 新首課可審版交付

2026-10-03 父端確認新影片與字幕可審版完成；網站僅更新此製作狀態，未啟用播放或發布教材。版本、大小及失敗紀錄見 [私有導入紀錄](media/social-lesson-intake.md)。
