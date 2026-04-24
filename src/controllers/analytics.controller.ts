import { Request, Response } from 'express';
import { computeHudMetrics } from '../utils/hudAnalytics';
import { generateContentWithRetry } from '../services/gemini.service';

export async function hudPreviewController(req: Request, res: Response) {
  const { transcript = '', startedAt = Date.now(), languageCode = 'en-US' } = req.body || {};
  const metrics = computeHudMetrics(String(transcript), Number(startedAt), String(languageCode));
  res.json(metrics);
}

export async function starNudgeController(req: Request, res: Response) {
  const defaultNudge = {
    nudge: 'Use STAR: set context, define your task, explain actions, and finish with a measurable result.',
    starMissing: true,
    score: 5,
    starStatus: {
      hasSituation: false,
      hasTask: false,
      hasAction: false,
      hasResult: false,
    },
  };

  try {
    const { transcript = '', question = '', language = 'English' } = req.body || {};
    const trimmedTranscript = String(transcript).trim();
    const trimmedQuestion = String(question).trim();

    if (!trimmedTranscript || !trimmedQuestion) {
      res.status(400).json({ error: 'transcript and question are required.' });
      return;
    }

    const prompt = `You are an interview coach. Evaluate if the answer follows STAR (Situation, Task, Action, Result).
Question: """${trimmedQuestion}"""
Answer: """${trimmedTranscript}"""
Language: ${language}
Respond only in valid JSON with keys:
- nudge: one concise actionable suggestion (max 20 words)
- starMissing: boolean
- score: number from 0 to 10
- starStatus: object with keys hasSituation, hasTask, hasAction, hasResult (all boolean)`;

    const raw = await generateContentWithRetry(prompt);
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();

    let parsed: {
      nudge?: string;
      starMissing?: boolean;
      score?: number;
      starStatus?: {
        hasSituation: boolean;
        hasTask: boolean;
        hasAction: boolean;
        hasResult: boolean;
      };
    } | null = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        parsed = JSON.parse(objectMatch[0]);
      }
    }

    if (!parsed) {
      res.json(defaultNudge);
      return;
    }

    res.json({
      nudge: String(parsed.nudge || defaultNudge.nudge),
      starMissing: Boolean(parsed.starMissing),
      score: Number.isFinite(Number(parsed.score)) ? Number(parsed.score) : defaultNudge.score,
      starStatus: parsed.starStatus || defaultNudge.starStatus,
    });
  } catch (error) {
    console.error('starNudgeController error:', error);
    res.json(defaultNudge);
  }
}
