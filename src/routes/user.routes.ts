import { Router } from 'express';
import { userProfileController } from '../controllers/user.controller';

const router = Router();

router.get('/profile', userProfileController);

export default router;
