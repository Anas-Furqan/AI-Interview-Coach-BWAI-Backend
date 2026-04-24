import { Router } from 'express';
import multer from 'multer';
import { analyzeResume } from '../services/ats.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/check', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded.' });
    }

    const analysis = await analyzeResume(req.file.buffer);
    res.json(analysis);
  } catch (error: any) {
    console.error('ATS Check Error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze resume.' });
  }
});

export default router;
