export interface NextStepBody {
  phase: string;
  userName?: string;
  industry?: string;
  role?: string;
  language: string;
  languageCode?: string;
  jobDescription?: string;
  additionalInfo?: string;
  profileSummary?: string;
  cvText?: string;
  lastQuestion?: string;
  userAnswer?: string;
  fullChatHistory?: string;
  numExpQuestions: string;
  numRoleQuestions: string;
  numPersonalityQuestions: string;
  expQuestionsAsked: string;
  roleQuestionsAsked: string;
  personalityQuestionsAsked: string;
  selectedVoice?: string;
}

export interface InterviewContext {
  userName: string;
  role: string;
  language: string;
  userAnswer?: string;
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
