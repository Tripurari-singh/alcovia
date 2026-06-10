import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from './types';

// Each device gets a namespace via DEVICE_ID so two browser tabs don't share storage
export const DEVICE_ID = typeof window !== 'undefined'
  ? (localStorage.getItem('alcovia_device_id') || (() => {
      const id = 'dev_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('alcovia_device_id', id);
      return id;
    })())
  : 'dev_native';

const NS = `alcovia_${DEVICE_ID}`;

const defaultStudent = {
  id: 'student_001',
  coins: 0,
  streak: 0,
  last_focus_date: null,
  today_focus_minutes: 0,
  updated_at: 0,
};

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(NS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    student: defaultStudent,
    sessions: [],
    subjects: [],
    chapters: [],
    tasks: [],
  };
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(NS, JSON.stringify(state));
}

export async function clearState(): Promise<void> {
  await AsyncStorage.removeItem(NS);
}
