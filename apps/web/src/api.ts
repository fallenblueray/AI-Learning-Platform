export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
let refreshing: Promise<boolean> | null = null;
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch {
    throw new ApiError('未能連接平台伺服器，請重新啟動本機平台後再試。', 'API_UNAVAILABLE', 503);
  }
  if (response.status === 401 && retry && (!path.startsWith('/auth/') || path === '/auth/me')) {
    if (!refreshing)
      refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
        .then((r) => r.ok)
        .finally(() => {
          refreshing = null;
        });
    if (await refreshing) return api(path, options, false);
  }
  const data = await response.json().catch(() => {
    throw new ApiError('平台伺服器暫時未能回應，請稍後再試。', 'API_UNAVAILABLE', 503);
  });
  if (!response.ok)
    throw new ApiError(data.error?.message || '連線未能完成', data.error?.code || 'REQUEST_FAILED', response.status);
  return data as T;
}
export const post = <T>(path: string, data?: unknown) =>
  api<T>(path, { method: 'POST', ...(data ? { body: JSON.stringify(data) } : {}) });
export const money = (cents: number) =>
  new Intl.NumberFormat('zh-HK', { style: 'currency', currency: 'HKD', maximumFractionDigits: 0 }).format(cents / 100);
export const date = (s: string) => new Date(s).toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
export const levelNames = { beginner: '入門', advanced: '進階', master: '精通' };
export const levelEnglish = { beginner: 'BEGINNER', advanced: 'ADVANCED', master: 'MASTER' };
