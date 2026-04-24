import { Router } from 'express';
import multer from 'multer';
import { analyzeResume } from '../services/ats.service';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/check', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No resume file uploaded.' });
    }

    console.log('Processing resume file:', req.file.originalname, 'Size:', req.file.size);
    
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported.' });
    }

    const analysis = await analyzeResume(req.file.buffer);
    res.json(analysis);
  } catch (error: any) {
    console.error('ATS Check Route Error:', error);
    const errorMessage = error?.message || 'Failed to analyze resume.';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
