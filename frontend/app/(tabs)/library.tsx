import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface LibraryItem {
  id: string;
  title: string;
  type: 'Quiz' | 'Flashcards' | 'Notes';
  date: string;
  score?: string;
  count?: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function LibraryScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const COLORS = {
    bg: isDark ? '#09090b' : '#f9fafb',
    text: isDark ? '#fafafa' : '#09090b',
    muted: isDark ? '#a1a1aa' : '#71717a',
    border: isDark ? '#27272a' : '#e4e4e7',
    paper: isDark ? '#18181b' : '#ffffff',
    accent: '#6366f1',
  };

  const styles = createStyles(COLORS);
  const router = useRouter();

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/library`);
      const data = await res.json();
      setLibrary(data);
    } catch (e) {
      Alert.alert("Sync Error", "Failed to fetch library items.");
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = (item: LibraryItem) => {
    router.push({
      pathname: '/',
      params: { libraryId: item.id, type: item.type }
    });
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Library</Text>
          <Text style={styles.subtitle}>Saved AI Knowledge</Text>
        </View>
        <TouchableOpacity style={styles.syncBtn} onPress={fetchLibrary} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <Ionicons name="sync" size={20} color={COLORS.accent} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {library.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.itemCard}
            onPress={() => handleItemPress(item)}
          >
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
