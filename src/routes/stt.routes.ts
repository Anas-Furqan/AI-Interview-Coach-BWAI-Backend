import { Router } from 'express';
import { sttConfigController } from '../controllers/stt.controller';

const router = Router();

router.get('/config', sttConfigController);

export default router;
