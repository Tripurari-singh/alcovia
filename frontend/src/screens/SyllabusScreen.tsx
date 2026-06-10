import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useApp } from '../store/AppContext';
import { TaskStatus } from '../store/types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not Started', in_progress: 'In Progress', done: 'Done',
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: '#374151', in_progress: '#d97706', done: '#059669',
};
const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  not_started: 'in_progress', in_progress: 'done', done: 'not_started',
};

export default function SyllabusScreen() {
  const { state, updateTaskStatus, seedData } = useApp();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const subjects = state.subjects.filter(s => !s.deleted);
  if (subjects.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No syllabus data yet.</Text>
        <TouchableOpacity style={styles.seedBtn} onPress={seedData}>
          <Text style={styles.seedText}>Load Sample Data</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function subjectProgress(subjectId: string) {
    const chapters = state.chapters.filter(c => c.subject_id === subjectId && !c.deleted);
    if (chapters.length === 0) return 0;
    const pcts = chapters.map(c => chapterProgress(c.id));
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }

  function chapterProgress(chapterId: string) {
    const tasks = state.tasks.filter(t => t.chapter_id === chapterId && !t.deleted);
    if (tasks.length === 0) return 0;
    const done = tasks.filter(t => t.status === 'done').length;
    return Math.round((done / tasks.length) * 100);
  }

  return (
    <ScrollView style={styles.container}>
      {subjects.map(subject => {
        const pct = subjectProgress(subject.id);
        const isExpanded = expandedSubject === subject.id;
        const chapters = state.chapters.filter(c => c.subject_id === subject.id && !c.deleted);
        return (
          <View key={subject.id} style={styles.subjectCard}>
            <TouchableOpacity onPress={() => setExpandedSubject(isExpanded ? null : subject.id)} style={styles.subjectHeader}>
              <View style={[styles.subjectDot, { backgroundColor: subject.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: subject.color }]} />
                </View>
              </View>
              <Text style={styles.pct}>{pct}%</Text>
              <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {isExpanded && chapters.map(chapter => {
              const cpct = chapterProgress(chapter.id);
              const tasks = state.tasks.filter(t => t.chapter_id === chapter.id && !t.deleted);
              return (
                <View key={chapter.id} style={styles.chapterBox}>
                  <View style={styles.chapterHeader}>
                    <Text style={styles.chapterName}>{chapter.name}</Text>
                    <Text style={styles.chapterPct}>{cpct}%</Text>
                  </View>
                  {tasks.map(task => (
                    <TouchableOpacity key={task.id} style={styles.taskRow} onPress={() => updateTaskStatus(task.id, NEXT_STATUS[task.status])}>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[task.status] }]}>
                        <Text style={styles.statusText}>{STATUS_LABELS[task.status]}</Text>
                      </View>
                      <Text style={styles.taskName}>{task.name}</Text>
                      {!task.synced && <Text style={styles.unsynced}>⬆</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f1a' },
  emptyText: { color: '#888', marginBottom: 16 },
  seedBtn: { backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  seedText: { color: '#fff', fontWeight: 'bold' },
  subjectCard: { backgroundColor: '#1a1a2e', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  subjectDot: { width: 12, height: 12, borderRadius: 6 },
  subjectName: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 6 },
  progressBar: { height: 4, backgroundColor: '#374151', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  pct: { color: '#888', marginRight: 8, fontSize: 12 },
  chevron: { color: '#888' },
  chapterBox: { paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#0f0f1a' },
  chapterHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  chapterName: { color: '#ccc', fontWeight: '600' },
  chapterPct: { color: '#888', fontSize: 12 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  taskName: { color: '#aaa', flex: 1 },
  unsynced: { color: '#6366f1', fontSize: 12 },
});
