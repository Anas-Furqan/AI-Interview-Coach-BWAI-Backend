import { Router } from 'express';
import { starNudgeController } from '../controllers/gemini.controller';

const router = Router();

router.post('/star-nudge', starNudgeController);

export default router;
