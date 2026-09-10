import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Upload, ArrowUpRight, RefreshCw } from 'lucide-react';
import { api, date, money, post } from './api';
import type { Certificate, Content, CourseDraft, Order, Pack, User } from './types';
import { PageTitle } from './App';
const newContent = (): Content => ({
  title: '',
  subtitle: '',
  description: '',
  level: 'beginner',
  ai_tool: 'general',
  duration_minutes: 30,
  credit_cost: 10,
  pass_score: 80,
  cpd: { status: 'unaccredited' },
  lessons: [{ id: crypto.randomUUID(), title: '第一個單元', kind: 'text', content: '' }],
  questions: [{ id: crypto.randomUUID(), prompt: '', options: ['', ''], answer: 0, explanation: '' }],
});
interface AdminData {
  courses: CourseDraft[];
  packs: Pack[];
  orders: Order[];
  certificates: Certificate[];
  jobs: { id: string; kind: string; status: string; attempts: number; last_error: string }[];
  cases: { id: string; kind: string; status: string; detail: string }[];
  audits: { id: string; action: string; target_id: string; created_at: string }[];
}
export function AdminPage({
  user,
  notify,
  onChanged,
}: {
  user: User;
  notify: (m: string) => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<keyof AdminData>('courses'),
    [data, setData] = useState<AdminData>({
      courses: [],
      packs: [],
      orders: [],
      certificates: [],
      jobs: [],
      cases: [],
      audits: [],
    }),
    [summary, setSummary] = useState<Record<string, number>>({}),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<{ id: string | null; content: Content; demo: boolean } | null>(null),
    [pack, setPack] = useState<Pack | null>(null),
    [reasonAction, setReasonAction] = useState<{ path: string; title: string } | null>(null),
    [reason, setReason] = useState(''),
    [offset, setOffset] = useState(0),
    [total, setTotal] = useState(0);
  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        api<Record<string, number>>('/admin/summary'),
        api<{ rows: AdminData[typeof tab]; count?: number }>(`/admin/${tab}?limit=20&offset=${offset}`),
      ]);
      setSummary(s);
      setTotal(r.count ?? r.rows.length);
      setData((old) => ({ ...old, [tab]: r.rows }));
    } catch (e) {
      notify((e as Error).message);
    }
  }, [tab, offset, notify]);
  useEffect(() => {
    if (user.mfa_enabled) void load();
  }, [load, user.mfa_enabled]);
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      notify(message);
      await load();
      onChanged();
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!user.mfa_enabled)
    return (
      <>
        <PageTitle title="管理後台" subtitle="請先在右上角的帳戶設定啟用雙重驗證。" />
        <div className="notice">管理員完成驗證器設定後，才可查看或修改營運資料。</div>
      </>
    );
  return (
    <>
      <PageTitle title="管理後台" subtitle="照顧每一段學習旅程，從這裡開始。" />
      <div className="admin-stats">
        {Object.entries({
          users: '學員帳戶',
          courses: '課程',
          enrollments: '報讀紀錄',
          certificates: '有效證書',
          failed_jobs: '失敗工作',
          open_cases: '待處理個案',
        }).map(([key, label]) => (
          <div className="panel" key={key}>
            <span>{label}</span>
            <strong>{summary[key] ?? '—'}</strong>
          </div>
        ))}
      </div>
      <div className="admin-toolbar">
        <div className="tabs">
          {Object.entries({
            courses: '課程',
            packs: '點數套裝',
            orders: '訂單',
            certificates: '證書',
            jobs: '背景工作',
            cases: '例外個案',
            audits: '操作紀錄',
          }).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'active' : ''}
              onClick={() => {
                setTab(key as keyof AdminData);
                setOffset(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="icon-button" aria-label="重新整理" onClick={() => void load()}>
          <RefreshCw size={18} />
        </button>
      </div>
      {tab === 'courses' && (
        <>
          <button className="button" onClick={() => setEditing({ id: null, content: newContent(), demo: false })}>
            <Plus size={17} />
            建立課程
          </button>
          <div className="admin-list">
            {data.courses.map((c) => (
              <div className="panel admin-row" key={c.id}>
                <div>
                  <h3>{c.draft.title}</h3>
                  <p>
                    {c.is_demo
                      ? '未公開示範課'
                      : c.archived
                        ? '已下架'
                        : c.published_version_id
                          ? '已有發布版本'
                          : '草稿'}{' '}
                    · {c.draft.credit_cost} 點
                  </p>
                </div>
                <div className="row-actions">
                  <button
                    className="button secondary small"
                    onClick={() => setEditing({ id: c.id, content: structuredClone(c.draft), demo: c.is_demo })}
                  >
                    編輯草稿
                  </button>
                  {!c.is_demo && (
                    <button
                      disabled={busy}
                      className="button small"
                      onClick={() => void action(() => post(`/admin/courses/${c.id}/publish`), '課程版本已發布。')}
                    >
                      發布新版本
                    </button>
                  )}
                  {!c.archived && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void action(() => post(`/admin/courses/${c.id}/archive`), '課程已下架。')}
                    >
                      下架
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'packs' && (
        <>
          <button
            className="button"
            onClick={() => setPack({ id: '', name: '', credits: 10, amount: 10000, active: false })}
          >
            <Plus size={17} />
            建立點數套裝
          </button>
          <div className="admin-list">
            {data.packs.map((p) => (
              <div className="panel admin-row" key={p.id}>
                <div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.credits} 點 · {money(p.amount)} · {p.active ? '已啟用' : '未啟用'}
                  </p>
                </div>
                <button className="button secondary small" onClick={() => setPack({ ...p })}>
                  編輯
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'orders' && (
        <div className="admin-list">
          {data.orders.map((o) => (
            <div className="panel admin-row" key={o.id}>
              <div>
                <h3>
                  {money(o.amount)} · {o.credits} 點
                </h3>
                <p>{o.id}</p>
                <p>
                  {o.status} · {date(o.created_at)}
                </p>
              </div>
              <div className="row-actions">
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => void action(() => post(`/admin/orders/${o.id}/reconcile`), '對帳完成。')}
                >
                  重新對帳
                </button>
                {o.status === 'paid' && (
                  <button
                    className="button small"
                    onClick={() => {
                      setReason('');
                      setReasonAction({ path: `/admin/orders/${o.id}/refund`, title: '審核整單退款' });
                    }}
                  >
                    整單退款
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'certificates' && (
        <div className="admin-list">
          {data.certificates.map((c) => (
            <div className="panel admin-row" key={c.id}>
              <div>
                <h3>
                  {c.name} · {c.title}
                </h3>
                <p>{c.id}</p>
                <p>{c.revoked_at ? '已撤銷' : c.pdf_key ? '已產生 PDF' : '製作中'}</p>
              </div>
              <div className="row-actions">
                {!c.revoked_at && (
                  <button
                    className="button secondary small"
                    onClick={() => {
                      setReason('');
                      setReasonAction({ path: `/admin/certificates/${c.id}/revoke`, title: '撤銷證書' });
                    }}
                  >
                    撤銷
                  </button>
                )}
                <button
                  className="button secondary small"
                  onClick={() => {
                    setReason('');
                    setReasonAction({ path: `/admin/certificates/${c.id}/reissue`, title: '按最新姓名重發證書' });
                  }}
                >
                  重發
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'jobs' && (
        <div className="admin-list">
          {data.jobs.map((j) => (
            <div className="panel admin-row" key={j.id}>
              <div>
                <h3>
                  {j.kind} · {j.status}
                </h3>
                <p>
                  {j.id} · 已嘗試 {j.attempts} 次
                </p>
                <p>{j.last_error}</p>
              </div>
              {j.status === 'failed' && (
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => void action(() => post(`/admin/jobs/${j.id}/retry`), '工作已重新排程。')}
                >
                  重試
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === 'cases' && (
        <div className="admin-list">
          {data.cases.map((c) => (
            <div className="panel admin-row" key={c.id}>
              <div>
                <h3>
                  {c.kind} · {c.status}
                </h3>
                <p>{c.detail}</p>
              </div>
              {c.status === 'open' && (
                <button
                  className="button secondary small"
                  onClick={() => {
                    setReason('');
                    setReasonAction({ path: `/admin/cases/${c.id}/close`, title: '記錄人工處理結果' });
                  }}
                >
                  結束個案
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === 'audits' && (
        <div className="panel">
          {data.audits.map((a) => (
            <div className="table-row" key={a.id}>
              <span>
                {a.action}
                <small>{a.target_id}</small>
              </span>
              <span>{date(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
      {!data[tab].length && <div className="empty-state">這裡還沒有紀錄。</div>}
      {total > 20 && (
        <div className="pagination">
          <button
            className="button secondary small"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            上一頁
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 20, total)} / {total}
          </span>
          <button
            className="button secondary small"
            disabled={offset + 20 >= total}
            onClick={() => setOffset(offset + 20)}
          >
            下一頁
          </button>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop">
          <section className="modal editor-modal" role="dialog" aria-modal="true" aria-label="課程編輯器">
            <CourseEditor
              value={editing.content}
              demo={editing.demo}
              notify={notify}
              onChange={(content) => setEditing({ ...editing, content })}
            />
            <div className="sticky-actions">
              <button className="button secondary" onClick={() => setEditing(null)}>
                取消
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  if (
                    await action(
                      () =>
                        api(`/admin/courses${editing.id ? `/${editing.id}` : ''}`, {
                          method: editing.id ? 'PUT' : 'POST',
                          body: JSON.stringify(editing.content),
                        }),
                      '草稿已儲存。',
                    )
                  )
                    setEditing(null);
                }}
              >
                <Save size={17} />
                儲存草稿
              </button>
            </div>
          </section>
        </div>
      )}
      {pack && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-label="點數套裝編輯">
            <h2>點數套裝</h2>
            <label>
              名稱
              <input value={pack.name} onChange={(e) => setPack({ ...pack, name: e.target.value })} />
            </label>
            <label>
              點數
              <input
                type="number"
                min="1"
                value={pack.credits}
                onChange={(e) => setPack({ ...pack, credits: Number(e.target.value) })}
              />
            </label>
            <label>
              港幣價格
              <input
                type="number"
                min="4"
                step="0.01"
                value={pack.amount / 100}
                onChange={(e) => setPack({ ...pack, amount: Math.round(Number(e.target.value) * 100) })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={pack.active}
                onChange={(e) => setPack({ ...pack, active: e.target.checked })}
              />
              啟用套裝
            </label>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setPack(null)}>
                取消
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  const { id, ...payload } = pack;
                  if (
                    await action(
                      () =>
                        api(`/admin/packs${id ? `/${id}` : ''}`, {
                          method: id ? 'PUT' : 'POST',
                          body: JSON.stringify(payload),
                        }),
                      '套裝已儲存。',
                    )
                  )
                    setPack(null);
                }}
              >
                儲存
              </button>
            </div>
          </section>
        </div>
      )}
      {reasonAction && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-label={reasonAction.title}>
            <h2>{reasonAction.title}</h2>
            <label>
              原因／處理紀錄
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={500} />
            </label>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setReasonAction(null)}>
                取消
              </button>
              <button
                className="button"
                disabled={busy || reason.trim().length < 3}
                onClick={async () => {
                  if (await action(() => post(reasonAction.path, { reason }), '操作已記錄。')) setReasonAction(null);
                }}
              >
                確認
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function CourseEditor({
  value: c,
  onChange,
  notify,
  demo,
}: {
  value: Content;
  onChange: (v: Content) => void;
  notify: (m: string) => void;
  demo: boolean;
}) {
  const set = (key: keyof Content, value: unknown) => onChange({ ...c, [key]: value });
  const [uploading, setUploading] = useState(false);
  async function upload(index: number, file: File) {
    if (file.size > 250 * 1024 * 1024) {
      notify('檔案不可大於 250MB');
      return;
    }
    setUploading(true);
    try {
      const r = await post<{ url: string; key: string }>('/admin/assets', { name: file.name, content_type: file.type });
      const response = await fetch(r.url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('上載失敗，請重試');
      set(
        'lessons',
        c.lessons.map((l, i) => (i === index ? { ...l, asset_key: r.key } : l)),
      );
      notify('檔案已上載。');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <>
      <h2>{demo ? '示範課草稿' : '課程編輯器'}</h2>
      <p className="muted">儲存草稿後，另按「發布新版本」才會更新公開課程。已報讀學員保留原版本。</p>
      <label>
        課程名稱
        <input value={c.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label>
        短句介紹
        <input value={c.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
      </label>
      <label>
        課程說明
        <textarea value={c.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <div className="form-grid">
        <label>
          級別
          <select value={c.level} onChange={(e) => set('level', e.target.value)}>
            <option value="beginner">入門</option>
            <option value="advanced">進階</option>
            <option value="master">精通</option>
          </select>
        </label>
        <label>
          AI 工具
          <select value={c.ai_tool} onChange={(e) => set('ai_tool', e.target.value)}>
            <option value="general">通用 AI 技能</option>
            <option value="gemini">Gemini</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude</option>
          </select>
        </label>
        <label>
          建議學習分鐘
          <input
            type="number"
            min="1"
            value={c.duration_minutes}
            onChange={(e) => set('duration_minutes', Number(e.target.value))}
          />
        </label>
        <label>
          解鎖點數
          <input
            type="number"
            min="1"
            value={c.credit_cost}
            onChange={(e) => set('credit_cost', Number(e.target.value))}
          />
        </label>
      </div>
      <label>
        CPD 認可狀態
        <select value={c.cpd.status} onChange={(e) => set('cpd', { status: e.target.value })}>
          <option value="unaccredited">尚未認可（不授予正式學分）</option>
          <option value="pending">申請中（不授予正式學分）</option>
        </select>
      </label>
      <h3>教材單元</h3>
      {c.lessons.map((l, i) => (
        <div className="editor-block" key={l.id}>
          <div className="editor-block-heading">
            <strong>單元 {i + 1}</strong>
            <button
              className="text-button"
              disabled={c.lessons.length <= 1}
              onClick={() =>
                set(
                  'lessons',
                  c.lessons.filter((_, n) => n !== i),
                )
              }
            >
              移除
            </button>
          </div>
          <label>
            單元名稱
            <input
              value={l.title}
              onChange={(e) =>
                set(
                  'lessons',
                  c.lessons.map((v, n) => (n === i ? { ...v, title: e.target.value } : v)),
                )
              }
            />
          </label>
          <label>
            教材類型
            <select
              value={l.kind}
              onChange={(e) =>
                set(
                  'lessons',
                  c.lessons.map((v, n) => (n === i ? { ...v, kind: e.target.value } : v)),
                )
              }
            >
              <option value="text">圖文／文字</option>
              <option value="video">影片 MP4</option>
              <option value="attachment">講義 PDF</option>
            </select>
          </label>
          <label>
            教材文字
            <textarea
              rows={5}
              value={l.content}
              onChange={(e) =>
                set(
                  'lessons',
                  c.lessons.map((v, n) => (n === i ? { ...v, content: e.target.value } : v)),
                )
              }
            />
          </label>
          {
            <label className="upload-label">
              <Upload size={17} />
              {uploading ? '上載中…' : l.asset_key ? '替換已上載檔案' : '上載教材（上限 250MB）'}
              <input
                type="file"
                disabled={uploading}
                accept={
                  l.kind === 'video'
                    ? 'video/mp4'
                    : l.kind === 'attachment'
                      ? 'application/pdf'
                      : 'image/png,image/jpeg'
                }
                onChange={(e) => {
                  if (e.target.files?.[0]) void upload(i, e.target.files[0]);
                }}
              />
            </label>
          }
        </div>
      ))}
      <button
        className="button secondary small"
        onClick={() =>
          set('lessons', [...c.lessons, { id: crypto.randomUUID(), title: '新單元', kind: 'text', content: '' }])
        }
      >
        <Plus size={16} />
        加入單元
      </button>
      <h3>評核題庫 · 80 分合格</h3>
      {c.questions.map((q, i) => (
        <div className="editor-block" key={q.id}>
          <div className="editor-block-heading">
            <strong>第 {i + 1} 題</strong>
            <button
              className="text-button"
              disabled={c.questions.length <= 1}
              onClick={() =>
                set(
                  'questions',
                  c.questions.filter((_, n) => n !== i),
                )
              }
            >
              移除
            </button>
          </div>
          <label>
            題目
            <input
              value={q.prompt}
              onChange={(e) =>
                set(
                  'questions',
                  c.questions.map((v, n) => (n === i ? { ...v, prompt: e.target.value } : v)),
                )
              }
            />
          </label>
          {q.options.map((option, j) => (
            <label key={j}>
              選項 {j + 1}
              <input
                value={option}
                onChange={(e) =>
                  set(
                    'questions',
                    c.questions.map((v, n) =>
                      n === i ? { ...v, options: v.options.map((o, k) => (k === j ? e.target.value : o)) } : v,
                    ),
                  )
                }
              />
            </label>
          ))}
          {q.options.length < 6 && (
            <button
              className="text-button"
              onClick={() =>
                set(
                  'questions',
                  c.questions.map((v, n) => (n === i ? { ...v, options: [...v.options, ''] } : v)),
                )
              }
            >
              ＋ 加入選項
            </button>
          )}
          <label>
            正確選項
            <select
              value={q.answer ?? 0}
              onChange={(e) =>
                set(
                  'questions',
                  c.questions.map((v, n) => (n === i ? { ...v, answer: Number(e.target.value) } : v)),
                )
              }
            >
              {q.options.map((_, j) => (
                <option value={j} key={j}>
                  選項 {j + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            答案解說
            <textarea
              value={q.explanation || ''}
              onChange={(e) =>
                set(
                  'questions',
                  c.questions.map((v, n) => (n === i ? { ...v, explanation: e.target.value } : v)),
                )
              }
            />
          </label>
        </div>
      ))}
      <button
        className="button secondary small"
        onClick={() =>
          set('questions', [
            ...c.questions,
            { id: crypto.randomUUID(), prompt: '', options: ['', ''], answer: 0, explanation: '' },
          ])
        }
      >
        <Plus size={16} />
        加入題目
      </button>
    </>
  );
}
