import { Request, Response } from 'express';

export async function sttConfigController(req: Request, res: Response) {
  const languageCode = String(req.query.languageCode || req.body?.languageCode || 'en-US');

  res.json({
    wsPath: '/stt',
    languageCode,
    supportsUrdu: true,
    supportedLanguageCodes: ['en-US', 'ur-PK'],
    transport: 'websocket',
  });
}
