import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { QuizQuestion } from '../types/quiz';

type QuizViewProps = {
  title: string;
  questions: QuizQuestion[];
};

export const QuizView: React.FC<QuizViewProps> = ({ title, questions }) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = questions.reduce((acc, q) => {
    return answers[q.id] === q.correctAnswer ? acc + 1 : acc;
  }, 0);

  return (
    <View>
      <Text style={styles.title}>{title}</Text>

      {questions.map((q) => (
        <View key={q.id} style={styles.card}>
          <Text style={styles.question}>{q.question}</Text>

          {q.options.map((opt, index) => {
            const selected = answers[q.id] === index;
            const isCorrect = index === q.correctAnswer;

            return (
              <TouchableOpacity
                key={index}
                disabled={submitted}
                onPress={() =>
                  setAnswers({ ...answers, [q.id]: index })
                }
                style={[
                  styles.option,
                  selected && styles.selected,
                  submitted && isCorrect && styles.correct,
                  submitted && selected && !isCorrect && styles.wrong,
                ]}
              >
                <Text>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {!submitted ? (
        <TouchableOpacity style={styles.submit} onPress={() => setSubmitted(true)}>
          <Text style={styles.submitText}>Submit Quiz</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.score}>
          Score: {score} / {questions.length}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  card: { marginBottom: 15 },
  question: { fontWeight: 'bold', marginBottom: 5 },
  option: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginVertical: 3,
    borderRadius: 5,
  },
  selected: { backgroundColor: '#e0e0e0' },
  correct: { backgroundColor: '#c8f7c5' },
  wrong: { backgroundColor: '#f7c5c5' },
  submit: {
    backgroundColor: '#6200ee',
    padding: 12,
    alignItems: 'center',
    borderRadius: 5,
    marginTop: 10,
  },
  submitText: { color: '#fff', fontWeight: 'bold' },
  score: { marginTop: 15, fontSize: 18, fontWeight: 'bold' },
});
