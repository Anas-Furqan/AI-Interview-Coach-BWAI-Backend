import { Router } from 'express';
import {
  healthController,
  nextStepController,
  summarizeController,
  upload,
} from '../controllers/interview.controller';

const router = Router();

router.get('/health', healthController);
router.post('/next-step', upload.single('cvFile'), nextStepController);
router.post('/summarize', summarizeController);

export default router;
