import { Request, Response, NextFunction } from 'express';
import { Database } from '../db/database';

export interface AuthRequest extends Request {
  organization?: any;
}

export async function authenticateApiKey(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    const result = await Database.query(
      'SELECT * FROM organizations WHERE api_key = $1',
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.organization = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
