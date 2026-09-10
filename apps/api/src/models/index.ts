import { Attributes, DataTypes as D, Model, ModelAttributes, ModelStatic } from 'sequelize';
import { sequelize } from '../database/connection';
export type Level = 'beginner' | 'advanced' | 'master';
export interface Lesson {
  id: string;
  title: string;
  kind: 'text' | 'video' | 'attachment';
  content: string;
  asset_key?: string;
}
export interface Question {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}
export interface Cpd {
  status: 'unaccredited' | 'pending' | 'accredited';
  authority?: string;
  code?: string;
  points?: number;
  valid_from?: string;
  valid_until?: string;
  requirements?: string;
}
export interface CourseContent {
  title: string;
  subtitle: string;
  description: string;
  level: Level;
  ai_tool: string;
  duration_minutes: number;
  credit_cost: number;
  lessons: Lesson[];
  questions: Question[];
  pass_score: number;
  cpd: Cpd;
}
interface Base {
  id: string;
  created_at: Date;
}
export interface UserRow extends Base {
  email: string;
  name: string;
  password_hash: string;
  role: 'student' | 'admin';
  verified: boolean;
  demo_access: boolean;
  token_version: number;
  totp_secret: string | null;
  totp_pending: string | null;
  totp_counter: number;
}
export interface SessionRow extends Base {
  user_id: string;
  token_hash: string;
  family: string;
  expires_at: Date;
  revoked: boolean;
  mfa: boolean;
}
export interface ActionTokenRow extends Base {
  user_id: string;
  token_hash: string;
  kind: string;
  expires_at: Date;
  consumed: boolean;
}
export interface CourseRow extends Base {
  draft: CourseContent;
  published_version_id: string | null;
  is_demo: boolean;
  archived: boolean;
}
export interface VersionRow extends Base {
  course_id: string;
  number: number;
  content: CourseContent;
}
export interface EnrollmentRow extends Base {
  user_id: string;
  course_id: string;
  version_id: string;
  source: string;
  completed_at: Date | null;
  certificate_id: string | null;
}
export interface FreePickRow extends Base {
  user_id: string;
  level: Level;
  course_id: string;
}
export interface ProgressRow extends Base {
  enrollment_id: string;
  lesson_id: string;
  position_seconds: number;
  read: boolean;
  updated_at: Date;
}
export interface PackRow extends Base {
  name: string;
  credits: number;
  amount: number;
  active: boolean;
}
export interface OrderRow extends Base {
  user_id: string;
  pack_id: string;
  credits: number;
  amount: number;
  status: string;
  stripe_session_id: string | null;
  payment_intent: string | null;
}
export interface BatchRow extends Base {
  user_id: string;
  order_id: string | null;
  original: number;
  remaining: number;
  frozen: boolean;
}
export interface LedgerRow extends Base {
  user_id: string;
  batch_id: string;
  delta: number;
  kind: string;
  reference_id: string;
}
export interface RefundRow extends Base {
  request_key: string | null;
  order_id: string;
  status: string;
  stripe_refund_id: string | null;
  reason: string;
}
export interface PaymentEventRow extends Base {
  type: string;
  object_id: string;
  status: string;
}
export interface AttemptRow extends Base {
  enrollment_id: string;
  score: number;
  answers: Record<string, number>;
  passed: boolean;
}
export interface CertificateRow extends Base {
  enrollment_id: string;
  name: string;
  title: string;
  issuer: string;
  completed_at: Date;
  cpd: Cpd;
  revoked_at: Date | null;
  revoke_reason: string | null;
  supersedes_id: string | null;
  pdf_key: string | null;
}
export interface JobRow extends Base {
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  available_at: Date;
  locked_at: Date | null;
  lock_token: string | null;
  last_error: string | null;
}
export interface AuditRow extends Base {
  actor_id: string | null;
  action: string;
  target_id: string;
  detail: Record<string, unknown>;
}
export interface CaseRow extends Base {
  order_id: string | null;
  kind: string;
  status: string;
  detail: string;
}
const id = { type: D.STRING(64), primaryKey: true, allowNull: false };
const str = (size = 255) => ({ type: D.STRING(size), allowNull: false });
const int = (value = 0) => ({ type: D.INTEGER, allowNull: false, defaultValue: value });
const flag = (value = false) => ({ type: D.BOOLEAN, allowNull: false, defaultValue: value });
const nullable = (type: typeof D.DATE | ReturnType<typeof D.STRING>) => ({ type, allowNull: true });
const json = { type: D.JSON, allowNull: false };
type Entity<T extends Base> = Model<T, Partial<T>> & T;
function define<T extends Base>(
  name: string,
  fields: ModelAttributes<Model>,
  unique: string[][] = [],
): ModelStatic<Entity<T>> {
  const attributes = {
    id,
    created_at: { type: D.DATE(3), allowNull: false, defaultValue: D.NOW },
    ...fields,
  } as ModelAttributes<Entity<T>, Attributes<Entity<T>>>;
  return sequelize.define<Entity<T>>(name, attributes, {
    tableName: name,
    indexes: unique.map((fields) => ({ unique: true, fields })),
  });
}
export const User = define<UserRow>(
  'users',
  {
    email: str(),
    name: str(120),
    password_hash: str(),
    role: str(20),
    verified: flag(),
    demo_access: flag(),
    token_version: int(),
    totp_secret: nullable(D.STRING(512)),
    totp_pending: nullable(D.STRING(512)),
    totp_counter: int(-1),
  },
  [['email']],
);
export const Session = define<SessionRow>(
  'sessions',
  {
    user_id: str(64),
    token_hash: str(64),
    family: str(64),
    expires_at: { type: D.DATE, allowNull: false },
    revoked: flag(),
    mfa: flag(),
  },
  [['token_hash']],
);
export const ActionToken = define<ActionTokenRow>(
  'action_tokens',
  {
    user_id: str(64),
    token_hash: str(64),
    kind: str(20),
    expires_at: { type: D.DATE, allowNull: false },
    consumed: flag(),
  },
  [['token_hash']],
);
export const Course = define<CourseRow>('courses', {
  draft: json,
  published_version_id: nullable(D.STRING(64)),
  is_demo: flag(true),
  archived: flag(),
});
export const Version = define<VersionRow>('course_versions', { course_id: str(64), number: int(1), content: json }, [
  ['course_id', 'number'],
]);
export const Enrollment = define<EnrollmentRow>(
  'enrollments',
  {
    user_id: str(64),
    course_id: str(64),
    version_id: str(64),
    source: str(20),
    completed_at: nullable(D.DATE),
    certificate_id: nullable(D.STRING(64)),
  },
  [['user_id', 'course_id']],
);
export const FreePick = define<FreePickRow>('free_picks', { user_id: str(64), level: str(20), course_id: str(64) }, [
  ['user_id', 'level'],
]);
export const Progress = define<ProgressRow>(
  'progress',
  {
    enrollment_id: str(64),
    lesson_id: str(64),
    position_seconds: int(),
    read: flag(),
    updated_at: { type: D.DATE, allowNull: false },
  },
  [['enrollment_id', 'lesson_id']],
);
export const Pack = define<PackRow>('credit_packs', { name: str(120), credits: int(), amount: int(), active: flag() });
export const Order = define<OrderRow>(
  'orders',
  {
    user_id: str(64),
    pack_id: str(64),
    credits: int(),
    amount: int(),
    status: str(32),
    stripe_session_id: nullable(D.STRING(255)),
    payment_intent: nullable(D.STRING(255)),
  },
  [['stripe_session_id']],
);
export const Batch = define<BatchRow>(
  'credit_batches',
  { user_id: str(64), order_id: nullable(D.STRING(64)), original: int(), remaining: int(), frozen: flag() },
  [['order_id']],
);
export const Ledger = define<LedgerRow>('credit_ledger', {
  user_id: str(64),
  batch_id: str(64),
  delta: int(),
  kind: str(32),
  reference_id: str(64),
});
export const Refund = define<RefundRow>(
  'refunds',
  {
    order_id: str(64),
    status: str(32),
    stripe_refund_id: nullable(D.STRING(255)),
    reason: str(500),
    request_key: nullable(D.STRING(64)),
  },
  [['order_id']],
);
export const PaymentEvent = define<PaymentEventRow>('payment_events', {
  type: str(80),
  object_id: str(255),
  status: str(32),
});
export const Attempt = define<AttemptRow>('attempts', {
  enrollment_id: str(64),
  score: int(),
  answers: json,
  passed: flag(),
});
export const Certificate = define<CertificateRow>('certificates', {
  enrollment_id: str(64),
  name: str(120),
  title: str(),
  issuer: str(),
  completed_at: { type: D.DATE, allowNull: false },
  cpd: json,
  revoked_at: nullable(D.DATE),
  revoke_reason: nullable(D.STRING(500)),
  supersedes_id: nullable(D.STRING(64)),
  pdf_key: nullable(D.STRING(255)),
});
export const Job = define<JobRow>('jobs', {
  kind: str(40),
  payload: json,
  status: str(20),
  attempts: int(),
  available_at: { type: D.DATE, allowNull: false },
  locked_at: nullable(D.DATE),
  lock_token: nullable(D.STRING(64)),
  last_error: nullable(D.STRING(255)),
});
export const Audit = define<AuditRow>('audit_logs', {
  actor_id: nullable(D.STRING(64)),
  action: str(80),
  target_id: str(255),
  detail: json,
});
export const ReviewCase = define<CaseRow>('review_cases', {
  order_id: nullable(D.STRING(64)),
  kind: str(50),
  status: str(20),
  detail: str(500),
});
export const models = [
  User,
  Session,
  ActionToken,
  Course,
  Version,
  Enrollment,
  FreePick,
  Progress,
  Pack,
  Order,
  Batch,
  Ledger,
  Refund,
  PaymentEvent,
  Attempt,
  Certificate,
  Job,
  Audit,
  ReviewCase,
];
