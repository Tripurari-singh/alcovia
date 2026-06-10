import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../alcovia.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    coins INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    last_focus_date TEXT,
    today_focus_minutes INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    target_minutes INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','success','failed')),
    fail_reason TEXT CHECK(fail_reason IN ('give_up','app_switch') OR fail_reason IS NULL),
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    device_id TEXT NOT NULL,
    reward_applied INTEGER NOT NULL DEFAULT 0,
    notification_sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    sort_order INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','done')),
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    device_clock TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(chapter_id) REFERENCES chapters(id)
  );

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    processed_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// Seed default student
const existing = db.prepare('SELECT id FROM students WHERE id = ?').get('student_001');
if (!existing) {
  db.prepare(`INSERT INTO students (id, coins, streak, today_focus_minutes, updated_at)
    VALUES (?, 0, 0, 0, ?)`).run('student_001', Date.now());
}

export default db;
