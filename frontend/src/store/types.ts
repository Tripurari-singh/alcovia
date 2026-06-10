export type TaskStatus = 'not_started' | 'in_progress' | 'done';
export type SessionStatus = 'pending' | 'success' | 'failed';
export type FailReason = 'give_up' | 'app_switch' | null;

export interface Student {
  id: string;
  coins: number;
  streak: number;
  last_focus_date: string | null;
  today_focus_minutes: number;
  updated_at: number;
}

export interface FocusSession {
  id: string;
  student_id: string;
  target_minutes: number;
  status: SessionStatus;
  fail_reason: FailReason;
  started_at: number;
  ended_at: number | null;
  device_id: string;
  reward_applied: number;
  notification_sent: number;
  synced: boolean;
}

export interface Subject {
  id: string;
  student_id: string;
  name: string;
  color: string;
  sort_order: number;
  deleted: boolean;
  updated_at: number;
  synced: boolean;
}

export interface Chapter {
  id: string;
  subject_id: string;
  student_id: string;
  name: string;
  sort_order: number;
  deleted: boolean;
  updated_at: number;
  synced: boolean;
}

export interface Task {
  id: string;
  chapter_id: string;
  student_id: string;
  name: string;
  status: TaskStatus;
  deleted: boolean;
  updated_at: number;
  device_clock: Record<string, number>;
  synced: boolean;
}

export interface AppState {
  student: Student;
  sessions: FocusSession[];
  subjects: Subject[];
  chapters: Chapter[];
  tasks: Task[];
}
