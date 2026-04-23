import { Router } from 'express';
import { hudPreviewController } from '../controllers/analytics.controller';

const router = Router();

router.post('/hud-preview', hudPreviewController);

export default router;
