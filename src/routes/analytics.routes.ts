import { Router } from 'express';
import { hudPreviewController, starNudgeController } from '../controllers/analytics.controller';

const router = Router();

router.post('/hud-preview', hudPreviewController);
router.post('/star-nudge', starNudgeController);

export default router;
