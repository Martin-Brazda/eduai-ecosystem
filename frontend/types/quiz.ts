// types/quiz.ts

export type QuizResponse = {
  status: 'success';
  data: QuizData;
};

export type QuizData = {
  id: string;
  quiz_title: string;
  questions: QuizQuestion[];
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option
};
