import { Router } from 'express';
import { demoSessionController } from '../controllers/interview.controller';

const router = Router();

router.post('/demo', demoSessionController);

export default router;
