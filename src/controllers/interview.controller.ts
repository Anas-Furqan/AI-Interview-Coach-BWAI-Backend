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
import { synthesizeInterviewAudio } from '../services/tts.service';
import { InterviewContext, NextStepBody } from '../models/interview.models';

const storage = multer.memoryStorage();
export const upload = multer({ storage });

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

export async function healthController(_req: Request, res: Response) {
  res.send('AI Interview Coach Backend is running!');
}

export async function nextStepController(req: Request, res: Response) {
  try {
    const body = req.body as NextStepBody;
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
    } = body;

    let cvText = body.cvText || '';
    let userName = body.userName || 'Candidate';

    if (phase === 'GREETING' && req.file) {
      try {
        cvText = (await pdf(req.file.buffer)).text;
        userName = await extractCandidateName(cvText);
      } catch (error) {
        console.error('CV parsing failed:', error);
      }
    }

    let postAnswerAnalysis: any = null;
    if (userAnswer) {
      try {
        const postPrompt = buildPostAnswerPrompt(language, lastQuestion, userAnswer);
        const raw = await generateContentWithRetry(postPrompt);
        postAnswerAnalysis = parseJsonFromModel(raw);
      } catch (error) {
        console.error('Post-answer analysis generation/parsing failed:', error);
      }
    }

    const context: InterviewContext = {
      userName,
      role,
      language,
      userAnswer,
      cvText,
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

    const { prompt, nextPhase } = buildInterviewerPrompt(phase, context);
    let conversationalResponse: string;

    try {
      conversationalResponse = await generateContentWithRetry(prompt);
    } catch (error) {
      console.error('Interviewer generation failed, using fallback prompt:', error);
      conversationalResponse = buildFallbackInterviewerText(language, nextPhase, role);
    }

    let preAnswerAnalysis: any = null;
    if (nextPhase !== 'FINISHED') {
      try {
        const prePrompt = buildPreAnswerPrompt(language, conversationalResponse, cvText, profileSummary);
        const raw = await generateContentWithRetry(prePrompt);
        preAnswerAnalysis = parseJsonFromModel(raw);
      } catch (error) {
        console.error('Pre-answer analysis generation/parsing failed:', error);
      }
    }

    const audioContent = await synthesizeInterviewAudio(conversationalResponse, languageCode, selectedVoice);

    res.json({
      conversationalResponse,
      audioContent,
      postAnswerAnalysis,
      preAnswerAnalysis,
      nextPhase,
      cvText,
      userName,
    });
  } catch (error) {
    console.error('Error in /api/interview/next-step:', error);
    res.status(500).json({ error: 'Failed to process interview step.' });
  }
}

export async function summarizeController(req: Request, res: Response) {
  try {
    const { fullChatHistory, analysisHistory, language } = req.body;
    const summaryPrompt = `You are an expert career coach. Analyze transcript and analyses. Language was ${language}. Respond only as valid JSON with keys finalScore, strengths, areasForImprovement. Transcript: ${JSON.stringify(fullChatHistory)} Analyses: ${JSON.stringify(analysisHistory)}`;

    const raw = await generateContentWithRetry(summaryPrompt);
    const summary = parseJsonFromModel(raw);
    res.json(summary);
  } catch (error) {
    console.error('Error in /api/interview/summarize:', error);
    res.status(500).json({ error: 'Failed to generate summary.' });
  }
}
