import { Router } from 'express';
import { synthesizeInterviewAudio } from '../services/tts.service';

const router = Router();

router.post('/demo', async (req, res) => {
  try {
    const { voiceName, languageCode, text } = req.body;
    
    if (!voiceName || !languageCode || !text) {
      return res.status(400).json({ error: 'voiceName, languageCode, and text are required.' });
    }

    const audioContent = await synthesizeInterviewAudio(text, languageCode, voiceName);
    
    if (!audioContent) {
      return res.status(503).json({ error: 'Unable to synthesize audio. Enable the Cloud Text-to-Speech API in Google Cloud Console and try again.' });
    }

    res.json({ audioContent });
  } catch (error: any) {
    console.error('TTS Demo Error:', error);
    const message = error?.details || error?.message || 'Failed to generate voice demo.';
    const status = error?.code === 7 ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
