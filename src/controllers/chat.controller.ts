import { Request, Response } from 'express';
import { detectDialogflowIntent } from '../services/chatbot.service';

export async function chatController(req: Request, res: Response) {
  try {
    const { sessionId, message, languageCode } = req.body as {
      sessionId?: string;
      message?: string;
      languageCode?: string;
    };

    if (!message || !String(message).trim()) {
      res.status(400).json({ error: 'message is required.' });
      return;
    }

    const resolvedSessionId = sessionId && String(sessionId).trim()
      ? String(sessionId).trim()
      : `web-${Date.now()}`;

    const responseLanguageCode = languageCode ? String(languageCode).trim().toLowerCase() : 'en';

    let reply = '';

    try {
      reply = await detectDialogflowIntent({
        sessionId: resolvedSessionId,
        message: String(message).trim(),
        languageCode: responseLanguageCode,
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Dialogflow request failed.';
      console.warn(`Dialogflow error: ${messageText}`);
      reply = responseLanguageCode.startsWith('ur')
        ? 'اس وقت چیٹ بوٹ دستیاب نہیں ہے۔ براہِ کرم کچھ دیر بعد دوبارہ کوشش کریں۔'
        : 'The assistant is temporarily unavailable. Please try again in a moment.';
    }

    res.status(200).json({ sessionId: resolvedSessionId, reply });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: 'Failed to process chat request.' });
  }
}
