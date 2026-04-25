import { Request, Response } from 'express';
import { detectDialogflowIntent } from '../services/chatbot.service';

export async function chatbotMessageController(req: Request, res: Response) {
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

    const resolvedLanguageCode = languageCode ? String(languageCode).trim().toLowerCase() : 'en';
    let reply = '';

    try {
      reply = await detectDialogflowIntent({
        sessionId: resolvedSessionId,
        message: String(message).trim(),
        languageCode: resolvedLanguageCode,
      });
    } catch (dialogflowError) {
      const message = dialogflowError instanceof Error ? dialogflowError.message : 'Unknown Dialogflow error';
      console.warn(`Dialogflow unavailable: ${message}`);
      reply = resolvedLanguageCode.startsWith('ur')
        ? 'اس وقت چیٹ بوٹ دستیاب نہیں ہے۔ براہِ کرم چند لمحوں بعد دوبارہ کوشش کریں۔'
        : 'The chatbot is temporarily unavailable. Please try again in a moment.';
    }

    res.status(200).json({
      sessionId: resolvedSessionId,
      reply,
    });
  } catch (error) {
    console.error('Error in /api/chatbot/message:', error);
    res.status(500).json({ error: 'Failed to process chatbot request.' });
  }
}
