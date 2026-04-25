import { Request, Response } from 'express';
import multer from 'multer';
import pdf from 'pdf-parse';
import {
  buildInterviewerPrompt,
  buildPostAnswerPrompt,
  buildPreAnswerPrompt,
  extractCandidateName,
  generateContentWithRetry,
} from '../services/gemini.service';
import { buildChallengeQuestionText, pickChallenge } from '../config/codingChallenges';
import { evaluateCodingAnswer } from '../services/codingEvaluator.service';
import { getQuestionAnalyticsForSession } from '../services/firebase.service';
import { synthesizeInterviewAudio } from '../services/tts.service';
import { InterviewContext, NextStepBody } from '../models/interview.models';

const storage = multer.memoryStorage();
export const upload = multer({ storage });

const FALLBACK_AI_MESSAGE = 'AI is thinking, please wait...';

const SAMPLE_RESUME = `Amina Khan
Senior Software Engineer
Karachi, Pakistan

Summary
- 5+ years building customer-facing web products with React, Node.js, and cloud services.
- Led a migration from legacy APIs to a modular backend that reduced response time by 38%.
- Comfortable with cross-functional delivery, stakeholder communication, and interview coaching.

Experience
TechNova Pakistan | Senior Software Engineer
- Owned an interview scheduling platform used by 40k monthly candidates.
- Built analytics dashboards for hiring teams and improved completion rate by 22%.

Education
B.S. Computer Science`;

const SAMPLE_PROFILE = {
  userName: 'Amina Khan',
  industry: 'Technology',
  role: 'Senior Software Engineer',
  targetCompany: 'Google',
  jobDescription: 'Build scalable interview tooling and analytics products.',
  profileSummary: 'Product-minded engineer with strong delivery and communication skills.',
  additionalInfo: 'Demo profile for judges. Focus on clarity, ownership, and STAR structure.',
  numExpQuestions: '2',
  numRoleQuestions: '2',
  numPersonalityQuestions: '1',
  expQuestionsAsked: '0',
  roleQuestionsAsked: '0',
  personalityQuestionsAsked: '0',
  language: 'English',
  languageCode: 'en-US',
  selectedVoice: '',
  difficulty: 'MEDIUM',
  interviewMode: 'BEHAVIORAL',
};

function parseJsonFromModel<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]) as T;
    }
    throw new Error('Model response did not contain valid JSON.');
  }
}

function buildFallbackInterviewerText(language: string, nextPhase: string, role: string): string {
  const isUrdu = /urdu|ur/i.test(language || '');

  if (isUrdu) {
    if (nextPhase === 'INTRODUCTION') {
      return 'السلام علیکم! براہ کرم اپنا مختصر تعارف دیں اور اپنے حالیہ تجربے کے بارے میں بتائیں۔';
    }
    if (nextPhase === 'EXPERIENCE') {
      return `اپنے ${role} کے تجربے سے کوئی ایک مشکل مسئلہ بتائیں اور آپ نے اسے کیسے حل کیا؟`;
    }
    if (nextPhase === 'ROLE_SPECIFIC') {
      return `اس ${role} رول میں آپ پہلے 90 دنوں میں کون سی ترجیحات رکھیں گے اور کیوں؟`;
    }
    if (nextPhase === 'PERSONALITY') {
      return 'ایسا وقت بیان کریں جب آپ کو ٹیم میں اختلاف رائے کا سامنا ہوا اور آپ نے اسے کیسے ہینڈل کیا۔';
    }
    return 'شکریہ۔ انٹرویو مکمل ہوا۔';
  }

  if (nextPhase === 'INTRODUCTION') {
    return 'Welcome. Please give a concise self-introduction and summarize your recent experience.';
  }
  if (nextPhase === 'EXPERIENCE') {
    return `Tell me about a challenging problem you handled in your ${role} experience and how you solved it.`;
  }
  if (nextPhase === 'ROLE_SPECIFIC') {
    return `For this ${role} role, what would your top priorities be in the first 90 days, and why?`;
  }
  if (nextPhase === 'PERSONALITY') {
    return 'Describe a time you disagreed with a teammate and how you handled the situation.';
  }

  return 'Thank you. The interview is complete.';
}

function isRetryableGeminiError(error: any): boolean {
  const status = Number(error?.status);
  return status === 429 || status === 500 || status === 503;
}

function buildSessionAnalytics(questionAnalytics: Array<Record<string, any>>) {
  const totalQuestions = questionAnalytics.length;
  const filler_count = questionAnalytics.reduce((sum, item) => sum + Number(item.fillerCount || 0), 0);
  const totalWpm = questionAnalytics.reduce((sum, item) => sum + Number(item.wpm || 0), 0);
  const starCompliantQuestions = questionAnalytics.filter(item => {
    if (item.starMissing) return false;
    const status = item.starStatus || {};
    return Boolean(status.hasSituation && status.hasTask && status.hasAction && status.hasResult);
  }).length;

  return {
    filler_count,
    avg_wpm: totalQuestions > 0 ? Math.round(totalWpm / totalQuestions) : 0,
    star_compliance: totalQuestions > 0 ? Math.round((starCompliantQuestions / totalQuestions) * 100) : 0,
    confidence_scores: questionAnalytics.map(item => ({
      questionId: String(item.questionId || ''),
      confidence: Number(item.confidence || 0),
      score: Number(item.score || 0),
    })),
  };
}

function extractChallengeIdFromQuestion(lastQuestion: string): string | null {
  const match = lastQuestion.match(/\[CHALLENGE:([a-z0-9-]+)\]/i);
  return match?.[1] || null;
}

async function resolveInterviewStep(payload: {
  body: NextStepBody;
  cvText: string;
  userName: string;
}) {
  const {
    phase,
    language,
    languageCode = 'en-US',
    selectedVoice,
    lastQuestion = '',
    userAnswer = '',
    jobDescription,
    additionalInfo,
    profileSummary,
    numExpQuestions,
    numRoleQuestions,
    numPersonalityQuestions,
    expQuestionsAsked,
    roleQuestionsAsked,
    personalityQuestionsAsked,
    fullChatHistory,
    role = 'Candidate',
    targetCompany = '',
    difficulty = 'MEDIUM',
    interviewMode = 'BEHAVIORAL',
    codeAnswer = '',
  } = payload.body;

  const context: InterviewContext = {
    userName: payload.userName,
    role,
    targetCompany,
    difficulty,
    interviewMode,
    language,
    userAnswer,
    codeAnswer,
    cvText: payload.cvText,
    jobDescription,
    additionalInfo,
    profileSummary,
    fullChatHistory,
    numExpQuestions,
    numRoleQuestions,
    numPersonalityQuestions,
    expQuestionsAsked,
    roleQuestionsAsked,
    personalityQuestionsAsked,
  };

  let postAnswerAnalysis: any = null;
  const normalizedInterviewMode = String(interviewMode || 'BEHAVIORAL').toUpperCase();

  if ((userAnswer || codeAnswer) && normalizedInterviewMode === 'CODING' && codeAnswer.trim()) {
    const challengeId = extractChallengeIdFromQuestion(lastQuestion);
    if (challengeId) {
      postAnswerAnalysis = evaluateCodingAnswer(challengeId, codeAnswer.trim());
    }
  }

  if (!postAnswerAnalysis && (userAnswer || codeAnswer)) {
    try {
      const postPrompt = buildPostAnswerPrompt(language, lastQuestion, userAnswer, codeAnswer);
      const raw = await generateContentWithRetry(postPrompt);
      postAnswerAnalysis = parseJsonFromModel(raw);
    } catch (error) {
      console.error('Post-answer analysis generation/parsing failed:', error);
    }
  }

  const { prompt, nextPhase } = buildInterviewerPrompt(phase, context);
  let conversationalResponse = '';

  if (normalizedInterviewMode === 'CODING' && nextPhase === 'ROLE_SPECIFIC') {
    const challengeIndex = Number.parseInt(String(roleQuestionsAsked || '0'), 10) || 0;
    const challenge = pickChallenge(challengeIndex, difficulty);
    conversationalResponse = buildChallengeQuestionText(challenge);
  }

  if (!conversationalResponse) {
    try {
      conversationalResponse = await generateContentWithRetry(prompt);
    } catch (error) {
      console.error('Interviewer generation failed, using fallback prompt:', error);
      conversationalResponse = isRetryableGeminiError(error) ? FALLBACK_AI_MESSAGE : buildFallbackInterviewerText(language, nextPhase, role);
    }
  }

  let preAnswerAnalysis: any = null;
  if (nextPhase !== 'FINISHED' && normalizedInterviewMode === 'CODING' && nextPhase === 'ROLE_SPECIFIC') {
    preAnswerAnalysis = {
      hint: 'Write the simplest correct solution first, then discuss complexity and edge cases.',
      exampleAnswer: 'Follow the exact function signature from the prompt and return the required output type.',
    };
  }

  if (!preAnswerAnalysis && nextPhase !== 'FINISHED') {
    try {
      const prePrompt = buildPreAnswerPrompt(language, conversationalResponse, payload.cvText, profileSummary);
      const raw = await generateContentWithRetry(prePrompt);
      preAnswerAnalysis = parseJsonFromModel(raw);
    } catch (error) {
      console.error('Pre-answer analysis generation/parsing failed:', error);
    }
  }

  const audioContent = await synthesizeInterviewAudio(conversationalResponse, languageCode, selectedVoice);

  return {
    conversationalResponse,
    audioContent,
    postAnswerAnalysis,
    preAnswerAnalysis,
    nextPhase,
    cvText: payload.cvText,
    userName: payload.userName,
  };
}

export async function healthController(_req: Request, res: Response) {
  res.send('AI Interview Coach Backend is running!');
}

export async function nextStepController(req: Request, res: Response) {
  try {
    const body = req.body as NextStepBody;

    let cvText = body.cvText || '';
    let userName = body.userName || 'Candidate';

    if (body.phase === 'GREETING' && req.file) {
      try {
        cvText = (await pdf(req.file.buffer)).text;
        userName = await extractCandidateName(cvText);
      } catch (error) {
        console.error('CV parsing failed:', error);
      }
    }

    const response = await resolveInterviewStep({ body, cvText, userName });

    res.json(response);
  } catch (error) {
    console.error('Error in /api/interview/next-step:', error);
    res.status(500).json({ error: 'Failed to process interview step.' });
  }
}

export async function demoSessionController(_req: Request, res: Response) {
  try {
    const response = await resolveInterviewStep({
      body: {
        ...SAMPLE_PROFILE,
        phase: 'GREETING',
      } as NextStepBody,
      cvText: SAMPLE_RESUME,
      userName: SAMPLE_PROFILE.userName,
    });

    res.status(201).json({
      ...response,
      sampleResume: SAMPLE_RESUME,
      sampleProfile: SAMPLE_PROFILE,
    });
  } catch (error) {
    console.error('Error in /api/session/demo:', error);
    res.status(500).json({ error: 'Failed to build demo session.' });
  }
}

export async function summarizeController(req: Request, res: Response) {
  try {
    const { fullChatHistory, analysisHistory, language, sessionId } = req.body;
  const summaryPrompt = `You are a strict FAANG hiring committee. Analyze the transcript and performance. 
Respond ONLY as valid JSON with these EXACT keys: 
- "finalScore" (number between 0-10),
- "selectionProbability" (number between 0-100 indicating the realistic chance of them getting hired),
- "strengths" (string using markdown), 
- "areasForImprovement" (string using markdown).`;
  const fullSummaryPrompt = `${summaryPrompt}
Language: ${language}.
Transcript: ${JSON.stringify(fullChatHistory)}
Analyses: ${JSON.stringify(analysisHistory)}`;

  const raw = await generateContentWithRetry(fullSummaryPrompt);
    const summary = parseJsonFromModel(raw) as Record<string, unknown>;

    let analytics = null;
    if (sessionId) {
      const questionAnalytics = await getQuestionAnalyticsForSession(String(sessionId));
      analytics = buildSessionAnalytics(questionAnalytics as Array<Record<string, any>>);
    }

    res.json({
      ...summary,
      analytics,
    });
  } catch (error) {
    console.error('Error in /api/interview/summarize:', error);
    if (isRetryableGeminiError(error)) {
      res.status(200).json({
        finalScore: 0,
        strengths: 'AI is thinking, please wait...',
        areasForImprovement: 'AI is thinking, please wait...',
        selectionProbability: 0,
        analytics: null,
      });
      return;
    }
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
}
