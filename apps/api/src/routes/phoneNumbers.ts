import { Router, Response } from 'express';
import { Database } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { TwilioService } from '../services/TwilioService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const PurchaseNumberSchema = z.object({
  countryCode: z.string().default('US'),
  areaCode: z.string().optional(),
  assistantId: z.string().uuid().optional(),
});

const SearchNumberSchema = z.object({
  countryCode: z.string().default('US'),
  areaCode: z.string().optional(),
  contains: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
});

// Search available phone numbers
router.post('/search', async (req: AuthRequest, res: Response) => {
  try {
    const validated = SearchNumberSchema.parse(req.body);

    // Get Twilio credentials from organization
    const orgResult = await Database.query(
      'SELECT twilio_account_sid, twilio_auth_token FROM organizations WHERE id = $1',
      [req.organization.id]
    );

    if (!orgResult.rows[0]?.twilio_account_sid) {
      return res.status(400).json({
        error: 'Twilio credentials not configured',
        message: 'Please configure Twilio credentials in organization settings',
      });
    }

    const twilioService = new TwilioService(
      orgResult.rows[0].twilio_account_sid,
      orgResult.rows[0].twilio_auth_token
    );

    const availableNumbers = await twilioService.searchAvailableNumbers({
      countryCode: validated.countryCode,
      areaCode: validated.areaCode,
      contains: validated.contains,
      limit: validated.limit,
    });

    res.json({ numbers: availableNumbers });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Search numbers error:', error);
    res.status(500).json({ error: 'Failed to search phone numbers' });
  }
});

// Purchase a phone number
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const validated = PurchaseNumberSchema.parse(req.body);

    // Get Twilio credentials
    const orgResult = await Database.query(
      'SELECT twilio_account_sid, twilio_auth_token FROM organizations WHERE id = $1',
      [req.organization.id]
    );

    if (!orgResult.rows[0]?.twilio_account_sid) {
      return res.status(400).json({ error: 'Twilio credentials not configured' });
    }

    const twilioService = new TwilioService(
      orgResult.rows[0].twilio_account_sid,
      orgResult.rows[0].twilio_auth_token
    );

    // Purchase number
    const purchasedNumber = await twilioService.purchasePhoneNumber(
      validated.countryCode,
      validated.areaCode
    );

    // Save to database
    const result = await Database.query(
      `INSERT INTO phone_numbers (
        org_id, phone_number, friendly_name, country_code,
        twilio_sid, capabilities, assistant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        req.organization.id,
        purchasedNumber.phoneNumber,
        purchasedNumber.friendlyName,
        validated.countryCode,
        purchasedNumber.sid,
        JSON.stringify(purchasedNumber.capabilities),
        validated.assistantId || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Purchase number error:', error);
    res.status(500).json({ error: 'Failed to purchase phone number', message: error.message });
  }
});

// List phone numbers
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      `SELECT pn.*, a.name as assistant_name
       FROM phone_numbers pn
       LEFT JOIN assistants a ON pn.assistant_id = a.id
       WHERE pn.org_id = $1
       ORDER BY pn.created_at DESC`,
      [req.organization.id]
    );

    res.json({ phoneNumbers: result.rows });
  } catch (error) {
    console.error('List numbers error:', error);
    res.status(500).json({ error: 'Failed to list phone numbers' });
  }
});

// Get phone number details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      `SELECT pn.*, a.name as assistant_name
       FROM phone_numbers pn
       LEFT JOIN assistants a ON pn.assistant_id = a.id
       WHERE pn.id = $1 AND pn.org_id = $2`,
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get number error:', error);
    res.status(500).json({ error: 'Failed to get phone number' });
  }
});

// Update phone number (assign assistant, update status)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { assistantId, status } = req.body;

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    if (assistantId !== undefined) {
      updateFields.push(`assistant_id = $${paramCount}`);
      updateValues.push(assistantId);
      paramCount++;
    }

    if (status) {
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.params.id, req.organization.id);

    const query = `
      UPDATE phone_numbers
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND org_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await Database.query(query, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update number error:', error);
    res.status(500).json({ error: 'Failed to update phone number' });
  }
});

// Release/delete phone number
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Get phone number details
    const phoneResult = await Database.query(
      'SELECT * FROM phone_numbers WHERE id = $1 AND org_id = $2',
      [req.params.id, req.organization.id]
    );

    if (phoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    const phoneNumber = phoneResult.rows[0];

    // Get Twilio credentials
    const orgResult = await Database.query(
      'SELECT twilio_account_sid, twilio_auth_token FROM organizations WHERE id = $1',
      [req.organization.id]
    );

    if (orgResult.rows[0]?.twilio_account_sid && phoneNumber.twilio_sid) {
      const twilioService = new TwilioService(
        orgResult.rows[0].twilio_account_sid,
        orgResult.rows[0].twilio_auth_token
      );

      // Release from Twilio
      await twilioService.releasePhoneNumber(phoneNumber.twilio_sid);
    }

    // Delete from database
    await Database.query(
      'DELETE FROM phone_numbers WHERE id = $1 AND org_id = $2',
      [req.params.id, req.organization.id]
    );

    res.json({ message: 'Phone number released successfully' });
  } catch (error: any) {
    console.error('Release number error:', error);
    res.status(500).json({ error: 'Failed to release phone number', message: error.message });
  }
});

export default router;
