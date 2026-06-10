import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { useApp } from '../store/AppContext';

export default function DevPanelScreen() {
  const { state, isOnline, isSyncing, lastSyncAt, deviceId, setOnline, forceSync, seedData } = useApp();
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);

  const handleSync = async () => {
    addLog('Manual sync triggered...');
    try {
      await forceSync();
      addLog('✅ Sync complete');
    } catch (e: any) {
      addLog(`❌ Sync error: ${e.message}`);
    }
  };

  const sessions = state.sessions;
  const unsyncedCount = [
    ...state.sessions.filter(s => !s.synced),
    ...state.tasks.filter(t => !t.synced),
    ...state.subjects.filter(s => !s.synced),
  ].length;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🛠 Dev Panel</Text>

      {/* Device Info */}
      <View style={styles.card}>
        <Text style={styles.label}>Device ID</Text>
        <Text style={styles.value}>{deviceId}</Text>
        <Text style={styles.label}>Student</Text>
        <Text style={styles.value}>student_001 | 🔥{state.student.streak} | 🪙{state.student.coins} | ⏱{state.student.today_focus_minutes}m</Text>
        <Text style={styles.label}>Unsynced items</Text>
        <Text style={[styles.value, { color: unsyncedCount > 0 ? '#f59e0b' : '#10b981' }]}>{unsyncedCount}</Text>
        <Text style={styles.label}>Last sync</Text>
        <Text style={styles.value}>{lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Never'}</Text>
      </View>

      {/* Online Toggle */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Network</Text>
          <View style={styles.row}>
            <Text style={[styles.networkStatus, { color: isOnline ? '#10b981' : '#ef4444' }]}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={v => { setOnline(v); addLog(v ? '🌐 Went ONLINE' : '✈️ Went OFFLINE'); }}
              trackColor={{ false: '#7f1d1d', true: '#065f46' }}
              thumbColor={isOnline ? '#10b981' : '#ef4444'}
            />
          </View>
        </View>
        <TouchableOpacity style={[styles.btn, isSyncing && styles.btnDisabled]} onPress={handleSync} disabled={isSyncing}>
          <Text style={styles.btnText}>{isSyncing ? '⟳ Syncing...' : '⟳ Force Sync'}</Text>
        </TouchableOpacity>
      </View>

      {/* Seed */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.btn} onPress={() => { seedData(); addLog('🌱 Seeded sample syllabus data'); }}>
          <Text style={styles.btnText}>🌱 Seed Syllabus Data</Text>
        </TouchableOpacity>
      </View>

      {/* Sessions */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Focus Sessions ({sessions.length})</Text>
        {sessions.slice(-5).reverse().map(s => (
          <View key={s.id} style={styles.sessionRow}>
            <Text style={styles.sessionIcon}>{s.status === 'success' ? '✅' : s.status === 'failed' ? '❌' : '⏳'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionId}>{s.id.slice(0, 8)}... | {s.target_minutes}min</Text>
              <Text style={styles.sessionMeta}>{s.status}{s.fail_reason ? ` (${s.fail_reason})` : ''} | {s.synced ? '☁️ synced' : '⬆ pending'} | dev: {s.device_id}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Tasks */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tasks ({state.tasks.filter(t => !t.deleted).length})</Text>
        {state.tasks.filter(t => !t.deleted).slice(0, 8).map(t => (
          <View key={t.id} style={styles.sessionRow}>
            <Text style={styles.sessionId}>{t.name}</Text>
            <Text style={[styles.sessionMeta, { color: t.synced ? '#10b981' : '#f59e0b' }]}>
              {t.status} | {t.synced ? 'synced' : 'pending'} | vc: {JSON.stringify(t.device_clock)}
            </Text>
          </View>
        ))}
      </View>

      {/* Event Log */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Event Log</Text>
        {log.length === 0 && <Text style={styles.sessionMeta}>No events yet.</Text>}
        {log.map((l, i) => <Text key={i} style={styles.logLine}>{l}</Text>)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  label: { color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  value: { color: '#fff', fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  networkStatus: { fontSize: 14, fontWeight: 'bold', marginRight: 12 },
  btn: { backgroundColor: '#6366f1', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { color: '#ccc', fontWeight: 'bold', marginBottom: 10 },
  sessionRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#0f0f1a' },
  sessionIcon: { fontSize: 16, marginRight: 8 },
  sessionId: { color: '#ccc', fontSize: 12 },
  sessionMeta: { color: '#666', fontSize: 11 },
  logLine: { color: '#10b981', fontSize: 11, fontFamily: 'monospace', marginBottom: 2 },
});
