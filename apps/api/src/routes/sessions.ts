import { Router, Response } from 'express';
import { Database } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Create session
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { assistant_id, metadata } = req.body;

    if (!assistant_id) {
      return res.status(400).json({ error: 'assistant_id is required' });
    }

    // Verify assistant exists and belongs to org
    const assistantResult = await Database.query(
      'SELECT * FROM assistants WHERE id = $1 AND org_id = $2',
      [assistant_id, req.organization.id]
    );

    if (assistantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    const result = await Database.query(
      `INSERT INTO sessions (org_id, assistant_id, metadata)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.organization.id, assistant_id, JSON.stringify(metadata || {})]
    );

    const session = result.rows[0];
    const assistant = assistantResult.rows[0];

    res.status(201).json({
      session,
      assistant,
      websocket_url: `ws://localhost:${process.env.WS_PORT || 8080}?session_id=${session.id}`,
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      'SELECT * FROM sessions WHERE id = $1 AND org_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End session
router.post('/:id/end', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      `UPDATE sessions
       SET status = 'ended', ended_at = NOW()
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session messages
router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    // Verify session belongs to org
    const sessionResult = await Database.query(
      'SELECT * FROM sessions WHERE id = $1 AND org_id = $2',
      [req.params.id, req.organization.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messagesResult = await Database.query(
      'SELECT * FROM messages WHERE session_id = $1 ORDER BY timestamp ASC',
      [req.params.id]
    );

    res.json({ messages: messagesResult.rows });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
