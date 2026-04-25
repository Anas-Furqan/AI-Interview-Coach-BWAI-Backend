import { Router } from 'express';
import { analyzeHiringController } from '../controllers/hiring.controller';

const router = Router();

router.post('/analyze', analyzeHiringController);

export default router;
