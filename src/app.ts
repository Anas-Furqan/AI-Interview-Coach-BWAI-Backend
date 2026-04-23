import express from 'express';
import cors from 'cors';
import interviewRoutes from './routes/interview.routes';
import userRoutes from './routes/user.routes';
import analyticsRoutes from './routes/analytics.routes';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cors());

  app.get('/', (_req, res) => {
    res.send('AI Interview Coach Backend is running!');
  });

  app.use('/api/interview', interviewRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/analytics', analyticsRoutes);

  return app;
}
