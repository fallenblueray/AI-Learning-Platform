export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
  verified: boolean;
  demo_access: boolean;
  mfa_enabled: boolean;
  mfa_verified?: boolean;
}
export type Level = 'beginner' | 'advanced' | 'master';
export interface Cpd {
  status: 'unaccredited' | 'pending' | 'accredited';
  points?: number;
}
export interface Course {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  level: Level;
  ai_tool: string;
  duration_minutes: number;
  credit_cost: number;
  lesson_count: number;
  cpd: Cpd;
  is_demo: boolean;
  enrolled: boolean;
}
export interface Lesson {
  id: string;
  title: string;
  kind: 'text' | 'video' | 'attachment';
  content: string;
  has_asset?: boolean;
  asset_key?: string;
}
export interface Question {
  id: string;
  prompt: string;
  options: string[];
  answer?: number;
  explanation?: string;
}
export interface Content {
  title: string;
  subtitle: string;
  description: string;
  level: Level;
  ai_tool: string;
  duration_minutes: number;
  credit_cost: number;
  pass_score: number;
  cpd: Cpd;
  lessons: Lesson[];
  questions: Question[];
}
export interface Progress {
  lesson_id: string;
  position_seconds: number;
  read: boolean;
}
export interface Enrollment {
  id: string;
  course_id: string;
  completed_at: string | null;
  certificate_id: string | null;
  source: string;
  course: Course;
  progress: Progress[];
}
export interface Learning extends Omit<Enrollment, 'course'> {
  content: Content;
}
export interface Certificate {
  id: string;
  name: string;
  title: string;
  issuer: string;
  completed_at: string;
  revoked_at: string | null;
  pdf_key: string | null;
}
export interface Wallet {
  balance: number;
  frozen: number;
  items: { id: string; delta: number; kind: string; created_at: string }[];
  total: number;
}
export interface Order {
  id: string;
  credits: number;
  amount: number;
  status: string;
  created_at: string;
}
export interface Pack {
  id: string;
  name: string;
  credits: number;
  amount: number;
  active: boolean;
}
export interface CourseDraft {
  id: string;
  draft: Content;
  is_demo: boolean;
  archived: boolean;
  published_version_id: string | null;
}
