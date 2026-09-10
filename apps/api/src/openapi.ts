const error = {
  description: '請求失敗',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const string = { type: 'string' },
  integer = { type: 'integer' };
const schemas: Record<string, unknown> = {
  Error: object({ error: object({ code: string, message: string, request_id: string }, ['code', 'message']) }),
  Register: object({
    email: { type: 'string', format: 'email' },
    name: { type: 'string', maxLength: 120 },
    password: { type: 'string', minLength: 12, maxLength: 72 },
  }),
  Login: object({ email: string, password: string, code: { type: 'string', pattern: '^[0-9]{6}$' } }, [
    'email',
    'password',
  ]),
  Email: object({ email: { type: 'string', format: 'email' } }),
  Token: object({ token: string }),
  Reset: object({ token: string, password: { type: 'string', minLength: 12, maxLength: 72 } }),
  Name: object({ name: string }),
  Code: object({ code: { type: 'string', pattern: '^[0-9]{6}$' } }),
  Unlock: object({ source: { type: 'string', enum: ['free', 'credits'] } }),
  Progress: object({ lesson_id: string, position_seconds: { type: 'integer', minimum: 0 }, read: { type: 'boolean' } }),
  Exam: object({ answers: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } } }),
  Checkout: object({ pack_id: string }),
  Reason: object({ reason: { type: 'string', minLength: 3, maxLength: 500 } }),
  Pack: object({
    name: string,
    credits: { type: 'integer', minimum: 1 },
    amount: { type: 'integer', minimum: 400, description: '港幣分' },
    active: { type: 'boolean' },
  }),
  Asset: object({
    name: string,
    content_type: { type: 'string', enum: ['video/mp4', 'application/pdf', 'image/png', 'image/jpeg'] },
  }),
  Course: object({
    title: string,
    subtitle: string,
    description: string,
    level: { type: 'string', enum: ['beginner', 'advanced', 'master'] },
    ai_tool: { type: 'string', enum: ['general', 'gemini', 'chatgpt', 'claude'] },
    duration_minutes: integer,
    credit_cost: integer,
    pass_score: { const: 80 },
    cpd: object({ status: { enum: ['unaccredited', 'pending'] } }),
    lessons: {
      type: 'array',
      items: object(
        {
          id: string,
          title: string,
          kind: { enum: ['text', 'video', 'attachment'] },
          content: string,
          asset_key: string,
        },
        ['id', 'title', 'kind', 'content'],
      ),
    },
    questions: {
      type: 'array',
      items: object({
        id: string,
        prompt: string,
        options: { type: 'array', items: string },
        answer: integer,
        explanation: string,
      }),
    },
  }),
};
schemas.User = object(
  {
    id: string,
    email: string,
    name: string,
    role: { enum: ['student', 'admin'] },
    verified: { type: 'boolean' },
    demo_access: { type: 'boolean' },
    mfa_enabled: { type: 'boolean' },
    mfa_verified: { type: 'boolean' },
  },
  ['id', 'email', 'name', 'role', 'verified', 'demo_access', 'mfa_enabled'],
);
schemas.AuthResponse = object({ user: { $ref: '#/components/schemas/User' } });
schemas.CourseSummary = object({
  id: string,
  title: string,
  subtitle: string,
  description: string,
  level: { enum: ['beginner', 'advanced', 'master'] },
  ai_tool: string,
  duration_minutes: integer,
  credit_cost: integer,
  lesson_count: integer,
  cpd: { type: 'object' },
  is_demo: { type: 'boolean' },
  enrolled: { type: 'boolean' },
});
schemas.CourseList = object({
  items: { type: 'array', items: { $ref: '#/components/schemas/CourseSummary' } },
  total: integer,
});
schemas.WalletResponse = object({
  balance: integer,
  frozen: integer,
  items: {
    type: 'array',
    items: object({
      id: string,
      user_id: string,
      batch_id: string,
      delta: integer,
      kind: string,
      reference_id: string,
      created_at: { type: 'string', format: 'date-time' },
    }),
  },
  total: integer,
});
schemas.ExamResult = object({
  id: string,
  score: integer,
  passed: { type: 'boolean' },
  certificate_id: { type: ['string', 'null'] },
  feedback: { type: 'array', items: object({ id: string, correct: { type: 'boolean' }, explanation: string }) },
});
schemas.Verification = object({
  id: string,
  name: string,
  title: string,
  issuer: string,
  completed_at: { type: 'string', format: 'date-time' },
  status: { enum: ['valid', 'revoked'] },
  cpd: { type: 'object' },
});
schemas.SignedUrl = object({ url: string });
const responseNames: Record<string, string> = {
  '/auth/login': 'AuthResponse',
  '/auth/refresh': 'AuthResponse',
  '/auth/me': 'AuthResponse',
  '/auth/mfa/confirm': 'AuthResponse',
  '/courses': 'CourseList',
  '/wallet': 'WalletResponse',
  'post /enrollments/{id}/attempts': 'ExamResult',
  '/verify/{id}': 'Verification',
  '/certificates/{id}/download': 'SignedUrl',
  '/enrollments/{id}/lessons/{lesson}/asset': 'SignedUrl',
};
type Spec = [string, string, string, string?, boolean?];
const specs: Spec[] = [
  ['post', '/auth/register', '建立帳戶', 'Register', true],
  ['post', '/auth/login', '登入', 'Login', true],
  ['post', '/auth/refresh', '輪替 refresh cookie', undefined, true],
  ['post', '/auth/logout', '登出所有裝置'],
  ['get', '/auth/me', '個人資料'],
  ['patch', '/auth/profile', '更新證書姓名', 'Name'],
  ['post', '/auth/verify', '驗證電郵', 'Token', true],
  ['post', '/auth/forgot-password', '要求重設密碼', 'Email', true],
  ['post', '/auth/reset-password', '重設密碼', 'Reset', true],
  ['post', '/auth/resend-verification', '重寄驗證', 'Email', true],
  ['post', '/auth/mfa/setup', '設定管理員驗證器'],
  ['post', '/auth/mfa/confirm', '確認驗證器', 'Code'],
  ['get', '/courses', '課程目錄', undefined, true],
  ['post', '/courses/{id}/unlock', '免費或點數解鎖', 'Unlock'],
  ['get', '/enrollments', '已解鎖課程'],
  ['get', '/enrollments/{id}', '教材及不含答案的題目'],
  ['put', '/enrollments/{id}/progress', '儲存續讀位置', 'Progress'],
  ['get', '/enrollments/{id}/lessons/{lesson}/asset', '授權媒體連結'],
  ['post', '/enrollments/{id}/attempts', '提交測驗', 'Exam'],
  ['get', '/enrollments/{id}/attempts', '測驗紀錄'],
  ['get', '/certificates', '我的證書'],
  ['get', '/certificates/{id}/download', '授權下載'],
  ['get', '/verify/{id}', '公開證書驗證（遮罩姓名）', undefined, true],
  ['get', '/credit-packs', '點數套裝', undefined, true],
  ['get', '/wallet', '餘額及流水'],
  ['get', '/orders', '我的訂單'],
  ['post', '/checkout', '建立 Stripe 結帳', 'Checkout'],
  ['get', '/admin/summary', '管理統計'],
  ['get', '/admin/courses', '管理課程'],
  ['post', '/admin/courses', '建立課程', 'Course'],
  ['put', '/admin/courses/{id}', '儲存草稿', 'Course'],
  ['post', '/admin/courses/{id}/publish', '發布不可變版本'],
  ['post', '/admin/courses/{id}/archive', '下架課程'],
  ['get', '/admin/packs', '管理點數套裝'],
  ['post', '/admin/packs', '建立套裝', 'Pack'],
  ['put', '/admin/packs/{id}', '更新套裝', 'Pack'],
  ['get', '/admin/orders', '管理訂單'],
  ['post', '/admin/orders/{id}/refund', '凍結點數並排程退款', 'Reason'],
  ['post', '/admin/orders/{id}/reconcile', 'Stripe 對帳'],
  ['get', '/admin/certificates', '管理證書'],
  ['post', '/admin/certificates/{id}/revoke', '撤銷證書', 'Reason'],
  ['post', '/admin/certificates/{id}/reissue', '重發證書', 'Reason'],
  ['get', '/admin/jobs', '工作狀態'],
  ['post', '/admin/jobs/{id}/retry', '重試失敗工作'],
  ['get', '/admin/cases', '例外個案'],
  ['post', '/admin/cases/{id}/close', '結束個案', 'Reason'],
  ['get', '/admin/audits', '操作稽核'],
  ['post', '/admin/assets', '建立上載連結', 'Asset'],
  ['get', '/config', '公開設定', undefined, true],
];
const paths: Record<string, Record<string, unknown>> = {};
for (const [method, path, summary, schema, isPublic] of specs) {
  const parameters: unknown[] = [...path.matchAll(/\{(.*?)\}/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: string,
  }));
  if (method === 'get' && !path.includes('{'))
    parameters.push(
      { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
    );
  if (method !== 'get')
    parameters.push({
      name: 'Origin',
      in: 'header',
      required: true,
      schema: string,
      description: '必須與 APP_URL origin 相同',
    });
  if (path === '/courses')
    parameters.push(
      { name: 'level', in: 'query', schema: { enum: ['beginner', 'advanced', 'master'] } },
      { name: 'ai_tool', in: 'query', schema: { enum: ['general', 'gemini', 'chatgpt', 'claude'] } },
    );
  const responseName = responseNames[`${method} ${path}`] || responseNames[path];
  const requestBody = schema
    ? { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } } }
    : undefined;
  paths[path] ??= {};
  paths[path][method] = {
    summary,
    description: path.startsWith('/admin') ? '需要管理員角色及已完成 MFA 的登入。' : undefined,
    security: isPublic ? [] : [{ cookieAuth: [] }],
    parameters,
    requestBody,
    responses: {
      '200': {
        description: '成功，JSON 回應',
        content: {
          'application/json': {
            schema: responseName
              ? { $ref: `#/components/schemas/${responseName}` }
              : { type: 'object', additionalProperties: true },
          },
        },
      },
      '201': { description: '已建立' },
      '400': error,
      '401': error,
      '403': error,
      '404': error,
      '409': error,
      '429': error,
      '503': error,
    },
  };
}
paths['/webhooks/stripe'] = {
  post: {
    summary: 'Stripe 已簽署付款事件',
    security: [],
    parameters: [{ in: 'header', name: 'Stripe-Signature', required: true, schema: string }],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
    responses: { '200': { description: '已接收' }, '400': error },
  },
};
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: '知行 AI 學習平台 API',
    version: '0.1.0',
    description: '所有金額為港幣分；點數為整數。課程合格只取決於測驗。正式 CPD 功能未啟用。',
  },
  servers: [{ url: '/api/v1' }],
  components: { securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' } }, schemas },
  paths,
};
