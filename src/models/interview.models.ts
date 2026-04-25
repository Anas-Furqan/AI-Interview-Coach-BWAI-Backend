export interface NextStepBody {
  phase: string;
  userName?: string;
  industry?: string;
  role?: string;
  targetCompany?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  interviewMode?: 'BEHAVIORAL' | 'CODING';
  language: string;
  languageCode?: string;
  jobDescription?: string;
  additionalInfo?: string;
  profileSummary?: string;
  cvText?: string;
  lastQuestion?: string;
  userAnswer?: string;
  codeAnswer?: string;
  fullChatHistory?: string;
  numExpQuestions: string;
  numRoleQuestions: string;
  numPersonalityQuestions: string;
  expQuestionsAsked: string;
  roleQuestionsAsked: string;
  personalityQuestionsAsked: string;
  selectedVoice?: string;
  interviewType?: 'actual' | 'mock';
  applicationId?: string;
  jobId?: string;
  hudWpm?: string;
  hudConfidence?: string;
}

export interface InterviewContext {
  userName: string;
  role: string;
  targetCompany?: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  interviewMode?: 'BEHAVIORAL' | 'CODING';
  language: string;
  userAnswer?: string;
  codeAnswer?: string;
  cvText: string;
  jobDescription?: string;
  additionalInfo?: string;
  profileSummary?: string;
  fullChatHistory?: string;
  numExpQuestions: string;
  numRoleQuestions: string;
  numPersonalityQuestions: string;
  expQuestionsAsked: string;
  roleQuestionsAsked: string;
  personalityQuestionsAsked: string;
}
