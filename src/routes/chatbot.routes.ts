import { Router } from 'express';
import { chatbotMessageController } from '../controllers/chatbot.controller';

const router = Router();

router.post('/message', chatbotMessageController);

export default router;
