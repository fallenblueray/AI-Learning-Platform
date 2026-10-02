import { useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Clock3,
  PlayCircle,
  Sparkles,
  Lightbulb,
  MousePointer2,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import { CardArtwork, ShareCard } from './ShareCard';
import {
  firstLessonMedia,
  firstLessonMediaStatus,
  firstLessonPrompt,
  firstLessonTitle,
  lessonSteps,
  reviewQuestions,
} from './firstLesson';

export function AcademyHome({ onStart, onCatalog }: { onStart: () => void; onCatalog: () => void }) {
  return (
    <div className="academy-home">
      <section className="studio-hero">
        <div className="studio-hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> 給每一個「我不懂程式」的你
          </div>
          <h1>
            你有想法。
            <br />
            現在，<em>做出來。</em>
          </h1>
          <p>
            從第一句提示，到第一件小作品。
            <br />
            跟著短課，一步一步用 AI 把想法變成
            <br className="desktop-break" />
            用得上的小工具。
          </p>
          <div className="hero-buttons">
            <button className="button" onClick={onStart}>
              從第一課開始 <ArrowUpRight size={19} />
            </button>
            <button className="text-button" onClick={onCatalog}>
              探索所有課程 <ArrowRight size={16} />
            </button>
          </div>
          <div className="hero-small">
            <Check size={14} /> 零程式背景也能開始 <span>·</span> 按自己的步伐學習
          </div>
        </div>
        <div className="studio-scene" aria-label="第一課成果：可自訂文字和配色的分享卡">
          <div className="scene-grid" />
          <div className="scene-label">
            <span /> IDEA → MAKE → TRY
          </div>
          <div className="scene-window">
            <div className="window-toolbar">
              <span>
                <i />
                <i />
                <i />
              </span>
              <small>我的第一個小工具</small>
              <Sparkles size={14} />
            </div>
            <CardArtwork />
            <div className="window-controls">
              <span>海軍藍</span>
              <i />
              <i />
              <i />
              <Download size={16} />
            </div>
          </div>
          <div className="scene-note">
            <CheckCircle2 size={18} />
            <span>
              從一句話，<strong>到一張可以帶走的卡片。</strong>
            </span>
          </div>
          <div className="scene-cursor">
            <MousePointer2 size={25} fill="currentColor" />
            <span>你的想法</span>
          </div>
          <span className="scene-caption">第一課原創實作 / SHARE CARD MAKER</span>
        </div>
      </section>
      <div className="approach-strip">
        <span>
          <PlayCircle size={20} /> 先看示範
        </span>
        <ChevronRight size={15} />
        <span>
          <MousePointer2 size={20} /> 跟著動手
        </span>
        <ChevronRight size={15} />
        <span>
          <CheckCircle2 size={20} /> 帶走作品
        </span>
        <p>少一點術語，多一點「我做到了」。</p>
      </div>
      <section className="home-section">
        <div className="studio-section-heading">
          <div>
            <div className="eyebrow">YOUR FIRST SMALL WIN</div>
            <h2>第一步，不必很大。</h2>
          </div>
          <span className="section-side-note">從一個小工具開始，建立自己的信心。</span>
        </div>
        <FirstLessonFeature onStart={onStart} />
      </section>
      <section className="home-section">
        <div className="studio-section-heading">
          <div>
            <div className="eyebrow">LEARN BY MAKING</div>
            <h2>把「學 AI」變成具體的事。</h2>
          </div>
        </div>
        <div className="principle-grid">
          {[
            {
              icon: Lightbulb,
              title: '先說清楚你想做甚麼',
              text: '從日常的小需要出發。把目標、選項和限制寫下來，不必先懂複雜術語。',
              index: '01',
            },
            {
              icon: MousePointer2,
              title: '每一步，都有東西可試',
              text: '看示範、改一個地方、看看結果。卡住時學會描述問題，再請 AI 協助修正。',
              index: '02',
            },
            {
              icon: CheckCircle2,
              title: '完成作品，也練習判斷',
              text: '檢查功能是否真的可用，再思考誰需要它。探索創業從理解需求開始。',
              index: '03',
            },
          ].map((item) => (
            <article key={item.index}>
              <div>
                <item.icon size={25} />
                <span>{item.index}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="invitation">
        <div>
          <span className="eyebrow">START WITH CURIOSITY</span>
          <h2>
            不需要準備好一切，
            <br />
            才開始第一步。
          </h2>
          <p>帶著一個想法來，帶著一件作品走。</p>
        </div>
        <button className="button cream" onClick={onStart}>
          開始我的第一課 <ArrowUpRight size={19} />
        </button>
        <svg className="invitation-star" viewBox="0 0 100 100" aria-hidden="true">
          <path
            fill="currentColor"
            d="M45 0h10v32L78 9l7 7-23 24h33v10H63l23 23-7 7-24-23v33H45V58L22 81l-7-7 23-24H5V40h32L14 17l7-7 24 24z"
          />
        </svg>
      </section>
      <section className="home-section faq-section">
        <div>
          <span className="eyebrow">A FEW GOOD QUESTIONS</span>
          <h2>開始之前，你可能想知道</h2>
        </div>
        <div>
          {[
            [
              '完全不懂程式，也可以學嗎？',
              '可以從首課開始。我們會把需求、提示、測試拆成小步驟。你仍需要親自嘗試和檢查，AI 也可能出錯；遇到問題正是練習的一部分。',
            ],
            [
              '首課現在可以學到甚麼？',
              `首課文字教材、提示與分享卡實作已可體驗。${firstLessonMediaStatus}。這個公開練習不消耗帳戶的免費選課名額，也不發完成證書。`,
            ],
            [
              '平台課程如何解鎖？',
              '平台課程提供每帳戶每級免費任選一整課，確認後不能更換；其他課程按原有點數規則解鎖。未開放的課程不作銷售。',
            ],
            [
              '學完就能創業或獲得收入嗎？',
              '課程幫助你學習實作和測試，不保證收入、創業成功或在固定時間完成。真正的產品仍需要驗證需求、計算成本和持續改善。',
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span>+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

export function FirstLessonFeature({ onStart }: { onStart: () => void }) {
  return (
    <article className="first-lesson-feature">
      <button className="feature-art" onClick={onStart} aria-label="查看首課：分享卡小工具">
        <div className="feature-art-caption">
          <span>PROJECT 01</span>
          <span>原創練習</span>
        </div>
        <div className="mini-art">
          <CardArtwork title={'你好，\n新可能。'} author="MADE BY YOU" theme="mint" />
        </div>
        <span className="feature-format">{firstLessonMediaStatus}</span>
      </button>
      <div className="feature-copy">
        <div className="course-tags">
          <span className="level-badge beginner">零基礎入門</span>
          <span>公開體驗</span>
        </div>
        <h3>{firstLessonTitle}</h3>
        <p>不用從空白畫面開始。跟著提示製作一個分享卡工具，把你的一句話變成可下載的圖片。</p>
        <div className="feature-outcomes">
          <span>
            <Check size={15} /> 自訂標題與作者
          </span>
          <span>
            <Check size={15} /> 三種配色
          </span>
          <span>
            <Check size={15} /> 1080 PNG 下載
          </span>
        </div>
        <button className="button" onClick={onStart}>
          看看課程，動手試做 <ArrowRight size={17} />
        </button>
        <small>不消耗 帳戶免費名額 · 不發完成證書</small>
      </div>
    </article>
  );
}

export function FirstLessonPage({ onCatalog }: { onCatalog: () => void }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [copyStatus, setCopyStatus] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [review, setReview] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const current = lessonSteps[step];
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(firstLessonPrompt);
      setCopyStatus('提示已複製，貼到你選用的 AI 工具即可。');
    } catch {
      promptRef.current?.focus();
      promptRef.current?.select();
      setCopyStatus('已選取提示，請使用裝置的複製功能。');
    }
  }
  return (
    <div className="first-lesson-page">
      <button className="back-link" onClick={onCatalog}>
        <ArrowLeft size={16} /> 返回探索課程
      </button>
      <div className="workshop-heading">
        <div>
          <div className="eyebrow">
            FIRST PROJECT / 01 <span>零基礎入門</span>
          </div>
          <h1>{firstLessonTitle}</h1>
          <p>今天的成果：一個能輸入文字、切換配色、下載圖片的分享卡工具。</p>
        </div>
        <span className="workshop-badge">
          <Sparkles size={17} /> 原創實作
        </span>
      </div>
      <nav className="workshop-shortcuts" aria-label="首課快速跳轉">
        <a href="#lesson-steps">閱讀步驟</a>
        <a href="#share-tool-title">直接試做</a>
        <a href="#lesson-prompt">取得提示</a>
      </nav>
      <div className="workshop-layout">
        <div className="workshop-main">
          <section className="workshop-video" aria-label="首課影片">
            {firstLessonMedia.video ? (
              <>
                <video
                  ref={videoRef}
                  controls
                  playsInline
                  preload="metadata"
                  poster={firstLessonMedia.poster}
                  src={firstLessonMedia.video}
                  onError={() => setMediaError(true)}
                >
                  {firstLessonMedia.captions && (
                    <track
                      kind="captions"
                      src={firstLessonMedia.captions}
                      srcLang="zh-Hant"
                      label="繁體中文字幕"
                      default
                    />
                  )}
                </video>
                {mediaError && (
                  <div className="media-error" role="alert">
                    影片暫時未能載入。你可繼續閱讀下方教材。
                    <button
                      className="text-button"
                      onClick={() => {
                        setMediaError(false);
                        videoRef.current?.load();
                      }}
                    >
                      重試影片
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="video-pending">
                <img src={firstLessonMedia.poster} alt="首課分享卡工具示意圖" />
                <div>
                  <span className="pending-icon">
                    <Clock3 size={24} />
                  </span>
                  <strong>先動手，影片稍後見。</strong>
                  <p>
                    配音影片與繁體中文字幕製作中。
                    <br />
                    現在可跟著下方步驟，完成你的分享卡。
                  </p>
                  <span className="status-pill">文字教材與實作已開放</span>
                </div>
              </div>
            )}
            <div className="video-bottom">
              <span>
                <PlayCircle size={16} /> 第一課 · 分享卡小工具
              </span>
              <span>
                {firstLessonMedia.captions
                  ? '可開啟播放器字幕'
                  : firstLessonMedia.video
                    ? '字幕尚未加入'
                    : '配音與字幕待加入'}
              </span>
            </div>
          </section>
          <div className="workshop-progress">
            <span>
              跟著做{' '}
              <strong>
                {done.length} / {lessonSteps.length}
              </strong>
            </span>
            <div
              role="progressbar"
              aria-label="本頁練習進度"
              aria-valuenow={done.length}
              aria-valuemin={0}
              aria-valuemax={lessonSteps.length}
            >
              <i style={{ width: `${(done.length / lessonSteps.length) * 100}%` }} />
            </div>
            <small>僅記錄本次頁面練習</small>
          </div>
          <section id="lesson-steps" className="step-panel" aria-labelledby="step-heading">
            <nav className="step-tabs" aria-label="首課步驟">
              {lessonSteps.map((item, index) => (
                <button
                  key={item.title}
                  aria-label={`步驟 ${index + 1}：${item.title}`}
                  aria-current={index === step ? 'step' : undefined}
                  className={index === step ? 'active' : ''}
                  onClick={() => setStep(index)}
                >
                  {done.includes(index) ? <Check size={16} /> : `0${index + 1}`}
                  <span>{item.tag}</span>
                </button>
              ))}
            </nav>
            <div className="step-body">
              <span className="eyebrow">STEP 0{step + 1}</span>
              <h2 id="step-heading">{current.title}</h2>
              <p>{current.text}</p>
              <div className="try-note">
                <Lightbulb size={21} />
                <div>
                  <strong>現在，試試看</strong>
                  <p>{current.task}</p>
                </div>
              </div>
              <button
                className="button secondary"
                onClick={() => {
                  setDone((old) => (old.includes(step) ? old : [...old, step]));
                  if (step < lessonSteps.length - 1) setStep(step + 1);
                }}
              >
                {step < lessonSteps.length - 1
                  ? '完成這一步，繼續'
                  : done.length === lessonSteps.length
                    ? '已完成全部步驟'
                    : done.includes(step)
                      ? '此步已記下'
                      : '記下這一步'}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <section id="lesson-prompt" className="prompt-panel">
            <div>
              <div className="eyebrow">YOUR STARTING POINT</div>
              <h2>不用猜怎樣問。從這段開始。</h2>
              <p>複製後，貼到你自己選用的 AI 工具；平台不會代你傳送。</p>
            </div>
            <textarea aria-label="首課完整提示" ref={promptRef} readOnly value={firstLessonPrompt} />
            <div className="prompt-actions">
              <button className="button secondary" onClick={() => void copyPrompt()}>
                <Copy size={16} /> 複製完整提示
              </button>
              <span role="status">{copyStatus}</span>
            </div>
          </section>
          <section className="review-panel">
            <span className="eyebrow">CHECK & KEEP GOING</span>
            <h2>帶走作品，也帶走理解。</h2>
            <p>三個自我檢查，不計分、不發證。你可以隨時重試。</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setReview(true);
              }}
            >
              {reviewQuestions.map((q, index) => (
                <fieldset className="question" key={q.question}>
                  <legend>
                    <span>0{index + 1}</span>
                    {q.question}
                  </legend>
                  {q.options.map((option, optionIndex) => (
                    <label className={`answer-option ${answers[index] === optionIndex ? 'selected' : ''}`} key={option}>
                      <input
                        type="radio"
                        name={`review-${index}`}
                        required
                        checked={answers[index] === optionIndex}
                        onChange={() => {
                          setAnswers((old) => ({ ...old, [index]: optionIndex }));
                          setReview(false);
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                  {review && (
                    <p className="review-feedback">
                      {answers[index] === q.answer ? '✓ 理解正確。' : '再想一想。'}
                      {q.explanation}
                    </p>
                  )}
                </fieldset>
              ))}
              <button className="button">
                查看自我檢查結果 <ArrowRight size={16} />
              </button>
              {review && (
                <p role="status" className="review-summary">
                  {reviewQuestions.every((q, i) => answers[i] === q.answer)
                    ? '你已掌握這次練習的重點！記得下載你的作品。'
                    : '看看每題提示，修改答案後可以再次檢查。'}
                </p>
              )}
            </form>
          </section>
        </div>
        <aside className="workshop-side">
          <ShareCard />
          <div className="workshop-checklist">
            <BookOpen size={20} />
            <h3>完成前，自己檢查一次</h3>
            {[
              '標題可以修改',
              '不填作者也能使用',
              '三種顏色都試過',
              '長標題沒有超出邊界',
              '下載後是 1080 × 1080 PNG',
            ].map((text) => (
              <label key={text}>
                <input type="checkbox" />
                {text}
              </label>
            ))}
            <p>這是公開練習，並非正式課程報讀。進度和自我檢查不會寫入你的學習帳戶。</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
