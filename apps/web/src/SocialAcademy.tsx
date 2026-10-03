import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Clapperboard,
  FileText,
  Layers3,
  MessageSquare,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { chapters, courseFaqs, resourceGroups, socialCourseTitle } from './socialCourse';

/** Original CSS illustration; no learner results, external screenshots or implied playable media. */
export function ContentStudio({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`content-studio ${compact ? 'compact' : ''}`}
      role="img"
      aria-label="原創內容工作室插畫：從想法、貼文到短片的製作流程"
    >
      <div className="studio-orbit orbit-one" />
      <div className="studio-orbit orbit-two" />
      <div className="studio-art-label">YOUR NEXT CHAPTER</div>
      <div className="content-window">
        <div className="content-window-bar">
          <i />
          <i />
          <i />
          <span>我的內容工作室</span>
        </div>
        <div className="content-window-body">
          <span className="art-kicker">IDEA → CONTENT</span>
          <strong>
            好想法，
            <br />
            值得被看見。
          </strong>
          <div className="art-lines">
            <i />
            <i />
          </div>
          <div className="art-prompt">
            <Sparkles size={18} />
            <span>把想法變成第一份草稿</span>
            <ArrowUpRight size={17} />
          </div>
        </div>
      </div>
      <div className="art-video">
        <div className="art-video-sun" />
        <span className="art-video-play">
          <Clapperboard size={23} />
        </span>
        <span>CREATE YOUR STORY</span>
      </div>
      <div className="art-note">
        <MessageSquare size={20} />
        <span>
          你的觀點，<b>就是起點。</b>
        </span>
      </div>
      <div className="art-caption">想法 / 貼文 / 圖像 / 短片</div>
    </div>
  );
}

export function SocialHome({ onCourse, onCatalog }: { onCourse: () => void; onCatalog: () => void }) {
  return (
    <div className="social-home">
      <section className="social-hero">
        <div className="social-hero-copy">
          <span className="social-kicker">
            <span /> AI FOR YOUR NEXT CHAPTER
          </span>
          <h1>
            <span>用 AI 做好內容，</span>
            <span>開始你的</span>
            <em>社群副業。</em>
          </h1>
          <p>
            用 ChatGPT 整理帖文、製作配圖與短片，
            <br />
            建立可重用的流程，逐步試出自己的副業方向。
          </p>
          <div className="social-actions">
            <button className="button" onClick={onCourse}>
              探索主題課程 <ArrowRight size={18} />
            </button>
            <button className="text-button" onClick={onCatalog}>
              查看所有課程 <ArrowUpRight size={17} />
            </button>
          </div>
          <span className="hero-footnote">為忙碌的上班族而設 · 零基礎起步 · 按自己的節奏</span>
        </div>
        <ContentStudio />
      </section>
      <div className="social-method">
        <span>把學習，帶進日常。</span>
        <b>
          <MessageSquare size={19} />
          寫得清楚
        </b>
        <b>
          <Layers3 size={19} />
          做出內容
        </b>
        <b>
          <Workflow size={19} />
          建立流程
        </b>
        <b>
          <ArrowUpRight size={19} />
          驗證想法
        </b>
      </div>
      <section className="social-section">
        <div className="social-section-title">
          <div>
            <span className="social-kicker">THE LEARNING PATH</span>
            <h2>
              不用一次學會所有。
              <br />
              先做好下一步。
            </h2>
          </div>
          <p>
            以 ChatGPT 為起點，把創作、社群與副業連起來。
            <br />
            每一段都有清楚的練習方向。
          </p>
        </div>
        <div className="journey-grid">
          {[
            {
              icon: FileText,
              title: '說出你的觀點',
              text: '整理經驗、理解受眾，寫出有自己語氣的內容。',
              tag: '01 / 內容起步',
            },
            {
              icon: Clapperboard,
              title: '讓內容被看見',
              text: '從圖像到短片，選擇適合你的表達與平台。',
              tag: '02 / 社群創作',
            },
            {
              icon: Workflow,
              title: '留時間給重要的事',
              text: '整理可重用的範本，建立有人工覆核的工作流程。',
              tag: '03 / 工作流程',
            },
            {
              icon: ArrowUpRight,
              title: '試試新的可能',
              text: '研究需求與成本，用小規模提案探索副業方向。',
              tag: '04 / 副業驗證',
            },
          ].map((item) => (
            <article key={item.tag}>
              <span className="journey-icon">
                <item.icon size={25} />
              </span>
              <small>{item.tag}</small>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="social-section">
        <div className="social-section-title">
          <div>
            <span className="social-kicker">IN THE MAKING</span>
            <h2>一條完整路線，正在成形。</h2>
          </div>
          <button className="text-button" onClick={onCourse}>
            看課程規劃 <ArrowRight size={17} />
          </button>
        </div>
        <FeaturedSocialCourse onOpen={onCourse} />
      </section>
      <section className="social-editorial">
        <span className="social-kicker">LEARN. MAKE. REFINE.</span>
        <h2>
          AI 幫你開始，
          <br />
          判斷力讓你走下去。
        </h2>
        <div>
          <p>我們相信，實作不是複製一個成功故事。是把工具用在自己的經驗上，提出問題，檢查結果，再一步步改好。</p>
          <p>少一點術語，多一點可落實的練習。不承諾收入，也不把別人的生意當作速成答案。</p>
          <button className="button secondary" onClick={onCourse}>
            認識這條學習路線 <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}

export function FeaturedSocialCourse({ onOpen }: { onOpen: () => void }) {
  return (
    <article className="featured-social">
      <button className="featured-art" aria-label={`查看${socialCourseTitle}`} onClick={onOpen}>
        <ContentStudio compact />
      </button>
      <div className="featured-copy">
        <span className="planning-badge">新課程規劃 · 製作中</span>
        <span className="social-kicker">CHATGPT × SOCIAL CONTENT</span>
        <h2>
          <button onClick={onOpen}>{socialCourseTitle}</button>
        </h2>
        <p>從內容靈感、貼文與短片，到半自動流程及副業提案。把每一次練習，累積成自己的方法。</p>
        <div className="planned-facts">
          <span>
            <BookOpen size={17} /> 規劃 7 章 · 28 課
          </span>
          <span>零基礎起步</span>
          <span>繁體中文</span>
        </div>
        <div className="featured-bottom">
          <span>售價及開放日期待公布</span>
          <button className="button" onClick={onOpen}>
            查看課程規劃 <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function SocialCoursePage({ onCatalog }: { onCatalog: () => void }) {
  const [expanded, setExpanded] = useState<number[]>([0]);
  const allOpen = expanded.length === chapters.length;
  const [activeSection, setActiveSection] = useState('course-about');
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections = ['course-about', 'course-curriculum', 'course-resources', 'course-team', 'course-faq'];
        const current = sections
          .filter((id) => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 160)
          .at(-1);
        if (current) setActiveSection(current);
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      cancelAnimationFrame(frame);
    };
  }, []);
  function visit(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  }
  return (
    <div className="social-course-page">
      <div className="course-breadcrumb">
        <button onClick={onCatalog}>探索課程</button>
        <span>/</span>
        <span>社群行銷與 AI</span>
      </div>
      <div className="course-intro-grid">
        <div className="course-key-visual">
          <ContentStudio />
        </div>
        <div className="course-heading">
          <span className="social-kicker">CHATGPT × CONTENT × SIDE PROJECTS</span>
          <h1>{socialCourseTitle}</h1>
          <p>
            把下班後的想法，變成可持續的創作。
            <br />
            從寫出第一份草稿，到探索一個有需求的副業方向。
          </p>
          <div className="course-topic-tags">
            <span>ChatGPT</span>
            <span>社群內容</span>
            <span>零基礎</span>
            <span>副業探索</span>
          </div>
        </div>
      </div>
      <div className="course-detail-grid">
        <div className="course-detail-main">
          <nav className="course-anchor-nav" aria-label="課程內容導覽">
            {[
              ['course-about', '課程介紹'],
              ['course-curriculum', '課程章節'],
              ['course-resources', '規劃資源'],
              ['course-team', '教學理念'],
              ['course-faq', '常見問題'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={activeSection === id ? 'active' : ''}
                aria-current={activeSection === id ? 'location' : undefined}
                onClick={() => visit(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <section id="course-about" className="course-content-section">
            <span className="social-kicker">ABOUT THIS COURSE</span>
            <h2>
              想開始，卻不知道
              <br />
              先做哪一件事？
            </h2>
            <p>
              工具愈來愈多，真正困難的往往是把它們用在自己的生活。這門課規劃從一個內容目標開始，帶你練習寫作、圖像、短片與社群，再逐步整理工作流程。
            </p>
            <div className="outcome-grid">
              {[
                '把零散想法整理成內容方向',
                '修改 AI 草稿，保留自己的語氣',
                '規劃可以持續製作的社群內容',
                '用小規模提案驗證副業需求',
              ].map((text) => (
                <div key={text}>
                  <Check size={18} />
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div className="audience-note">
              <h3>這條路線適合你，如果你…</h3>
              <ul>
                <li>是忙碌的上班族，想把 AI 用在工作以外的創作。</li>
                <li>還未有社群定位，希望由一個清楚的方向開始。</li>
                <li>想探索副業，也願意先研究需求、成本與風險。</li>
              </ul>
            </div>
            <div className="lesson-preview" id="course-preview">
              <span className="preview-icon">
                <Clapperboard size={30} />
              </span>
              <div>
                <span className="planning-badge">第一課可審版已完成</span>
                <h3>先看一課，再了解這條路。</h3>
                <p>
                  從自己的簡短筆記開始：固定要求、比較三份草稿、選擇與修改、製作配圖，再換一份材料重做。第一課可審版已完成，整體課程仍在製作；本網站尚未開放播放。
                </p>
                <span className="preview-language">粵語配音與繁中字幕：可審版完成 · 普通話版本：尚未提供</span>
              </div>
            </div>
          </section>
          <section id="course-curriculum" className="course-content-section">
            <div className="curriculum-heading">
              <div>
                <span className="social-kicker">YOUR LEARNING ROADMAP</span>
                <h2>7 個章節，循序漸進。</h2>
                <p>28 課規劃草案 · 課題與交付順序可能調整</p>
              </div>
              <button className="text-button" onClick={() => setExpanded(allOpen ? [] : chapters.map((_, i) => i))}>
                {allOpen ? '收合全部' : '展開全部'}
              </button>
            </div>
            <div className="chapter-list">
              {chapters.map((chapter, index) => {
                const open = expanded.includes(index);
                return (
                  <article className={`chapter ${open ? 'expanded' : ''}`} key={chapter.title}>
                    <h3>
                      <button
                        aria-expanded={open}
                        aria-controls={`chapter-${index}`}
                        onClick={() =>
                          setExpanded((previous) => (open ? previous.filter((i) => i !== index) : [...previous, index]))
                        }
                      >
                        <span className="chapter-number">{String(index + 1).padStart(2, '0')}</span>
                        <span>
                          {chapter.title}
                          <small>4 課 · 製作規劃</small>
                        </span>
                        <ChevronDown size={20} />
                      </button>
                    </h3>
                    <div id={`chapter-${index}`} hidden={!open}>
                      <p className="chapter-outcome">練習目標：{chapter.outcome}</p>
                      <ol>
                        {chapter.lessons.map((lesson, i) => (
                          <li key={lesson}>
                            <span>
                              {index + 1}-{i + 1}
                            </span>
                            <span>{lesson}</span>
                            <small>規劃中</small>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section id="course-resources" className="course-content-section">
            <span className="social-kicker">THE SUPPORTING TOOLKIT</span>
            <h2>方法之外，還有實作的起點。</h2>
            <p>以下 18 項是配套規劃，尚未開放下載或加入。數量、內容及交付方式將在完成製作與核實後確認。</p>
            <div className="resource-groups">
              {resourceGroups.map((group) => (
                <article key={group.name}>
                  <h3>{group.name}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>
                        <FileText size={15} />
                        <span>{item}</span>
                        <small>規劃中</small>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
          <section id="course-team" className="course-content-section">
            <span className="social-kicker">OUR APPROACH</span>
            <h2>由真實問題開始教。</h2>
            <div className="team-panel">
              <div className="team-monogram" aria-hidden="true">
                ia<span>創科學苑</span>
              </div>
              <div>
                <h3>創科學苑 · 課程製作團隊</h3>
                <p>
                  以實作、查證及反覆修改為核心。示範會說明工具能做甚麼、哪些地方需要人工判斷，以及如何把方法用在自己的內容。
                </p>
                <p>
                  導師介紹與可核實的經歷將於課程上架前補充。案例會說明資料來源、適用情境與限制；個別成果並不代表每個人都會得到相同結果。
                </p>
              </div>
            </div>
          </section>
          <section id="course-faq" className="course-content-section">
            <span className="social-kicker">BEFORE YOU START</span>
            <h2>你可能想知道的事。</h2>
            <div className="social-faq">
              {courseFaqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <ChevronDown size={18} />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
        <aside className="course-enrollment-card" aria-label="課程開放資訊">
          <span className="planning-badge">製作中 · 尚未開放報名</span>
          <h2>
            為自己的下一步，
            <br />
            學一套實用方法。
          </h2>
          <p>從社群創作起步，逐步探索副業。</p>
          <div className="enrollment-price">
            <strong>售價待公布</strong>
            <span>以港幣 HKD 定價 · 尚未收費</span>
          </div>
          <button className="button" onClick={() => visit('course-curriculum')}>
            查看完整課程規劃 <ArrowRight size={17} />
          </button>
          <button className="button secondary" onClick={() => visit('course-preview')}>
            查看首課製作狀態
          </button>
          <dl>
            <div>
              <dt>課程結構</dt>
              <dd>規劃 7 章 · 28 課</dd>
            </div>
            <div>
              <dt>主要工具</dt>
              <dd>ChatGPT</dd>
            </div>
            <div>
              <dt>適合程度</dt>
              <dd>零基礎起步</dd>
            </div>
            <div>
              <dt>教材語言</dt>
              <dd>繁體中文</dd>
            </div>
            <div>
              <dt>開放日期</dt>
              <dd>確認後公布</dd>
            </div>
          </dl>
          <p className="enrollment-footnote">此頁為製作規劃，不會建立報名或消耗免費名額。課程不保證收入或接案成果。</p>
        </aside>
      </div>
      <div className="course-mobile-action">
        <div>
          <strong>新課程製作中</strong>
          <span>售價及日期待公布</span>
        </div>
        <button className="button" onClick={() => visit('course-curriculum')}>
          查看課綱 <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
