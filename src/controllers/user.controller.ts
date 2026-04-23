import { Request, Response } from 'express';

export async function userProfileController(_req: Request, res: Response) {
  res.json({
    id: 'demo-user',
    name: 'Demo User',
    provider: 'firebase',
  });
}
