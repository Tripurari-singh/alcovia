import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { AppProvider } from './src/store/AppContext';
import FocusScreen from './src/screens/FocusScreen';
import SyllabusScreen from './src/screens/SyllabusScreen';
import DevPanelScreen from './src/screens/DevPanelScreen';

type Tab = 'focus' | 'syllabus' | 'dev';

function Nav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'focus', label: '⏱ Focus' },
    { key: 'syllabus', label: ' Syllabus' },
    { key: 'dev', label: '🛠 Dev' },
  ];
  return (
    <View style={navStyles.nav}>
      {tabs.map(t => (
        <TouchableOpacity key={t.key} style={[navStyles.tab, tab === t.key && navStyles.active]} onPress={() => setTab(t.key)}>
          <Text style={[navStyles.tabText, tab === t.key && navStyles.activeText]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const navStyles = StyleSheet.create({
  nav: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderTopWidth: 1, borderTopColor: '#333' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  active: { borderTopWidth: 2, borderTopColor: '#6366f1' },
  tabText: { color: '#888', fontSize: 12 },
  activeText: { color: '#6366f1', fontWeight: 'bold' },
});

export default function App() {
  const [tab, setTab] = useState<Tab>('focus');
  return (
    <AppProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f1a' }}>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />
        <View style={{ flex: 1 }}>
          {tab === 'focus' && <FocusScreen />}
          {tab === 'syllabus' && <SyllabusScreen />}
          {tab === 'dev' && <DevPanelScreen />}
        </View>
        <Nav tab={tab} setTab={setTab} />
      </SafeAreaView>
    </AppProvider>
  );
}
