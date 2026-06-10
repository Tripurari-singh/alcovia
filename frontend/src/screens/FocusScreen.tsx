import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, AppState } from 'react-native';
import { useApp } from '../store/AppContext';

const DURATIONS = [25, 45, 60, 90, 120];
const GRACE_SECONDS = 5;

export default function FocusScreen() {
  const { state, startFocusSession, completeFocusSession, failFocusSession, isOnline } = useApp();
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const graceTimer = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);

  const activeSession = state.sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    if (!running || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 && running && activeSessionId) {
      setRunning(false);
      completeFocusSession(activeSessionId);
      Alert.alert('🎉 Session Complete!', `+50 coins earned!`);
      setActiveSessionId(null);
    }
  }, [secondsLeft, running]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (running && appStateRef.current === 'active' && nextState !== 'active') {
        graceTimer.current = setTimeout(() => {
          if (activeSessionId) {
            setRunning(false);
            failFocusSession(activeSessionId, 'app_switch');
            setActiveSessionId(null);
            Alert.alert('Session Failed', 'You left the app.');
          }
        }, GRACE_SECONDS * 1000);
      } else if (nextState === 'active' && graceTimer.current) {
        clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [running, activeSessionId]);

  const handleStart = () => {
    const id = startFocusSession(selectedMinutes);
    setActiveSessionId(id);
    setSecondsLeft(selectedMinutes * 60);
    setRunning(true);
  };

  const handleGiveUp = () => {
    Alert.alert('Give Up?', 'No coins will be earned.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Give Up', style: 'destructive', onPress: () => {
          if (activeSessionId) {
            failFocusSession(activeSessionId, 'give_up');
            setActiveSessionId(null);
            setRunning(false);
          }
        }
      },
    ]);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const today = new Date().toISOString().slice(0, 10);
  const recentSessions = state.sessions.slice(-5).reverse();

  return (
    <View style={styles.container}>
      {/* Student stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statVal}>🔥 {state.student.streak}</Text><Text style={styles.statLabel}>Streak</Text></View>
        <View style={styles.stat}><Text style={styles.statVal}>🪙 {state.student.coins}</Text><Text style={styles.statLabel}>Coins</Text></View>
        <View style={styles.stat}><Text style={styles.statVal}>⏱ {state.student.today_focus_minutes}m</Text><Text style={styles.statLabel}>Today</Text></View>
      </View>

      {running && activeSessionId ? (
        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>Focus Session</Text>
          <Text style={styles.timer}>{formatTime(secondsLeft)}</Text>
          <Text style={styles.timerSub}>Stay focused! {!isOnline && '(offline)'}</Text>
          <TouchableOpacity style={styles.giveUpBtn} onPress={handleGiveUp}>
            <Text style={styles.giveUpText}>Give Up</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.setupBox}>
          <Text style={styles.sectionTitle}>Choose Duration</Text>
          <View style={styles.durRow}>
            {DURATIONS.map(d => (
              <TouchableOpacity key={d} style={[styles.durBtn, selectedMinutes === d && styles.durBtnActive]} onPress={() => setSelectedMinutes(d)}>
                <Text style={[styles.durText, selectedMinutes === d && styles.durTextActive]}>{d}m</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Text style={styles.startText}>Start Focus</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Recent Sessions</Text>
      {recentSessions.map(s => (
        <View key={s.id} style={styles.sessionRow}>
          <Text style={styles.sessionIcon}>{s.status === 'success' ? '✅' : s.status === 'failed' ? '❌' : '⏳'}</Text>
          <Text style={styles.sessionText}>{s.target_minutes}min — {s.status}{s.fail_reason ? ` (${s.fail_reason})` : ''}</Text>
          {!s.synced && <Text style={styles.unsynced}>⬆</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#0f0f1a' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16 },
  stat: { alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  timerBox: { alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 32, marginBottom: 24 },
  timerLabel: { color: '#6366f1', fontSize: 14, marginBottom: 8, letterSpacing: 2 },
  timer: { color: '#fff', fontSize: 72, fontWeight: '200', letterSpacing: 4 },
  timerSub: { color: '#888', marginTop: 8, marginBottom: 24 },
  giveUpBtn: { backgroundColor: '#7f1d1d', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  giveUpText: { color: '#fca5a5', fontWeight: 'bold' },
  setupBox: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 24, marginBottom: 24 },
  sectionTitle: { color: '#888', fontSize: 12, letterSpacing: 2, marginBottom: 12, textTransform: 'uppercase' },
  durRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  durBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  durBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  durText: { color: '#888' },
  durTextActive: { color: '#fff', fontWeight: 'bold' },
  startBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  startText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  sessionIcon: { fontSize: 16, marginRight: 8 },
  sessionText: { color: '#ccc', flex: 1 },
  unsynced: { color: '#6366f1', fontSize: 12 },
});
