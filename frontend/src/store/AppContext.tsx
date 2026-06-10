import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AppState, FocusSession, Task, TaskStatus } from './types';
import { loadState, saveState, DEVICE_ID } from './storage';
import { fullSync } from '../sync/syncEngine';
import { vcTick } from '../sync/vectorClock';

interface AppContextType {
  state: AppState;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: number;
  deviceId: string;
  setOnline: (v: boolean) => void;
  startFocusSession: (minutes: number) => string;
  completeFocusSession: (id: string) => void;
  failFocusSession: (id: string, reason: 'give_up' | 'app_switch') => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  forceSync: () => Promise<void>;
  seedData: () => Promise<void>;
}

const AppContext = createContext<AppContextType>(null!);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    student: { id: 'student_001', coins: 0, streak: 0, last_focus_date: null, today_focus_minutes: 0, updated_at: 0 },
    sessions: [], subjects: [], chapters: [], tasks: [],
  });
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    loadState().then(s => setState(s));
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) {
      forceSync();
    }
  }, [isOnline]);

  // Periodic sync every 30s when online
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => { if (isOnline) forceSync(); }, 30000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const forceSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      const merged = await fullSync(stateRef.current, lastSyncAt);
      setState(merged);
      setLastSyncAt(Date.now());
    } catch (e) {
      console.warn('[Sync] failed:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, lastSyncAt]);

  const startFocusSession = (minutes: number): string => {
    const id = uuidv4();
    const session: FocusSession = {
      id, student_id: 'student_001', target_minutes: minutes,
      status: 'pending', fail_reason: null,
      started_at: Date.now(), ended_at: null,
      device_id: DEVICE_ID, reward_applied: 0, notification_sent: 0, synced: false,
    };
    setState(prev => ({ ...prev, sessions: [...prev.sessions, session] }));
    return id;
  };

  const completeFocusSession = (id: string) => {
    setState(prev => {
      const sessions = prev.sessions.map(s => s.id === id
        ? { ...s, status: 'success' as const, ended_at: Date.now(), synced: false } : s);
      // Apply rewards locally (optimistic)
      const today = new Date().toISOString().slice(0, 10);
      const session = sessions.find(s => s.id === id)!;
      let streak = prev.student.streak;
      let focusMinutes = prev.student.today_focus_minutes;
      if (prev.student.last_focus_date !== today) focusMinutes = 0;
      focusMinutes += session.target_minutes;
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().slice(0, 10);
      if (prev.student.last_focus_date === today) { /* no change */ }
      else if (prev.student.last_focus_date === yStr) streak += 1;
      else streak = 1;
      const student = { ...prev.student, streak, today_focus_minutes: focusMinutes, last_focus_date: today, coins: prev.student.coins + 50 };
      return { ...prev, sessions, student };
    });
    if (isOnline) setTimeout(() => forceSync(), 500);
  };

  const failFocusSession = (id: string, reason: 'give_up' | 'app_switch') => {
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => s.id === id
        ? { ...s, status: 'failed' as const, fail_reason: reason, ended_at: Date.now(), synced: false } : s),
    }));
    if (isOnline) setTimeout(() => forceSync(), 500);
  };

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id !== taskId) return t;
        const newClock = vcTick(t.device_clock, DEVICE_ID);
        return { ...t, status, device_clock: newClock, updated_at: Date.now(), synced: false };
      }),
    }));
    if (isOnline) setTimeout(() => forceSync(), 500);
  };

  const seedData = async () => {
    const { v4: uuid } = await import('uuid');
    const now = Date.now();
    const subjectId1 = uuid(); const subjectId2 = uuid();
    const chapId1 = uuid(); const chapId2 = uuid(); const chapId3 = uuid();
    const subjects = [
      { id: subjectId1, student_id: 'student_001', name: 'Mathematics', color: '#6366f1', sort_order: 0, deleted: false, updated_at: now, synced: false },
      { id: subjectId2, student_id: 'student_001', name: 'Physics', color: '#f59e0b', sort_order: 1, deleted: false, updated_at: now, synced: false },
    ];
    const chapters = [
      { id: chapId1, subject_id: subjectId1, student_id: 'student_001', name: 'Algebra', sort_order: 0, deleted: false, updated_at: now, synced: false },
      { id: chapId2, subject_id: subjectId1, student_id: 'student_001', name: 'Geometry', sort_order: 1, deleted: false, updated_at: now, synced: false },
      { id: chapId3, subject_id: subjectId2, student_id: 'student_001', name: 'Mechanics', sort_order: 0, deleted: false, updated_at: now, synced: false },
    ];
    const tasks = [
      { id: uuid(), chapter_id: chapId1, student_id: 'student_001', name: 'Solve quadratic equations', status: 'not_started' as const, deleted: false, updated_at: now, device_clock: {}, synced: false },
      { id: uuid(), chapter_id: chapId1, student_id: 'student_001', name: 'Practice factoring', status: 'not_started' as const, deleted: false, updated_at: now, device_clock: {}, synced: false },
      { id: uuid(), chapter_id: chapId1, student_id: 'student_001', name: 'Linear equations', status: 'done' as const, deleted: false, updated_at: now, device_clock: {}, synced: false },
      { id: uuid(), chapter_id: chapId2, student_id: 'student_001', name: 'Triangles', status: 'in_progress' as const, deleted: false, updated_at: now, device_clock: {}, synced: false },
      { id: uuid(), chapter_id: chapId2, student_id: 'student_001', name: 'Circle theorems', status: 'not_started' as const, deleted: false, updated_at: now, device_clock: {}, synced: false },
      { id: uuid(), chapter_id: chapId3, student_id: 'student_001', name: "Newton's laws", status: 'in_progress' as const, deleted: false, updated_at: now, device_clock: {}, synced: false },
      { id: uuid(), chapter_id: chapId3, student_id: 'student_001', name: 'Projectile motion', status: 'not_started' as const, deleted: false, updated_at: now, device_clock: {}, synced: false },
    ];
    setState(prev => ({ ...prev, subjects, chapters, tasks }));
  };

  return (
    <AppContext.Provider value={{
      state, isOnline, isSyncing, lastSyncAt, deviceId: DEVICE_ID,
      setOnline: setIsOnline,
      startFocusSession, completeFocusSession, failFocusSession,
      updateTaskStatus, forceSync, seedData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
