import { Router, Request, Response } from 'express';
import db from './db';
import axios from 'axios';

const router = Router();
const STUDENT_ID = 'student_001';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/focus-success';
const COINS_PER_SESSION = 50;

function todayDateStr() { return new Date().toISOString().slice(0, 10); }
function isYesterday(d: string | null) {
  if (!d) return false;
  const y = new Date(); y.setDate(y.getDate() - 1);
  return d === y.toISOString().slice(0, 10);
}

type VClock = Record<string, number>;

function vcMerge(a: VClock, b: VClock): VClock {
  const r: VClock = { ...a };
  for (const [k, v] of Object.entries(b)) r[k] = Math.max(r[k] ?? 0, v);
  return r;
}

function vcCompare(a: VClock, b: VClock): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aGtB = false, bGtA = false;
  for (const k of allKeys) {
    const av = a[k] ?? 0, bv = b[k] ?? 0;
    if (av > bv) aGtB = true;
    if (bv > av) bGtA = true;
  }
  if (aGtB && bGtA) return 2;
  if (aGtB) return 1;
  if (bGtA) return -1;
  return 0;
}

const STATUS_ORDER: Record<string, number> = { not_started: 0, in_progress: 1, done: 2 };

router.post('/sync/focus-sessions', async (req: Request, res: Response) => {
  const sessions: any[] = req.body.sessions || [];
  const results: any[] = [];
  for (const s of sessions) {
    const existing = db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(s.id) as any;
    if (!existing) {
      db.prepare(`INSERT INTO focus_sessions
        (id, student_id, target_minutes, status, fail_reason, started_at, ended_at, device_id, reward_applied, notification_sent)
        VALUES (?,?,?,?,?,?,?,?,0,0)`)
        .run(s.id, STUDENT_ID, s.target_minutes, s.status, s.fail_reason ?? null, s.started_at, s.ended_at ?? null, s.device_id);
      if (s.status === 'success') await applyRewards(s.id, s.target_minutes, s.device_id);
      results.push({ id: s.id, action: 'inserted' });
    } else {
      results.push({ id: s.id, action: 'already_exists' });
    }
  }
  res.json({ ok: true, results });
});

async function applyRewards(sessionId: string, targetMinutes: number, deviceId: string) {
  const session = db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(sessionId) as any;
  if (!session || session.reward_applied === 1) return;
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(STUDENT_ID) as any;
  const today = todayDateStr();
  let newStreak = student.streak;
  let newFocusMinutes = student.today_focus_minutes;
  if (student.last_focus_date !== today) newFocusMinutes = 0;
  newFocusMinutes += targetMinutes;
  if (student.last_focus_date === today) {}
  else if (isYesterday(student.last_focus_date)) newStreak += 1;
  else newStreak = 1;
  db.prepare(`UPDATE students SET coins=coins+?, streak=?, last_focus_date=?, today_focus_minutes=?, updated_at=? WHERE id=?`)
    .run(COINS_PER_SESSION, newStreak, today, newFocusMinutes, Date.now(), STUDENT_ID);
  db.prepare('UPDATE focus_sessions SET reward_applied=1 WHERE id=?').run(sessionId);
  if (session.notification_sent === 0) {
    db.prepare('UPDATE focus_sessions SET notification_sent=1 WHERE id=?').run(sessionId);
    const updatedStudent = db.prepare('SELECT * FROM students WHERE id=?').get(STUDENT_ID) as any;
    try {
      await axios.post(N8N_WEBHOOK_URL, {
        sessionId, studentId: STUDENT_ID, deviceId, targetMinutes,
        streak: updatedStudent.streak, coinsEarned: COINS_PER_SESSION, totalCoins: updatedStudent.coins,
      }, { timeout: 5000 });
      console.log(`[n8n] Webhook fired for session ${sessionId}`);
    } catch (e) {
      console.warn('[n8n] webhook failed (non-fatal):', (e as any).message);
    }
  }
}

router.post('/sync/tasks', (req: Request, res: Response) => {
  const tasks: any[] = req.body.tasks || [];
  const results: any[] = [];
  for (const t of tasks) {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(t.id) as any;
    const inVC: VClock = typeof t.device_clock === 'string' ? JSON.parse(t.device_clock) : (t.device_clock || {});
    if (!existing) {
      db.prepare(`INSERT INTO tasks (id, chapter_id, student_id, name, status, deleted, updated_at, device_clock)
        VALUES (?,?,?,?,?,?,?,?)`)
        .run(t.id, t.chapter_id, STUDENT_ID, t.name, t.status, t.deleted ? 1 : 0, t.updated_at, JSON.stringify(inVC));
      results.push({ id: t.id, action: 'inserted' });
      continue;
    }
    const exVC: VClock = JSON.parse(existing.device_clock || '{}');
    const cmp = vcCompare(inVC, exVC);
    const mergedVC = vcMerge(inVC, exVC);
    console.log(`[tasks] id=${t.id} cmp=${cmp} inVC=${JSON.stringify(inVC)} exVC=${JSON.stringify(exVC)}`);
    if (cmp === 2) {
      let resolvedStatus = existing.status;
      let resolvedDeleted = existing.deleted;
      if (t.deleted || existing.deleted) {
        resolvedDeleted = 1;
      } else {
        resolvedStatus = STATUS_ORDER[t.status] >= STATUS_ORDER[existing.status] ? t.status : existing.status;
      }
      db.prepare(`UPDATE tasks SET status=?, deleted=?, updated_at=?, device_clock=? WHERE id=?`)
        .run(resolvedStatus, resolvedDeleted, Math.max(t.updated_at, existing.updated_at), JSON.stringify(mergedVC), t.id);
      results.push({ id: t.id, action: 'conflict_resolved', resolved: { status: resolvedStatus, deleted: resolvedDeleted } });
    } else if (cmp === 1) {
      db.prepare(`UPDATE tasks SET status=?, deleted=?, updated_at=?, device_clock=? WHERE id=?`)
        .run(t.status, t.deleted ? 1 : 0, t.updated_at, JSON.stringify(mergedVC), t.id);
      results.push({ id: t.id, action: 'updated_to_incoming' });
    } else {
      db.prepare('UPDATE tasks SET device_clock=? WHERE id=?').run(JSON.stringify(mergedVC), t.id);
      results.push({ id: t.id, action: 'kept_server' });
    }
  }
  res.json({ ok: true, results });
});

router.post('/sync/subjects', (req: Request, res: Response) => {
  const { subjects = [], chapters = [] } = req.body;
  for (const s of subjects) {
    const ex = db.prepare('SELECT * FROM subjects WHERE id=?').get(s.id) as any;
    if (!ex) db.prepare('INSERT INTO subjects (id,student_id,name,color,sort_order,deleted,updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(s.id, STUDENT_ID, s.name, s.color, s.sort_order, s.deleted ? 1 : 0, s.updated_at);
    else if (s.updated_at > ex.updated_at)
      db.prepare('UPDATE subjects SET name=?,color=?,sort_order=?,deleted=?,updated_at=? WHERE id=?')
        .run(s.name, s.color, s.sort_order, s.deleted ? 1 : 0, s.updated_at, s.id);
  }
  for (const c of chapters) {
    const ex = db.prepare('SELECT * FROM chapters WHERE id=?').get(c.id) as any;
    if (!ex) db.prepare('INSERT INTO chapters (id,subject_id,student_id,name,sort_order,deleted,updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(c.id, c.subject_id, STUDENT_ID, c.name, c.sort_order, c.deleted ? 1 : 0, c.updated_at);
    else if (c.updated_at > ex.updated_at)
      db.prepare('UPDATE chapters SET name=?,sort_order=?,deleted=?,updated_at=? WHERE id=?')
        .run(c.name, c.sort_order, c.deleted ? 1 : 0, c.updated_at, c.id);
  }
  res.json({ ok: true });
});

router.get('/sync/pull', (req: Request, res: Response) => {
  const since = parseInt((req.query.since as string) || '0');
  const student = db.prepare('SELECT * FROM students WHERE id=?').get(STUDENT_ID);
  const sessions = db.prepare('SELECT * FROM focus_sessions WHERE student_id=? AND created_at*1000>?').all(STUDENT_ID, since);
  const subjects = db.prepare('SELECT * FROM subjects WHERE student_id=? AND updated_at>?').all(STUDENT_ID, since);
  const chapters = db.prepare('SELECT * FROM chapters WHERE student_id=? AND updated_at>?').all(STUDENT_ID, since);
  const tasks = db.prepare('SELECT * FROM tasks WHERE student_id=? AND updated_at>?').all(STUDENT_ID, since);
  res.json({ student, sessions, subjects, chapters, tasks, serverTime: Date.now() });
});

router.get('/student', (_req: Request, res: Response) => {
  res.json(db.prepare('SELECT * FROM students WHERE id=?').get(STUDENT_ID));
});

export default router;
