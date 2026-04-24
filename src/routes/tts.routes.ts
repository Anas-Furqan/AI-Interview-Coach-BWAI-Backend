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
      return res.status(500).json({ error: 'Failed to synthesize audio demo.' });
    }

    res.json({ audioContent });
  } catch (error: any) {
    console.error('TTS Demo Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate voice demo.' });
  }
});

export default router;
