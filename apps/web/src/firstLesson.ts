// Public introductory workshop. This is not an LMS enrollment or a certificate assessment.
// Replace media only after the final narrated video and matching WebVTT have been reviewed.
export const firstLessonMedia: { video: string | null; captions: string | null; poster: string } = {
  video: null,
  captions: null,
  poster: '/lesson-one-poster.svg',
};
export const firstLessonMediaStatus = firstLessonMedia.video
  ? firstLessonMedia.captions
    ? '配音影片與字幕已加入'
    : '影片已加入 · 字幕待加入'
  : '文字實作已開放 · 影片製作中';

export const firstLessonTitle = 'AI新手不用怕！跟著做出你的第一個小工具';
export const firstLessonPrompt = `請幫我製作一個原創「分享卡小工具」，讓沒有程式背景的人也能使用。

目標：輸入一句話，製作可下載的正方形分享卡。
功能：
1. 標題必填，最多 48 個字；作者可留空，最多 24 個字。
2. 提供海軍藍、薄荷綠、暖橙三種配色。
3. 輸入時即時預覽；長標題要自動換行，不可超出卡片。
4. 下載 1080 × 1080 像素的 PNG 圖片。
5. 使用繁體中文標籤；手機上也能操作。
6. 不上傳輸入內容，不需要登入，不連接付款或外部資料庫。

請用一個可在瀏覽器開啟的 HTML 檔案完成，包含需要的 CSS 與 JavaScript，不使用外部套件。
先簡短說明你的做法，再提供完整程式碼，以及儲存和開啟檔案的步驟。
完成後請列出：空白標題、長標題、沒有作者、三種配色、PNG 尺寸與手機版的檢查方法。`;

export const lessonSteps = [
  {
    title: '先看成果，再開始',
    tag: '認識目標',
    text: '今天不需要先背程式語言。我們要做的是一張可以下載的分享卡：輸入標題、選擇顏色，再把圖片存起來。先在「實作工作桌」試做一次，知道自己要甚麼，接下來才更容易和 AI 說清楚。',
    task: '輸入「把好奇，變成作品。」，選一個你喜歡的顏色。',
  },
  {
    title: '把想法說清楚',
    tag: '寫出需求',
    text: '把 AI 當成協助你完成工作的工具。不要只說「幫我做一個網站」；說清楚誰會用、要完成甚麼、有哪些選項，以及怎樣才算做好。下方提示已把這些要求拆開，你可以複製到自己使用的 AI 工具。',
    task: '閱讀提示，找出「目標」「功能」「限制」和「檢查方法」。',
  },
  {
    title: '從回答變成小工具',
    tag: '跟著實作',
    text: '把提示送給你選用的 AI 工具。若工具提供網頁預覽，先在預覽測試；若回覆是程式碼，請把完整內容貼進純文字編輯器，儲存為 share-card.html，再用瀏覽器開啟。不同工具的介面與可用功能會不同，也可能需要帳戶或付費方案。看不懂時，把你卡住的步驟描述清楚，請它逐步解釋。',
    task: '試著改動標題，確認畫面真的跟著更新。AI 產生的版本可能需要修正。',
  },
  {
    title: '測試，再改好一點',
    tag: '檢查結果',
    text: '畫面漂亮不等於功能正確。清空標題、填長句子、不填作者、逐個切換配色，最後下載圖片並檢查尺寸。遇到問題，用「我做了甚麼、實際發生甚麼、希望怎樣」描述，請 AI 只修正相關部分，再重新測試。',
    task: '修正提示範例：「輸入長標題後，文字超出卡片。請自動換行，保留邊距，並確保下載圖片也一樣。」',
  },
  {
    title: '留下第一件作品',
    tag: '回顧與延伸',
    text: '下載你的分享卡，並記下哪一句需求最有用、哪一個問題需要修正。下一步可以自行加入日期或調整字體，但每次先改一件事。這個練習幫你體驗從想法到測試的過程；能否成為產品，還需要了解使用者、成本及實際需求。',
    task: '完成下方自我檢查，然後為你的下一個小工具寫下一句清楚的目標。',
  },
];

export const reviewQuestions = [
  {
    question: '想請 AI 製作小工具，哪個起點最清楚？',
    options: ['幫我做個很厲害的網站', '讓使用者輸入標題、選三種配色，下載正方形 PNG', '完全照抄別人的產品'],
    answer: 1,
    explanation: '清楚的使用情境、輸入與成果，比模糊形容詞更容易檢查。',
  },
  {
    question: 'AI 產生的畫面看起來正確，接下來呢？',
    options: ['直接當成完成', '只改顏色', '測試空白、長文字、手機及下載檔案'],
    answer: 2,
    explanation: '要測試實際操作與邊界情況，不能只看畫面。',
  },
  {
    question: '這個練習完成後，代表甚麼？',
    options: ['保證可以賺錢', '已取得正式專業認證', '完成一次需求、實作與測試的練習'],
    answer: 2,
    explanation: '第一件作品是學習成果；商業可行性與認證需要另外驗證。',
  },
];
