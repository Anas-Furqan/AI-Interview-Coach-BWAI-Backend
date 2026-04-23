import { Request, Response } from 'express';
import { computeHudMetrics } from '../utils/hudAnalytics';

export async function hudPreviewController(req: Request, res: Response) {
  const { transcript = '', startedAt = Date.now(), languageCode = 'en-US' } = req.body || {};
  const metrics = computeHudMetrics(String(transcript), Number(startedAt), String(languageCode));
  res.json(metrics);
}
