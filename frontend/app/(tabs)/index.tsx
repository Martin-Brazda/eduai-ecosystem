import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import Markdown from 'react-native-markdown-display';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


const API_URL = process.env.EXPO_PUBLIC_API_URL ? `${process.env.EXPO_PUBLIC_API_URL}/process-batch` : 'http://localhost:8080/process-batch';
const createId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function App() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [screen, setScreen] = useState<'home' | 'quiz' | 'flashcards' | 'notes' | 'results'>('home');
  const [loading, setLoading] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [itemCount, setItemCount] = useState('5');
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  const [workspace, setWorkspace] = useState({
    currentNote: '',
    files: [] as any[]
  });

  const [quiz, setQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<any>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [flashcardSet, setFlashcardSet] = useState<any>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [generatedNotes, setGeneratedNotes] = useState('');

  const COLORS = {
    bg: isDark ? '#09090b' : '#f9fafb',
    paper: isDark ? '#18181b' : '#ffffff',
    text: isDark ? '#fafafa' : '#09090b',
    muted: isDark ? '#71717a' : '#71717a',
    border: isDark ? '#27272a' : '#e4e4e7',
    accent: '#6366f1',
    inputBg: isDark ? '#18181b' : '#f4f4f5',
  };

  const styles = createStyles(COLORS);
  const { libraryId, type } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (libraryId) {
      loadLibraryItem(libraryId as string);
    }
  }, [libraryId]);

  const loadLibraryItem = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL.replace('/process-batch', '')}/library/${id}`);
      if (!res.ok) {
        throw new Error(`Item not found (Status: ${res.status})`);
      }
      const item = await res.json();
      
      if (!item || !item.type) {
        throw new Error('Invalid item data structure');
      }

      const mode = item.type.toLowerCase();
      const data = item.data;

      if (mode === 'quiz') {
        setQuiz(data);
        setScreen('quiz');
      } else if (mode === 'flashcards') {
        setFlashcardSet(data);
        setScreen('flashcards');
      } else if (mode === 'notes') {
        setGeneratedNotes(data.result);
        setScreen('notes');
      }
      
      // Clear params after loading
      router.setParams({ libraryId: undefined, type: undefined });
    } catch (e: any) {
      console.error(e);
      Alert.alert('Load Error', e.message || 'Failed to load library item.');
    } finally {
      setLoading(false);
    }
  };

  const pickImages = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
    });
    if (!res.canceled) {
      const newFiles = res.assets.map(a => ({
        id: createId(),
        uri: a.uri,
        name: a.fileName || 'image.jpg',
        type: 'image/jpeg',
      }));
      setWorkspace(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
    }
  };

  const pickPDF = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (!res.canceled) {
      const f = res.assets[0];
      setWorkspace(prev => ({
        ...prev,
        files: [...prev.files, {
          id: createId(),
          uri: f.uri,
          name: f.name,
          type: 'application/pdf',
        }],
      }));
    }
  };

  const removeFile = (id: string) => {
    setWorkspace(prev => ({ ...prev, files: prev.files.filter(f => f.id !== id) }));
  };

  const sendToAI = async (mode: 'quiz' | 'notes' | 'flashcards') => {
    if (workspace.files.length === 0 && !workspace.currentNote.trim()) {
      Alert.alert("Empty Workspace", "Please add some notes or files first.");
      return;
    }
    setLoading(true);

    const formData = new FormData();
    workspace.files.forEach(file => {
      formData.append('files', {
        uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
        name: file.name,
        type: file.type,
      } as any);
    });

    if (workspace.currentNote.trim()) {
      formData.append('text_content', workspace.currentNote);
    }

    formData.append('mode', mode);
    formData.append('prompt_instruction', additionalPrompt || 'Analyze these documents.');
    formData.append('difficulty', difficulty);
    formData.append('count', itemCount);


    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format from server');
      }
      const firstSuccess = data.find((r: any) => r.status === 'success');

      if (firstSuccess) {
        if (mode === 'quiz') {
          setQuiz(firstSuccess.data);
          setScreen('quiz');
        } else if (mode === 'flashcards') {
          setFlashcardSet(firstSuccess.data);
          setScreen('flashcards');
        } else if (mode === 'notes') {
          setGeneratedNotes(firstSuccess.data.result);
          setScreen('notes');
        } else {
          setWorkspace(prev => ({ ...prev, currentNote: firstSuccess.data.content }));
          setShowAiOptions(false);
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('AI Error', 'Failed to process request.');
    } finally {
      setLoading(false);
    }
  };

  const renderHome = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Library</Text>
            <Text style={styles.subtitle}>AI-Enhanced Workspace</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAiOptions(!showAiOptions)} style={styles.aiToggle}>
            <Ionicons name="sparkles" size={20} color={showAiOptions ? COLORS.accent : COLORS.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <TextInput
            multiline
            style={styles.editor}
            placeholder="Document content..."
            placeholderTextColor={COLORS.muted}
            value={workspace.currentNote}
            onChangeText={(t) => setWorkspace(prev => ({ ...prev, currentNote: t }))}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentRow}>
            <TouchableOpacity style={styles.addBtn} onPress={pickImages}>
              <Ionicons name="image-outline" size={16} color={COLORS.accent} />
              <Text style={styles.addBtnText}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={pickPDF}>
              <Ionicons name="document-text-outline" size={16} color={COLORS.accent} />
              <Text style={styles.addBtnText}>PDF</Text>
            </TouchableOpacity>

            {workspace.files.map((f) => (
              <View key={f.id} style={styles.fileChip}>
                <Text style={styles.fileChipText} numberOfLines={1}>{f.name}</Text>
                <TouchableOpacity onPress={() => removeFile(f.id)}>
                  <Ionicons name="close-circle" size={14} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        {showAiOptions && (
          <View style={[styles.card, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>AI Orchestration</Text>
            <Text style={styles.label}>Complexity</Text>
            <View style={styles.difficultyRow}>
              {['easy', 'medium', 'hard'].map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDifficulty(d)}
                  style={[styles.diffBtn, difficulty === d && styles.diffBtnActive]}
                >
                  <Text style={[styles.diffBtnText, difficulty === d && styles.diffBtnTextActive]}>{d.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Generation Count</Text>
            <View style={styles.countRow}>
              <TouchableOpacity onPress={() => setItemCount(Math.max(1, parseInt(itemCount || '0') - 1).toString())} style={styles.countBtn}>
                <Ionicons name="remove" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <TextInput
                style={styles.countInput}
                keyboardType="numeric"
                value={itemCount}
                onChangeText={setItemCount}
              />
              <TouchableOpacity onPress={() => setItemCount((parseInt(itemCount || '0') + 1).toString())} style={styles.countBtn}>
                <Ionicons name="add" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.promptInput}
              placeholder="Custom Instructions..."
              placeholderTextColor={COLORS.muted}
              value={additionalPrompt}
              onChangeText={setAdditionalPrompt}
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.mainBtn, { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, flex: 0.8 }]} onPress={() => sendToAI('notes')}>
                <Text style={[styles.mainBtnText, { color: COLORS.text }]}>Notes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mainBtn, { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, flex: 1 }]} onPress={() => sendToAI('flashcards')}>
                <Text style={[styles.mainBtnText, { color: COLORS.text }]}>Flashcards</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mainBtn, { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, flex: 1 }]} onPress={() => sendToAI('quiz')}>
                <Text style={[styles.mainBtnText, { color: COLORS.text }]}>Quiz</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.loadingText}>Processing AI Workflow...</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );

  const renderQuiz = () => {
    const q = quiz.questions[currentQuestionIndex];
    return (
      <View style={styles.container}>
        <View style={styles.quizHeader}>
          <TouchableOpacity onPress={() => setScreen('home')}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.quizTitle}>Step {currentQuestionIndex + 1}/{quiz.questions.length}</Text>
        </View>
        <ScrollView style={{ flex: 1, padding: 24 }}>
          <Text style={styles.questionText}>{q.question}</Text>
          {q.options.map((opt: string, i: number) => {
            const isSelected = answers[q.id] === i;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.optionBtn, isSelected && styles.optionBtnActive]}
                onPress={() => setAnswers({ ...answers, [q.id]: i })}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ padding: 24, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => {
              if (currentQuestionIndex < quiz.questions.length - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1);
              } else {
                setScreen('results');
              }
            }}
          >
            <Text style={styles.nextBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderResults = () => {
    let score = 0;
    quiz.questions.forEach((q: any) => {
      if (answers[q.id] === q.correctAnswer) score++;
    });

    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 40 }]}>
        <View style={styles.resultCircle}>
          <Text style={styles.resultScore}>{Math.round((score / quiz.questions.length) * 100)}%</Text>
        </View>
        <Text style={styles.resultText}>Session Complete</Text>
        <Text style={styles.resultSubtext}>Efficiency: {score}/{quiz.questions.length} correct</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => {
          setScreen('home');
          setAnswers({});
          setCurrentQuestionIndex(0);
        }}>
          <Text style={styles.doneBtnText}>Return to Library</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFlashcards = () => {
    const card = flashcardSet.cards[currentCardIndex];
    return (
      <View style={styles.container}>
        <View style={styles.quizHeader}>
          <TouchableOpacity onPress={() => setScreen('home')}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.quizTitle}>Card {currentCardIndex + 1}/{flashcardSet.cards.length}</Text>
        </View>

        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.flashcard, isFlipped && styles.flashcardFlipped]}
            onPress={() => setIsFlipped(!isFlipped)}
          >
            <Text style={styles.flashcardLabel}>{isFlipped ? 'ANSWER' : 'QUESTION'}</Text>
            <Text style={[styles.flashcardText, isFlipped && styles.flashcardTextFlipped]}>
              {isFlipped ? card.back : card.front}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ padding: 24, flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={[styles.nextBtn, { flex: 1, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border }]}
            onPress={() => {
              setIsFlipped(false);
              if (currentCardIndex > 0) setCurrentCardIndex(currentCardIndex - 1);
            }}
          >
            <Text style={[styles.nextBtnText, { color: COLORS.text }]}>Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nextBtn, { flex: 1 }]}
            onPress={() => {
              setIsFlipped(false);
              if (currentCardIndex < flashcardSet.cards.length - 1) {
                setCurrentCardIndex(currentCardIndex + 1);
              } else {
                setScreen('home');
              }
            }}
          >
            <Text style={styles.nextBtnText}>
              {currentCardIndex === flashcardSet.cards.length - 1 ? 'Finish' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNotes = () => (
    <View style={styles.container}>
      <View style={styles.quizHeader}>
        <TouchableOpacity onPress={() => setScreen('home')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.quizTitle}>AI Summary</Text>
        <TouchableOpacity onPress={() => Alert.alert("Saved", "Notes added to library.")}>
          <Ionicons name="bookmark-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1, padding: 24 }}>
        <Markdown style={{
          body: { color: COLORS.text, fontSize: 16, lineHeight: 24 },
          heading1: { color: COLORS.accent, fontWeight: '900', marginTop: 20 },
          heading2: { color: COLORS.text, fontWeight: '800', marginTop: 15 },
          paragraph: { marginBottom: 10 }
        }}>
          {generatedNotes}
        </Markdown>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {screen === 'home' && renderHome()}
      {screen === 'quiz' && renderQuiz()}
      {screen === 'flashcards' && renderFlashcards()}
      {screen === 'notes' && renderNotes()}
      {screen === 'results' && renderResults()}
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { paddingBottom: 40 },
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
  aiToggle: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center'
  },
  card: {
    marginHorizontal: 24, backgroundColor: COLORS.paper, borderRadius: 28,
    padding: 24, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 10
  },
  editor: { fontSize: 16, color: COLORS.text, minHeight: 250, textAlignVertical: 'top', lineHeight: 24 },
  attachmentRow: { marginTop: 24, flexDirection: 'row' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
    backgroundColor: COLORS.bg, marginRight: 12, borderWidth: 1, borderColor: COLORS.border
  },
  addBtnText: { fontSize: 11, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase' },
  fileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: COLORS.accent + '15', marginRight: 12
  },
  fileChipText: { fontSize: 11, color: COLORS.accent, fontWeight: '800', maxWidth: 100 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text, marginBottom: 24, letterSpacing: -0.5 },
  label: { fontSize: 10, fontWeight: '900', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  difficultyRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  diffBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  diffBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  diffBtnText: { fontSize: 10, fontWeight: '900', color: COLORS.muted },
  diffBtnTextActive: { color: '#fff' },
  promptInput: { backgroundColor: COLORS.inputBg, borderRadius: 16, padding: 16, fontSize: 14, color: COLORS.text, marginBottom: 24 },
  actionRow: { flexDirection: 'row', gap: 12 },
  mainBtn: { flex: 1, height: 56, backgroundColor: COLORS.accent, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
  mainBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, backgroundColor: COLORS.inputBg, borderRadius: 16, padding: 8 },
  countBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  countInput: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.text },
  loadingOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  loadingText: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, marginBottom: 20 },
  quizTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 1 },
  questionText: { fontSize: 28, fontWeight: '900', color: COLORS.text, lineHeight: 36, marginBottom: 40, letterSpacing: -0.5 },
  optionBtn: { padding: 20, borderRadius: 24, borderWidth: 2, borderColor: COLORS.border, marginBottom: 16 },
  optionBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '10' },
  optionText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  optionTextActive: { color: COLORS.accent },
  nextBtn: { height: 60, backgroundColor: COLORS.accent, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  resultCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: COLORS.accent + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 32, borderWidth: 3, borderColor: COLORS.accent },
  resultScore: { fontSize: 44, fontWeight: '900', color: COLORS.accent, letterSpacing: -2 },
  resultText: { fontSize: 28, fontWeight: '900', color: COLORS.text, marginBottom: 8, letterSpacing: -1 },
  resultSubtext: { fontSize: 15, color: COLORS.muted, fontWeight: '600', marginBottom: 48 },
  doneBtn: { paddingHorizontal: 48, height: 60, backgroundColor: COLORS.accent, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  flashcard: {
    height: 400, backgroundColor: COLORS.paper, borderRadius: 32,
    padding: 32, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 15
  },
  flashcardFlipped: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '05' },
  flashcardLabel: { fontSize: 10, fontWeight: '900', color: COLORS.muted, position: 'absolute', top: 32, letterSpacing: 2 },
  flashcardText: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center', lineHeight: 32 },
  flashcardTextFlipped: { color: COLORS.accent }
});