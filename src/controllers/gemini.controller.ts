import { Request, Response } from 'express';

function detectStarNudge(answer: string) {
  const normalized = answer.toLowerCase();

  const hasSituation = /\b(situation|context|background|when i was)\b/.test(normalized);
  const hasTask = /\b(task|goal|objective|challenge|responsib)\b/.test(normalized);
  const hasAction = /\b(action|i (led|built|implemented|created|designed|resolved|optimized|collaborated|executed))\b/.test(normalized);
  const hasResult = /\b(result|outcome|impact|improved|increased|reduced|achieved|delivered)\b/.test(normalized);

  return {
    hasSituation,
    hasTask,
    hasAction,
    hasResult,
    needsNudge: !(hasSituation && hasTask && hasAction && hasResult),
  };
}

export async function starNudgeController(req: Request, res: Response) {
  const answer = String(req.body?.answer || '');
  const star = detectStarNudge(answer);

  res.json({
    ...star,
    message: star.needsNudge
      ? 'Try structuring your answer with Situation, Task, Action, and Result for stronger impact.'
      : 'Great structure. Your answer follows STAR well.',
  });
}
