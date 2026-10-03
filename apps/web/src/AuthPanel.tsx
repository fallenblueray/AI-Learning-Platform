import { useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { post } from './api';
import type { User } from './types';
import { useDialog } from './useDialog';
export function AuthPanel({ onClose, onLogin }: { onClose: () => void; onLogin: (u: User) => void }) {
  const dialog = useDialog(true, onClose);
  const query = new URLSearchParams(location.search);
  const action = query.get('action');
  const [mode, setMode] = useState(action === 'verify' ? 'verify' : action === 'reset' ? 'reset' : 'login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'login') {
        const r = await post<{ user: User }>('/auth/login', { email, password, ...(code ? { code } : {}) });
        onLogin(r.user);
      } else if (mode === 'register') {
        const r = await post<{ message: string }>('/auth/register', { email, password, name });
        setMessage(r.message);
        setMode('login');
      } else if (mode === 'forgot') {
        const r = await post<{ message: string }>('/auth/forgot-password', { email });
        setMessage(r.message);
      } else if (mode === 'verify') {
        const r = await post<{ message: string }>('/auth/verify', { token: query.get('token') });
        setMessage(r.message);
        setMode('login');
      } else if (mode === 'reset') {
        const r = await post<{ message: string }>('/auth/reset-password', { token: query.get('token'), password });
        setMessage(r.message);
        setMode('login');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const titles: Record<string, string> = {
    login: '歡迎回來。',
    register: '從今天，開始成長。',
    forgot: '重新找回你的帳戶。',
    verify: '確認你的電郵。',
    reset: '設定新密碼。',
  };
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        tabIndex={-1}
        className="modal auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button className="close-button" aria-label="關閉" onClick={onClose}>
          <X />
        </button>
        <span className="brand-mark">
          <Sparkles />
        </span>
        <h2 id="auth-title">{titles[mode]}</h2>
        <p>一個帳戶，收藏你的每一步學習。</p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              證書姓名
              <input
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                placeholder="請填寫證書上使用的姓名"
              />
            </label>
          )}
          {['login', 'register', 'forgot'].includes(mode) && (
            <label>
              電郵地址
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </label>
          )}
          {['login', 'register', 'reset'].includes(mode) && (
            <label>
              密碼
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'login' ? 1 : 12}
                maxLength={72}
                placeholder="至少 12 個字元"
              />
            </label>
          )}
          {mode === 'login' && (
            <details>
              <summary>管理員驗證代碼</summary>
              <label>
                驗證器六位數代碼
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  pattern="[0-9]{6}"
                  maxLength={6}
                />
              </label>
            </details>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          <button className="button full" disabled={busy}>
            {busy
              ? '處理中…'
              : mode === 'login'
                ? '登入'
                : mode === 'register'
                  ? '建立帳戶'
                  : mode === 'verify'
                    ? '驗證電郵'
                    : '提交'}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-links">
          {mode === 'login' ? (
            <>
              <button
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                還未有帳戶？立即註冊
              </button>
              <button
                onClick={() => {
                  setMode('forgot');
                  setError('');
                }}
              >
                忘記密碼
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              返回登入
            </button>
          )}
        </div>
        <p className="fine-print">每級可免費任選一課。完成課程須通過測驗；未獲認可課程不授予正式 CPD 學分。</p>
      </section>
    </div>
  );
}
