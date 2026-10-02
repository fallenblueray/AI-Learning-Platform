import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Home,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Sparkles,
  X,
  Award,
  Wallet as WalletIcon,
  ChevronRight,
  ShieldCheck,
  Clock,
  Check,
  CircleHelp,
  Settings,
} from 'lucide-react';
import { api, post, levelNames, levelEnglish, date, money } from './api';
import type { Certificate, Course, Enrollment, Level, Order, Pack, User, Wallet } from './types';
import { AuthPanel } from './AuthPanel';
import { LearningPage } from './LearningPage';
import { AdminPage } from './AdminPage';
import { AcademyHome, FirstLessonFeature, FirstLessonPage } from './AcademyPages';
import { useDialog } from './useDialog';
type Page = 'home' | 'first-lesson' | 'catalog' | 'learning' | 'wallet' | 'certificates' | 'profile' | 'admin';
const nav = [
  { id: 'home' as Page, label: '學苑首頁', icon: Home },
  { id: 'catalog' as Page, label: '探索課程', icon: BookOpen },
  { id: 'learning' as Page, label: '我的學習', icon: LayoutDashboard },
  { id: 'certificates' as Page, label: '我的證書', icon: Award },
  { id: 'wallet' as Page, label: '學習點數', icon: WalletIcon },
];
export function App() {
  const params = new URLSearchParams(location.search);
  const validPages = ['home', 'first-lesson', 'catalog', 'learning', 'wallet', 'certificates', 'profile', 'admin'];
  const initialPage = params.get('page');
  const [page, setPage] = useState<Page>(validPages.includes(initialPage || '') ? (initialPage as Page) : 'home');
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [authOpen, setAuthOpen] = useState(!!params.get('action'));
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState('');
  const [courses, setCourses] = useState<Course[]>([]),
    [enrollments, setEnrollments] = useState<Enrollment[]>([]),
    [wallet, setWallet] = useState<Wallet | null>(null),
    [certificates, setCertificates] = useState<Certificate[]>([]);
  const [level, setLevel] = useState<Level | 'all'>('all'),
    [tool, setTool] = useState('all'),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Course | null>(null),
    [activeEnrollment, setActiveEnrollment] = useState<string | null>(null),
    [fetching, setFetching] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const menuDialog = useDialog(menu, () => setMenu(false));
  const courseDialog = useDialog(!!selected, () => {
    if (!busy) setSelected(null);
  });
  const [config, setConfig] = useState({ demo_mode: false, test_payments: true });
  const notify = useCallback((message: string) => setToast(message), []);
  const reload = useCallback(async () => {
    setCatalogError('');
    const list = await api<{ items: Course[] }>('/courses?limit=100');
    setCourses(list.items);
    if (user) {
      const [e, w, c] = await Promise.all([
        api<{ items: Enrollment[] }>('/enrollments?limit=100'),
        api<Wallet>('/wallet'),
        api<{ items: Certificate[] }>('/certificates'),
      ]);
      setEnrollments(e.items);
      setWallet(w);
      setCertificates(c.items);
    }
  }, [user]);
  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => {})
      .finally(() => setLoadingUser(false));
    api<typeof config>('/config')
      .then(setConfig)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!loadingUser) {
      setFetching(true);
      reload()
        .catch((e) => {
          setCatalogError(e.message);
          notify(e.message);
        })
        .finally(() => setFetching(false));
    }
  }, [reload, loadingUser, notify]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const pendingCertificates = certificates.some((c) => !c.revoked_at && !c.pdf_key);
  useEffect(() => {
    if (!user || page !== 'certificates' || !pendingCertificates) return;
    let active = true;
    const timer = window.setInterval(() => {
      api<{ items: Certificate[] }>('/certificates')
        .then((result) => {
          if (active) setCertificates(result.items);
        })
        .catch(() => {
          /* Keep the pending state; a later poll can recover. */
        });
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, page, pendingCertificates]);
  function navigate(next: Page) {
    setPage(next);
    setMenu(false);
    setActiveEnrollment(null);
    history.pushState({}, '', `?page=${next}`);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const onPop = () => {
      const next = new URLSearchParams(location.search).get('page') || 'home';
      setPage(
        (['home', 'first-lesson', 'catalog', 'learning', 'wallet', 'certificates', 'profile', 'admin'].includes(next)
          ? next
          : 'home') as Page,
      );
      setMenu(false);
      setActiveEnrollment(null);
      setSelected(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    document.title = `${page === 'first-lesson' ? '第一個 AI 小工具' : nav.find((n) => n.id === page)?.label || '帳戶管理'} · 創科學苑`;
  }, [page]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menu]);
  async function unlock(source: 'free' | 'credits') {
    if (!selected) return;
    if (!user) {
      setSelected(null);
      setAuthOpen(true);
      return;
    }
    setBusy(true);
    try {
      const e = await post<Enrollment>(`/courses/${selected.id}/unlock`, { source });
      setSelected(null);
      await reload();
      setActiveEnrollment(e.id);
      setPage('learning');
      notify('課程已解鎖，開始你的學習旅程。');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await post('/auth/logout');
      setUser(null);
      setWallet(null);
      setEnrollments([]);
      setCertificates([]);
      navigate('home');
      notify('已登出');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (params.get('verify')) return <VerifyPage id={params.get('verify')!} />;
  const filtered = courses.filter(
    (c) =>
      (level === 'all' || c.level === level) &&
      (tool === 'all' || c.ai_tool === tool) &&
      `${c.title}${c.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳至主要內容
      </a>
      <aside ref={menuDialog} tabIndex={-1} id="main-navigation" className={`sidebar ${menu ? 'open' : ''}`}>
        <button className="mobile-nav-close icon-button" aria-label="關閉選單" onClick={() => setMenu(false)}>
          <X size={22} />
        </button>
        <a href="/" className="brand">
          <span className="brand-mark">
            <Sparkles size={23} />
          </span>
          <span>
            創科學苑
            <small>INNOVATE ACADEMY</small>
          </span>
        </a>
        <div className="workspace-label">從想法，到第一件作品</div>
        <nav aria-label="主要導覽">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              aria-current={page === n.id ? 'page' : undefined}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === 'learning' && enrollments.length > 0 && (
                <span aria-hidden="true" className="nav-count">
                  {enrollments.length}
                </span>
              )}
            </button>
          ))}
          {user?.role === 'admin' && (
            <button className={`nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')}>
              <Settings size={19} />
              管理後台
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles className="small-star" size={30} />
            <strong>每一步，都算進步。</strong>
            <p>
              為你的想法，
              <br />
              多打開一種可能。
            </p>
          </div>
          <button
            className="support-link"
            onClick={() => notify('完成測驗達 80 分即可獲得證書；觀看時間不限。如需協助，請聯絡課程主辦機構。')}
          >
            <CircleHelp size={17} />
            學習小幫手
            <ArrowUpRight size={16} />
          </button>
          <div className="sidebar-footer">
            給每一個好奇的你 <span>繁體中文</span>
          </div>
        </div>
      </aside>
      {menu && <button className="menu-backdrop" aria-label="關閉選單" onClick={() => setMenu(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="開啟選單"
              aria-expanded={menu}
              aria-controls="main-navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span>學習空間</span>
            <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.id === page)?.label || (page === 'first-lesson' ? '第一課實作' : '帳戶管理')}
            </strong>
          </div>
          <div className="top-actions">
            <span className="language-label">繁體中文</span>
            {user ? (
              <>
                <button className="balance-chip" onClick={() => navigate('wallet')}>
                  <Sparkles size={14} />
                  {wallet?.balance ?? 0}
                  <span>點數</span>
                </button>
                <button className="avatar" aria-label="帳戶設定" onClick={() => navigate('profile')}>
                  {user.name.slice(0, 1)}
                </button>
              </>
            ) : (
              <button className="button small" onClick={() => setAuthOpen(true)}>
                登入 / 註冊
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {page === 'home' && (
            <AcademyHome onStart={() => navigate('first-lesson')} onCatalog={() => navigate('catalog')} />
          )}
          {page === 'first-lesson' && <FirstLessonPage onCatalog={() => navigate('catalog')} />}
          {page === 'catalog' && (
            <>
              <div className="catalog-intro">
                <div className="eyebrow">PICK A PROJECT. MAKE IT YOURS.</div>
                <h1>從想做的事，找到想學的課。</h1>
                <p>從零開始，把 AI 用在你自己的小工具與想法上。</p>
              </div>
              {level !== 'advanced' &&
                level !== 'master' &&
                tool === 'all' &&
                (!search || 'AI新手不用怕分享卡小工具'.toLowerCase().includes(search.toLowerCase())) && (
                  <FirstLessonFeature onStart={() => navigate('first-lesson')} />
                )}
              <section className="path-row" aria-label="三個學習級別">
                {(['beginner', 'advanced', 'master'] as Level[]).map((l, i) => (
                  <button
                    key={l}
                    className={`path-item ${level === l ? 'selected' : ''}`}
                    onClick={() => setLevel(level === l ? 'all' : l)}
                  >
                    <span className={`path-number ${l}`}>0{i + 1}</span>
                    <div>
                      <strong>
                        {levelNames[l]}
                        <small>{levelEnglish[l]}</small>
                      </strong>
                      <p>{['先做出第一件作品', '把方法用在日常', '驗證需求，探索可能'][i]}</p>
                    </div>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </section>
              <section id="course-list" className="catalog-section">
                <div className="section-heading">
                  <div>
                    <h2>
                      平台課程 <span>{courses.length} 門可見課程</span>
                    </h2>
                    <p>不必一次學會所有，從你感興趣的開始。</p>
                  </div>
                  <div className="search-box">
                    <Search size={16} />
                    <input
                      aria-label="搜尋課程"
                      placeholder="搜尋課程或關鍵字"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="filter-bar">
                  <div className="tabs">
                    {(['all', 'beginner', 'advanced', 'master'] as const).map((l) => (
                      <button key={l} className={level === l ? 'active' : ''} onClick={() => setLevel(l)}>
                        {l === 'all' ? '所有課程' : levelNames[l]}
                      </button>
                    ))}
                  </div>
                  <select aria-label="AI 工具篩選" value={tool} onChange={(e) => setTool(e.target.value)}>
                    <option value="all">所有 AI 工具</option>
                    <option value="general">通用 AI 技能</option>
                    <option value="gemini">Gemini</option>
                    <option value="chatgpt">ChatGPT</option>
                    <option value="claude">Claude</option>
                  </select>
                </div>
                {catalogError ? (
                  <div className="empty-state" role="alert">
                    <h3>課程暫時未能載入</h3>
                    <p>{catalogError}</p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setFetching(true);
                        reload()
                          .catch((e) => setCatalogError(e.message))
                          .finally(() => setFetching(false));
                      }}
                    >
                      重新載入課程
                    </button>
                  </div>
                ) : fetching ? (
                  <div className="empty-state">正在載入課程…</div>
                ) : filtered.length ? (
                  <div className="course-grid">
                    {filtered.map((c, i) => (
                      <CourseCard
                        key={c.id}
                        course={c}
                        index={i}
                        onClick={() => {
                          const e = enrollments.find((e) => e.course_id === c.id);
                          if (e) {
                            setActiveEnrollment(e.id);
                            setPage('learning');
                          } else setSelected(c);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <BookOpen size={35} />
                    <h3>{courses.length ? '沒有符合的課程' : '下一段學習旅程，準備中。'}</h3>
                    <p>
                      {courses.length
                        ? '試試其他級別或關鍵字。'
                        : '正式課程經審核後會在這裡上架。受邀測試者登入後可查看示範課。'}
                    </p>
                    {!user && (
                      <button className="button secondary" onClick={() => setAuthOpen(true)}>
                        登入你的學習帳戶
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </section>
              <div className="trust-strip">
                <span>
                  <GraduationCap size={20} />
                  為零程式背景而設
                </span>
                <span>
                  <Clock size={19} />
                  隨時學習，自訂節奏
                </span>
                <span>
                  <Award size={19} />
                  留下每一步成長紀錄
                </span>
              </div>
              <p className="cpd-note">完成證書與正式 CPD 學分不同。未獲認可的課程不授予正式 CPD 學分。</p>
            </>
          )}
          {!['home', 'catalog', 'first-lesson'].includes(page) && !user && !loadingUser ? (
            <div className="empty-state">
              <ShieldCheck size={36} />
              <h2>登入，繼續你的學習旅程。</h2>
              <p>你的進度、點數與證書，都會妥善保存。</p>
              <button className="button" onClick={() => setAuthOpen(true)}>
                登入 / 註冊
                <ArrowRight size={17} />
              </button>
            </div>
          ) : null}
          {user &&
            page === 'learning' &&
            (activeEnrollment ? (
              <LearningPage
                id={activeEnrollment}
                notify={notify}
                onBack={() => {
                  setActiveEnrollment(null);
                  void reload();
                }}
                onComplete={() => void reload()}
              />
            ) : (
              <>
                <PageTitle title="我的學習" subtitle="每一次開始，都讓你離目標更近。" />
                {enrollments.length ? (
                  <div className="enrollment-list">
                    {enrollments.map((e) => (
                      <div className="enrollment-card" key={e.id}>
                        <div className={`course-mini ${e.course.level}`}>
                          <BookOpen />
                        </div>
                        <div className="enrollment-info">
                          <span className="eyebrow">
                            {levelNames[e.course.level]} · {e.completed_at ? '已完成' : '學習中'}
                          </span>
                          <h3>{e.course.title}</h3>
                          <p>
                            {e.progress.filter((p) => p.read).length} / {e.course.lesson_count} 單元已閱讀 ·
                            觀看時間不影響發證
                          </p>
                        </div>
                        <button className="button secondary" onClick={() => setActiveEnrollment(e.id)}>
                          {e.completed_at ? '重溫課程' : '繼續學習'}
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="你的第一門課，等你開始。"
                    text="每個級別都可以免費任選一課。"
                    action={() => navigate('catalog')}
                    label="探索課程"
                  />
                )}
              </>
            ))}
          {user && page === 'wallet' && <WalletPage wallet={wallet} notify={notify} />}
          {user && page === 'certificates' && (
            <>
              <PageTitle title="我的證書" subtitle="讓學習成果，成為看得見的成長。" />
              {certificates.length ? (
                <div className="certificate-grid">
                  {certificates.map((c) => (
                    <article key={c.id} className={`certificate-card ${c.revoked_at ? 'revoked' : ''}`}>
                      <div className="certificate-top">
                        <Award size={30} />
                        <span>{c.revoked_at ? '已撤銷' : '完成證書'}</span>
                      </div>
                      <h3>{c.title}</h3>
                      <p>
                        {c.name} · {date(c.completed_at)}
                      </p>
                      <p className="muted">不附正式 CPD 學分</p>
                      <button
                        className="button secondary"
                        disabled={!!c.revoked_at || !c.pdf_key}
                        onClick={async () => {
                          try {
                            const r = await api<{ url: string }>(`/certificates/${c.id}/download`);
                            window.open(r.url, '_blank', 'noopener');
                          } catch (e) {
                            notify((e as Error).message);
                          }
                        }}
                      >
                        {c.pdf_key ? '下載 PDF' : '證書製作中'}
                        <ArrowUpRight size={16} />
                      </button>
                      <a className="text-link" href={`?verify=${c.id}`} target="_blank" rel="noreferrer">
                        查核證書
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  title="把第一張證書，留給下一步。"
                  text="課程測驗達 80 分便可取得完成證書。"
                  action={() => navigate('catalog')}
                  label="探索課程"
                />
              )}
            </>
          )}
          {user && page === 'profile' && (
            <>
              <PageTitle title="帳戶設定" subtitle="管理你的個人資料與登入安全。" />
              <Profile user={user} update={setUser} notify={notify} />
              <button className="button secondary logout-button" onClick={logout}>
                <LogOut size={17} />
                登出所有裝置
              </button>
            </>
          )}
          {user && page === 'admin' && <AdminPage user={user} notify={notify} onChanged={() => void reload()} />}
        </main>
        <footer className="main-footer">
          <span>創科學苑 · Innovate Academy</span>
          <span>從好奇出發的 AI 實作學苑 {config.demo_mode && ' · 試行版本'}</span>
        </footer>
      </div>
      <nav className="mobile-bottom-nav" aria-label="手機快捷導覽">
        {nav.slice(0, 3).map((n) => (
          <button
            key={n.id}
            className={page === n.id ? 'active' : ''}
            aria-current={page === n.id ? 'page' : undefined}
            onClick={() => navigate(n.id)}
          >
            <n.icon size={20} />
            <span>{n.label}</span>
          </button>
        ))}
        <button
          className={page === 'profile' ? 'active' : ''}
          onClick={() => (user ? navigate('profile') : setAuthOpen(true))}
        >
          <Settings size={20} />
          <span>{user ? '我的帳戶' : '登入帳戶'}</span>
        </button>
      </nav>
      {selected && (
        <div className="modal-backdrop" onClick={() => !busy && setSelected(null)}>
          <section
            ref={courseDialog}
            tabIndex={-1}
            className="modal course-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-button" aria-label="關閉" onClick={() => setSelected(null)}>
              <X />
            </button>
            <span className="eyebrow">
              {levelNames[selected.level]} · {selected.is_demo ? '未公開示範課' : '實作學習'}
            </span>
            <h2 id="course-dialog-title">{selected.title}</h2>
            <div className={`detail-art ${selected.level}`}>
              <Sparkles size={42} />
              <span>LEARN / MAKE / EXPLORE</span>
              <strong>{selected.subtitle}</strong>
            </div>
            <p>{selected.description}</p>
            <div className="detail-facts">
              <span>
                <Clock size={18} />
                {selected.duration_minutes} 分鐘
              </span>
              <span>
                <BookOpen size={18} />
                {selected.lesson_count} 個單元
              </span>
              <span>
                <Award size={18} />
                測驗 80 分合格
              </span>
            </div>
            <h3>以自己的步伐，完成這門課</h3>
            <ol className="detail-steps">
              <li>解鎖整門課程與教材</li>
              <li>重溫內容，保留學習進度</li>
              <li>通過測驗，取得完成紀錄</li>
            </ol>
            <div className="notice">
              <ShieldCheck size={20} />
              <span>測驗達 80 分即可取得完成證書。不限次重考，不設觀看門檻。此課程不附正式 CPD 學分。</span>
            </div>
            <p className="muted">
              免費名額每帳戶每級一次，可解鎖整門課程，確認後不能更換。
              {user && enrollments.some((e) => e.course.level === selected.level && e.source === 'free')
                ? '你已使用此級免費名額。'
                : ''}
            </p>
            <div className="modal-actions">
              <button
                disabled={
                  busy || !!(user && enrollments.some((e) => e.course.level === selected.level && e.source === 'free'))
                }
                className="button"
                onClick={() => unlock('free')}
              >
                確認使用此級免費名額
                <ArrowRight size={16} />
              </button>
              {!selected.is_demo && (
                <button disabled={busy} className="button secondary" onClick={() => unlock('credits')}>
                  以 {selected.credit_cost} 點解鎖
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {authOpen && (
        <AuthPanel
          onClose={() => {
            setAuthOpen(false);
            history.replaceState({}, '', location.pathname);
          }}
          onLogin={(u) => {
            setUser(u);
            setAuthOpen(false);
            notify('歡迎回來，開始你的下一步。');
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="關閉通知" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function CourseCard({ course: c, index, onClick }: { course: Course; index: number; onClick: () => void }) {
  return (
    <article className="course-card">
      <button className={`course-cover ${c.level}`} aria-label={`查看 ${c.title}`} onClick={onClick}>
        <span className="cover-label">
          {levelEnglish[c.level]}
          <span>0{index + 1}</span>
        </span>
        <div className={`cover-shape shape-${c.level}`}>
          <span />
          <span />
          <span />
        </div>
        <div className="cover-bottom">
          <span>{c.ai_tool === 'general' ? 'AI ESSENTIALS' : c.ai_tool.toUpperCase()}</span>
          <ArrowUpRight size={21} />
        </div>
      </button>
      <div className="course-body">
        <div className="course-tags">
          <span className={`level-badge ${c.level}`}>{levelNames[c.level]}</span>
          <span>{c.is_demo ? '示範課 · 未公開' : '自主學習'}</span>
        </div>
        <h3>
          <button onClick={onClick}>{c.title}</button>
        </h3>
        <p>{c.subtitle}</p>
        <div className="course-meta">
          <span>
            <Clock size={14} />
            {c.duration_minutes} 分鐘
          </span>
          <span>
            <BookOpen size={14} />
            {c.lesson_count} 個單元
          </span>
        </div>
        <div className="course-footer">
          <span>
            {c.enrolled ? (
              <>
                <Check size={14} />
                已解鎖
              </>
            ) : c.is_demo ? (
              '免費體驗'
            ) : (
              `${c.credit_cost} 點數`
            )}
            <small>{!c.enrolled && !c.is_demo ? '每級可免費任選一課' : ''}</small>
          </span>
          <button aria-label={`開始 ${c.title}`} onClick={onClick}>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">YOUR LEARNING JOURNEY</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Empty({ title, text, action, label }: { title: string; text: string; action: () => void; label: string }) {
  return (
    <div className="empty-state">
      <BookOpen size={35} />
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="button secondary" onClick={action}>
        {label}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
function WalletPage({ wallet, notify }: { wallet: Wallet | null; notify: (m: string) => void }) {
  const [packs, setPacks] = useState<Pack[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [available, setAvailable] = useState(false),
    [test, setTest] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([
      api<{ items: Pack[]; available: boolean; test_mode: boolean }>('/credit-packs'),
      api<{ rows: Order[] }>('/orders'),
    ])
      .then(([p, o]) => {
        setPacks(p.items);
        setAvailable(p.available);
        setTest(p.test_mode);
        setOrders(o.rows);
      })
      .catch((e) => notify(e.message));
  }, [notify]);
  return (
    <>
      <PageTitle title="學習點數" subtitle="為下一段學習旅程，做好準備。" />
      <div className="wallet-banner">
        <div>
          <span>可用學習點數</span>
          <h2>
            {wallet?.balance || 0}
            <small>點</small>
          </h2>
          <p>不設到期日 · {wallet?.frozen || 0} 點退款處理中</p>
        </div>
        <Sparkles size={58} />
      </div>
      {test && <div className="notice">目前為測試付款模式，不會提供正式收費服務。</div>}
      <h2 className="subheading">選擇點數套裝</h2>
      {packs.length ? (
        <div className="pack-grid">
          {packs.map((p) => (
            <div className="panel" key={p.id}>
              <h3>{p.name}</h3>
              <strong className="pack-credits">
                {p.credits}
                <small> 點數</small>
              </strong>
              <p>{money(p.amount)}</p>
              <button
                className="button"
                disabled={!available || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await post<{ url: string }>('/checkout', { pack_id: p.id });
                    location.assign(r.url);
                  } catch (e) {
                    notify((e as Error).message);
                    setBusy(false);
                  }
                }}
              >
                前往安全付款
                <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel muted">點數套裝尚未開放。你仍可使用每級一次的免費選課名額。</div>
      )}
      <h2 className="subheading">點數紀錄</h2>
      <div className="panel">
        {wallet?.items.length ? (
          wallet.items.map((v) => (
            <div className="table-row" key={v.id}>
              <span>{v.kind === 'purchase' ? '購買點數' : v.kind === 'refund' ? '退款扣回' : '解鎖課程'}</span>
              <span className="muted">{date(v.created_at)}</span>
              <strong className={v.delta > 0 ? 'positive' : ''}>
                {v.delta > 0 ? '+' : ''}
                {v.delta}
              </strong>
            </div>
          ))
        ) : (
          <p className="muted">尚未有點數交易紀錄。</p>
        )}
      </div>
      <h2 className="subheading">付款訂單</h2>
      <div className="panel">
        {orders.length ? (
          orders.map((o) => (
            <div className="table-row" key={o.id}>
              <span>
                {o.credits} 點 · {money(o.amount)}
                <small>{o.id.slice(0, 8)}</small>
              </span>
              <span>{date(o.created_at)}</span>
              <span>
                {(
                  {
                    paid: '已付款',
                    pending: '等待付款',
                    expired: '已逾期',
                    refunded: '已退款',
                    refund_pending: '退款處理中',
                  } as Record<string, string>
                )[o.status] || o.status}
              </span>
            </div>
          ))
        ) : (
          <p className="muted">尚未有付款訂單。</p>
        )}
      </div>
      <p className="muted">退款需由管理員審核，限該訂單點數完全未使用的整單退款。</p>
    </>
  );
}
function Profile({ user, update, notify }: { user: User; update: (u: User) => void; notify: (m: string) => void }) {
  const [name, setName] = useState(user.name),
    [secret, setSecret] = useState(''),
    [code, setCode] = useState('');
  return (
    <div className="panel narrow">
      <label>
        電郵
        <input value={user.email} disabled />
      </label>
      <label>
        證書姓名
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </label>
      <button
        className="button"
        onClick={async () => {
          try {
            await api('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name }) });
            update({ ...user, name });
            notify('姓名已更新；舊證書需由管理員重發。');
          } catch (e) {
            notify((e as Error).message);
          }
        }}
      >
        儲存姓名
      </button>
      {!user.verified && (
        <button
          className="button secondary"
          onClick={() =>
            post('/auth/resend-verification', { email: user.email })
              .then(() => notify('驗證電郵已排程寄出。'))
              .catch((e) => notify(e.message))
          }
        >
          重寄驗證電郵
        </button>
      )}
      {user.role === 'admin' && !user.mfa_enabled && (
        <div className="mfa-setup">
          <h3>設定管理員雙重驗證</h3>
          <p>使用驗證器加入下列金鑰，再輸入六位數代碼。</p>
          {!secret ? (
            <button
              className="button secondary"
              onClick={() =>
                post<{ secret: string }>('/auth/mfa/setup')
                  .then((r) => setSecret(r.secret))
                  .catch((e) => notify(e.message))
              }
            >
              開始設定
            </button>
          ) : (
            <>
              <code>{secret}</code>
              <label>
                驗證代碼
                <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <button
                className="button"
                onClick={() =>
                  post<{ user: User }>('/auth/mfa/confirm', { code })
                    .then((r) => {
                      update({ ...r.user, mfa_verified: true });
                      notify('雙重驗證已啟用。');
                    })
                    .catch((e) => notify(e.message))
                }
              >
                確認啟用
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
function VerifyPage({ id }: { id: string }) {
  const [data, setData] = useState<{
      name: string;
      title: string;
      issuer: string;
      completed_at: string;
      status: string;
    } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    api<typeof data>(`/verify/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <div className="verify-shell">
      <a className="brand" href="/">
        <span className="brand-mark">
          <Sparkles />
        </span>
        創科學苑 <small>Innovate Academy</small>
      </a>
      <div className="panel verify-card">
        <ShieldCheck size={44} />
        <h1>證書驗證</h1>
        {error ? (
          <p role="alert">{error}</p>
        ) : data ? (
          <>
            <span className={`status-pill ${data.status === 'valid' ? '' : 'danger'}`}>
              {data.status === 'valid' ? '有效完成證書' : '此證書已撤銷'}
            </span>
            <h2>{data.title}</h2>
            <p>持有人：{data.name}</p>
            <p>完成日期：{date(data.completed_at)}</p>
            <p>發證機構：{data.issuer}</p>
            <small>證書編號：{id}</small>
            <div className="notice">此完成證書不代表已取得正式 CPD 學分。</div>
          </>
        ) : (
          <p>正在查核…</p>
        )}
      </div>
    </div>
  );
}
