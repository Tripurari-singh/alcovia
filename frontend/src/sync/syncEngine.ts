import { AppState, FocusSession, Task, Subject, Chapter, Student } from '../store/types';
import { vcMerge, vcAfter, vcConcurrent } from './vectorClock';
import { DEVICE_ID } from '../store/storage';

const BASE_URL = 'http://localhost:3001/api';
const STUDENT_ID = 'student_001';
const STATUS_ORDER: Record<string, number> = { not_started: 0, in_progress: 1, done: 2 };

export async function pushChanges(state: AppState): Promise<void> {
  // Push unsynced sessions
  const unsyncedSessions = state.sessions.filter(s => !s.synced);
  if (unsyncedSessions.length > 0) {
    const res = await fetch(`${BASE_URL}/sync/focus-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: unsyncedSessions }),
    });
    if (!res.ok) throw new Error('Session sync failed');
  }

  // Push unsynced subjects & chapters
  const unsyncedSubjects = state.subjects.filter(s => !s.synced);
  const unsyncedChapters = state.chapters.filter(c => !c.synced);
  if (unsyncedSubjects.length > 0 || unsyncedChapters.length > 0) {
    await fetch(`${BASE_URL}/sync/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjects: unsyncedSubjects, chapters: unsyncedChapters }),
    });
  }

  // Push unsynced tasks
  const unsyncedTasks = state.tasks.filter(t => !t.synced);
  if (unsyncedTasks.length > 0) {
    await fetch(`${BASE_URL}/sync/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: unsyncedTasks }),
    });
  }
}

export async function pullChanges(state: AppState, since: number): Promise<AppState> {
  const res = await fetch(`${BASE_URL}/sync/pull?since=${since}`);
  if (!res.ok) throw new Error('Pull failed');
  const remote = await res.json();

  // Merge student (server is authoritative for coins/streak)
  const student: Student = remote.student || state.student;

  // Merge sessions (append unknown ones)
  const sessionMap = new Map(state.sessions.map(s => [s.id, s]));
  for (const rs of (remote.sessions || [])) {
    if (!sessionMap.has(rs.id)) {
      sessionMap.set(rs.id, { ...rs, synced: true });
    } else {
      // Mark as synced
      sessionMap.set(rs.id, { ...sessionMap.get(rs.id)!, synced: true });
    }
  }

  // Merge subjects
  const subjectMap = new Map(state.subjects.map(s => [s.id, s]));
  for (const rs of (remote.subjects || [])) {
    const local = subjectMap.get(rs.id);
    if (!local || rs.updated_at > local.updated_at) {
      subjectMap.set(rs.id, { ...rs, synced: true });
    }
  }

  // Merge chapters
  const chapterMap = new Map(state.chapters.map(c => [c.id, c]));
  for (const rc of (remote.chapters || [])) {
    const local = chapterMap.get(rc.id);
    if (!local || rc.updated_at > local.updated_at) {
      chapterMap.set(rc.id, { ...rc, synced: true });
    }
  }

  // Merge tasks with vector clock resolution
  const taskMap = new Map(state.tasks.map(t => [t.id, t]));
  for (const rt of (remote.tasks || [])) {
    const local = taskMap.get(rt.id);
    const remoteVC = typeof rt.device_clock === 'string' ? JSON.parse(rt.device_clock) : (rt.device_clock || {});
    if (!local) {
      taskMap.set(rt.id, { ...rt, device_clock: remoteVC, synced: true });
    } else {
      const localVC = local.device_clock || {};
      if (vcConcurrent(localVC, remoteVC)) {
        // Concurrent: resolve conflict
        const mergedVC = vcMerge(localVC, remoteVC);
        let resolvedStatus = local.status;
        let resolvedDeleted = local.deleted;
        if (rt.deleted || local.deleted) {
          resolvedDeleted = true;
        } else {
          resolvedStatus = STATUS_ORDER[rt.status] >= STATUS_ORDER[local.status]
            ? rt.status : local.status;
        }
        taskMap.set(rt.id, { ...local, status: resolvedStatus, deleted: resolvedDeleted, device_clock: mergedVC, synced: true });
      } else if (vcAfter(remoteVC, localVC)) {
        taskMap.set(rt.id, { ...rt, device_clock: remoteVC, synced: true });
      } else {
        // Local is newer or equal, keep but mark synced
        taskMap.set(rt.id, { ...local, synced: true });
      }
    }
  }

  return {
    student,
    sessions: Array.from(sessionMap.values()),
    subjects: Array.from(subjectMap.values()),
    chapters: Array.from(chapterMap.values()),
    tasks: Array.from(taskMap.values()),
  };
}

export async function fullSync(state: AppState, since: number): Promise<AppState> {
  await pushChanges(state);
  const merged = await pullChanges(state, since);
  // Mark all as synced
  return {
    ...merged,
    sessions: merged.sessions.map(s => ({ ...s, synced: true })),
    subjects: merged.subjects.map(s => ({ ...s, synced: true })),
    chapters: merged.chapters.map(c => ({ ...c, synced: true })),
    tasks: merged.tasks.map(t => ({ ...t, synced: true })),
  };
}
