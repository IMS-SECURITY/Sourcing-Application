// Phase 4 — Firestore collection map + document shapes.
// Mirrors the previous SQL tables. Firestore has no joins, so documents carry
// denormalized display fields (e.g. `vacancy_role`, `candidate_name`).
// Dates are stored as ISO strings for plain date fields and Firestore
// Timestamps for created_at / updated_at.

export const COL = {
  profiles: "profiles",
  userRoles: "user_roles",
  appMeta: "app_meta",
  clients: "clients",
  vacancies: "vacancies",
  replacements: "replacement_employees",
  extensions: "extensions",
  candidates: "candidates",
  applications: "candidate_applications",
  interviews: "interviews",
  comments: "comments",
  stageHistory: "stage_history",
  notifications: "notifications",
  emailSendLog: "email_send_log",
  auditLogs: "audit_logs",
} as const;

export type AppRole =
  | "hr_admin"
  | "recruitment_manager"
  | "recruiter"
  | "hiring_manager"
  | "candidate"
  | "sourcer";

export const STAFF_ROLES: AppRole[] = [
  "hr_admin",
  "recruitment_manager",
  "recruiter",
  "hiring_manager",
  "sourcer",
];

export type PipelineStage =
  | "sourcing"
  | "screening"
  | "submitted"
  | "interviewing"
  | "offered"
  | "joined"
  | "rejected"
  | "on_hold";

export type VacancyLevel = "L1" | "L2" | "L3" | "L4";
export type VacancyStatus = "open" | "in_progress" | "on_hold" | "closed" | "cancelled";
export type VacancyType = "new_requirement" | "replacement";

/** Firestore Timestamp | ISO string — reads may return either. */
export type TimeLike = string | { seconds: number; nanoseconds: number };

type Base = { id: string; created_at?: TimeLike; updated_at?: TimeLike };

export type ProfileDoc = Base & {
  full_name: string;
  email: string;
  avatar_url: string | null;
  last_login_at?: TimeLike;
};

export type UserRolesDoc = { user_id: string; roles: AppRole[]; created_at?: TimeLike };

export type ClientDoc = Base & {
  name: string;
  contact_person: string | null;
  contact_email: string | null;
  notes: string | null;
  created_by: string | null;
  logo_url?: string | null;
};

export type VacancyDoc = Base & {
  role: string;
  description: string | null;
  client_id: string | null;
  client_name: string | null; // denormalized
  level: VacancyLevel;
  status: VacancyStatus;
  vacancy_type: VacancyType;
  openings: number;
  location: string | null;
  skills: string[];
  experience_min: number | null;
  experience_max: number | null;
  target_hiring_date: string | null; // ISO date
  deployment_deadline: string | null; // ISO date, from replacement rules
  hiring_manager_id: string | null;
  recruitment_manager_id: string | null;
  created_by: string | null;
  published: boolean; // drives the public /jobs listing
};

export type ReplacementDoc = Base & {
  vacancy_id: string;
  employee_name: string;
  employee_code: string | null;
  resignation_date: string;
  last_working_date: string;
  early_relieving_date: string | null;
  notice_period_days: number;
  deployment_deadline: string | null;
};

export type ExtensionDoc = Base & {
  vacancy_id: string;
  original_date: string;
  extended_date: string;
  reason: string;
  approval_notes: string | null;
  approved_by: string | null;
  approved_at?: TimeLike;
};

export type CandidateDoc = Base & {
  user_id: string | null; // Firebase uid when the candidate owns this record
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_company: string | null;
  current_title: string | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  notice_period_days: number | null;
  total_experience: number | null;
  skills: string[];
  linkedin_url: string | null;
  resume_url: string | null;
  source: string | null;
  notes: string | null;
  created_by: string | null;
};

export type ApplicationDoc = Base & {
  candidate_id: string;
  candidate_user_id: string | null; // denormalized owner for rules
  candidate_name: string | null;
  vacancy_id: string;
  vacancy_role: string | null; // denormalized
  stage: PipelineStage;
  score: number | null;
  assigned_recruiter: string | null;
  hiring_manager_feedback: string | null;
  rejection_reason: string | null;
  created_by: string | null;
};

export type InterviewDoc = Base & {
  application_id: string;
  candidate_user_id: string | null; // denormalized owner for rules
  vacancy_id: string | null;
  round_name: string | null;
  mode: string;
  scheduled_at: string; // ISO datetime
  duration_minutes: number;
  interviewer_ids: string[];
  room_id: string;
  external_link: string | null;
  status: string;
  rating: number | null;
  feedback: string | null;
  cancellation_reason: string | null;
  created_by: string;
};

export type CommentDoc = Base & {
  vacancy_id: string;
  author_id: string;
  kind: string;
  body: string;
};

export type StageHistoryDoc = Base & {
  application_id: string;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage;
  note: string | null;
  changed_by: string | null;
};

export type NotificationDoc = Base & {
  recipient_user_id: string | null;
  recipient_email: string;
  template: string;
  payload: Record<string, unknown>;
  status: string;
  error: string | null;
  sent_at?: TimeLike | null;
};

export type EmailSendLogDoc = Base & {
  recipient_user_id: string | null;
  recipient_email: string;
  template: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

export type AuditLogDoc = Base & {
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
};
