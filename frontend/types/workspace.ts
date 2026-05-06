import { QuizData } from './quiz';

type Workspace = {
  id: string;
  title: string;
  notes: string;
  files: WorkspaceFile[];
  quiz?: QuizData;
};

type WorkspaceFile = {
  uri: string;
  name: string;
  type: string;
};
