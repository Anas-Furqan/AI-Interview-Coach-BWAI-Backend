import { Router } from 'express';
import multer from 'multer';
import { analyzeLinkedInProfile } from '../services/linkedin.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/optimize', upload.single('profilePdf'), async (req, res) => {
  try {
    const rawText = String(req.body?.rawText || '').trim();
    const file = req.file;

    if (!file && !rawText) {
      res.status(400).json({ error: 'Upload a LinkedIn PDF or provide raw text.' });
      return;
    }

    if (file && file.mimetype !== 'application/pdf') {
      res.status(400).json({ error: 'Only PDF files are supported for uploads.' });
      return;
    }

    const analysis = await analyzeLinkedInProfile({
      pdfBuffer: file?.buffer,
      rawText,
    });

    res.json({
      analysis,
      source: file ? 'pdf' : 'text',
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('LinkedIn optimize route error:', error);
    res.status(500).json({ error: error?.message || 'Failed to optimize LinkedIn profile.' });
  }
});

export default router;
