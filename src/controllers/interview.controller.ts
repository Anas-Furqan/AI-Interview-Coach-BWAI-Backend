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
  return JSON.parse(cleaned) as T;
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
      const postPrompt = buildPostAnswerPrompt(language, lastQuestion, userAnswer);
      const raw = await generateContentWithRetry(postPrompt);
      postAnswerAnalysis = parseJsonFromModel(raw);
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
    const conversationalResponse = await generateContentWithRetry(prompt);

    let preAnswerAnalysis: any = null;
    if (nextPhase !== 'FINISHED') {
      const prePrompt = buildPreAnswerPrompt(language, conversationalResponse, cvText, profileSummary);
      const raw = await generateContentWithRetry(prePrompt);
      preAnswerAnalysis = parseJsonFromModel(raw);
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
