import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LibraryScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const COLORS = {
    bg: isDark ? '#09090b' : '#f9fafb',
    text: isDark ? '#fafafa' : '#09090b',
    muted: isDark ? '#a1a1aa' : '#71717a',
    border: isDark ? '#27272a' : '#e4e4e7',
    paper: isDark ? '#18181b' : '#ffffff',
    accent: '#6366f1',
  };

  const styles = createStyles(COLORS);

  const mockLibrary = [
    { id: '1', title: 'World War II History', type: 'Quiz', date: '2026-05-03', score: '80%' },
    { id: '2', title: 'Cell Biology Vocab', type: 'Flashcards', date: '2026-05-02', count: '15 cards' },
    { id: '3', title: 'Macroeconomics 101', type: 'Notes', date: '2026-05-01' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Library</Text>
          <Text style={styles.subtitle}>Saved AI Knowledge</Text>
        </View>
        <TouchableOpacity style={styles.syncBtn}>
          <Ionicons name="sync" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {mockLibrary.map((item) => (
          <TouchableOpacity key={item.id} style={styles.itemCard}>
            <View style={styles.iconContainer}>
              <Ionicons 
                name={item.type === 'Quiz' ? 'help-circle' : item.type === 'Flashcards' ? 'layers' : 'document-text'} 
                size={24} 
                color={COLORS.accent} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>
                {item.type} • {item.date} {item.score ? `• Score: ${item.score}` : item.count ? `• ${item.count}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  title: { fontSize: 32, fontWeight: '900', color: COLORS.text, letterSpacing: -1.5 },
  subtitle: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  syncBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center'
  },
  scrollContent: { paddingHorizontal: 24, gap: 16 },
  itemCard: {
    backgroundColor: COLORS.paper, borderRadius: 24, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },
  iconContainer: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: COLORS.accent + '10',
    alignItems: 'center', justifyContent: 'center'
  },
  itemTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  itemMeta: { fontSize: 12, color: COLORS.muted, fontWeight: '600' }
});
