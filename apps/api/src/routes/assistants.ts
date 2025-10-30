import { Router, Response } from 'express';
import { Database } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { Assistant } from '../types';

const router = Router();

// Validation schema
const AssistantSchema = z.object({
  name: z.string().min(1).max(255),
  first_message: z.string().optional(),
  system_prompt: z.string().min(1),
  voice_provider: z.enum(['elevenlabs', 'openai']),
  voice_id: z.string(),
  voice_settings: z.record(z.any()).optional(),
  stt_provider: z.enum(['deepgram', 'whisper']).default('deepgram'),
  stt_model: z.string().optional(),
  stt_language: z.string().optional(),
  model_provider: z.enum(['openai', 'anthropic']),
  model_name: z.string(),
  temperature: z.number().min(0).max(1).optional(),
  max_tokens: z.number().positive().optional(),
  interruptions_enabled: z.boolean().optional(),
  background_denoising: z.boolean().optional(),
});

// Create assistant
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const validated = AssistantSchema.parse(req.body);

    const result = await Database.query(
      `INSERT INTO assistants (
        org_id, name, first_message, system_prompt,
        voice_provider, voice_id, voice_settings,
        stt_provider, stt_model, stt_language,
        model_provider, model_name, temperature, max_tokens,
        interruptions_enabled, background_denoising
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        req.organization.id,
        validated.name,
        validated.first_message || null,
        validated.system_prompt,
        validated.voice_provider,
        validated.voice_id,
        JSON.stringify(validated.voice_settings || {}),
        validated.stt_provider || 'deepgram',
        validated.stt_model || 'nova-2',
        validated.stt_language || 'en-US',
        validated.model_provider,
        validated.model_name,
        validated.temperature || 0.7,
        validated.max_tokens || 500,
        validated.interruptions_enabled ?? true,
        validated.background_denoising ?? true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create assistant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get assistant by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      'SELECT * FROM assistants WHERE id = $1 AND org_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get assistant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List assistants
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      'SELECT * FROM assistants WHERE org_id = $1 ORDER BY created_at DESC',
      [req.organization.id]
    );

    res.json({ assistants: result.rows });
  } catch (error) {
    console.error('List assistants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update assistant
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const validated = AssistantSchema.partial().parse(req.body);

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    Object.entries(validated).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(key === 'voice_settings' ? JSON.stringify(value) : value);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(req.params.id, req.organization.id);

    const query = `
      UPDATE assistants
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND org_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await Database.query(query, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update assistant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete assistant
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      'DELETE FROM assistants WHERE id = $1 AND org_id = $2 RETURNING id',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    res.json({ message: 'Assistant deleted successfully' });
  } catch (error) {
    console.error('Delete assistant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
