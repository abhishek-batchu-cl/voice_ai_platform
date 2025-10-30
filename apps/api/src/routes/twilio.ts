import { Router, Request, Response } from 'express';
import { Database } from '../db/database';
import { TwilioService } from '../services/TwilioService';
import { VoiceOrchestrator } from '../services/VoiceOrchestrator';
import { WebSocket } from 'ws';

const router = Router();

// Store active call sessions
const activeCalls = new Map<string, { orchestrator: VoiceOrchestrator; assistant: any }>();

// Twilio voice webhook - handles incoming calls
router.post('/voice', async (req: Request, res: Response) => {
  try {
    const { CallSid, From, To, Direction } = req.body;
    const assistantId = req.query.assistant_id as string;

    console.log(`Incoming call: ${CallSid} from ${From} to ${To}`);

    // Find assistant for this phone number
    let assistant;
    if (assistantId) {
      const result = await Database.query(
        'SELECT * FROM assistants WHERE id = $1',
        [assistantId]
      );
      assistant = result.rows[0];
    } else {
      // Find by phone number
      const result = await Database.query(
        `SELECT a.* FROM assistants a
         JOIN phone_numbers pn ON a.id = pn.assistant_id
         WHERE pn.phone_number = $1 AND pn.status = 'active'
         LIMIT 1`,
        [To]
      );
      assistant = result.rows[0];
    }

    if (!assistant) {
      const twilioService = new TwilioService();
      return res.type('text/xml').send(
        twilioService.generateTwiML({
          say: 'Sorry, this number is not configured. Please try again later.',
          hangup: true,
        })
      );
    }

    // Create call record
    const callResult = await Database.query(
      `INSERT INTO calls (
        call_sid, direction, from_number, to_number,
        status, assistant_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      [CallSid, Direction || 'inbound', From, To, 'initiated', assistant.id]
    );

    const callId = callResult.rows[0].id;

    // Create session
    const sessionResult = await Database.query(
      `INSERT INTO sessions (
        org_id, assistant_id, call_id, session_type
      ) VALUES ($1, $2, $3, $4)
      RETURNING id`,
      [assistant.org_id, assistant.id, callId, 'phone']
    );

    const sessionId = sessionResult.rows[0].id;

    // Initialize voice orchestrator
    const orchestrator = new VoiceOrchestrator(sessionId, assistant);
    activeCalls.set(CallSid, { orchestrator, assistant });

    // Get first message
    const firstMessage = await orchestrator.getFirstMessage();

    const twilioService = new TwilioService();

    if (firstMessage) {
      // Use TwiML with gather for continuous conversation
      return res.type('text/xml').send(
        twilioService.generateTwiML({
          play: firstMessage.audio ? `${process.env.BASE_URL}/audio/${callId}/first` : undefined,
          say: !firstMessage.audio ? firstMessage.text : undefined,
          gather: {
            input: ['speech'],
            action: `${process.env.BASE_URL}/api/v1/twilio/gather?call_sid=${CallSid}`,
            timeout: 3,
            speechTimeout: 'auto',
          },
        })
      );
    }

    // No first message, just gather
    return res.type('text/xml').send(
      twilioService.generateTwiML({
        gather: {
          input: ['speech'],
          action: `${process.env.BASE_URL}/api/v1/twilio/gather?call_sid=${CallSid}`,
          timeout: 3,
        },
      })
    );
  } catch (error: any) {
    console.error('Voice webhook error:', error);
    const twilioService = new TwilioService();
    return res.type('text/xml').send(
      twilioService.generateTwiML({
        say: 'An error occurred. Please try again.',
        hangup: true,
      })
    );
  }
});

// Gather - processes user speech and responds
router.post('/gather', async (req: Request, res: Response) => {
  try {
    const { CallSid, SpeechResult } = req.body;
    const callSid = (req.query.call_sid as string) || CallSid;

    console.log(`Gather from ${callSid}: "${SpeechResult}"`);

    if (!SpeechResult) {
      // No speech detected, ask again
      const twilioService = new TwilioService();
      return res.type('text/xml').send(
        twilioService.generateTwiML({
          say: "I didn't catch that. Could you please repeat?",
          gather: {
            input: ['speech'],
            action: `${process.env.BASE_URL}/api/v1/twilio/gather?call_sid=${callSid}`,
            timeout: 3,
          },
        })
      );
    }

    // Get active call
    const activeCall = activeCalls.get(callSid);
    if (!activeCall) {
      const twilioService = new TwilioService();
      return res.type('text/xml').send(
        twilioService.generateTwiML({
          say: 'Session expired. Please call again.',
          hangup: true,
        })
      );
    }

    const { orchestrator, assistant } = activeCall;

    // Process user message
    const response = await orchestrator.processUserMessage(SpeechResult);

    // Check for end call phrases
    const endPhrases = assistant.call_settings?.end_call_phrases || [];
    const shouldEnd = endPhrases.some((phrase: string) =>
      SpeechResult.toLowerCase().includes(phrase.toLowerCase())
    );

    const twilioService = new TwilioService();

    if (shouldEnd) {
      // End call
      activeCalls.delete(callSid);
      return res.type('text/xml').send(
        twilioService.generateTwiML({
          say: response.text,
          hangup: true,
        })
      );
    }

    // Continue conversation
    // In production, you'd use TTS service and play audio URL
    return res.type('text/xml').send(
      twilioService.generateTwiML({
        say: response.text,
        gather: {
          input: ['speech'],
          action: `${process.env.BASE_URL}/api/v1/twilio/gather?call_sid=${callSid}`,
          timeout: 3,
          speechTimeout: 'auto',
        },
      })
    );
  } catch (error: any) {
    console.error('Gather error:', error);
    const twilioService = new TwilioService();
    return res.type('text/xml').send(
      twilioService.generateTwiML({
        say: 'An error occurred.',
        hangup: true,
      })
    );
  }
});

// Call status callback
router.post('/status', async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;

    console.log(`Call status: ${CallSid} - ${CallStatus}`);

    // Update call in database
    await Database.query(
      `UPDATE calls
       SET status = $1,
           duration_seconds = $2,
           answered_by = $3,
           ${CallStatus === 'completed' ? 'ended_at = NOW(),' : ''}
           ${CallStatus === 'in-progress' ? 'answered_at = NOW(),' : ''}
           updated_at = NOW()
       WHERE call_sid = $4`,
      [CallStatus, CallDuration || 0, AnsweredBy, CallSid]
    );

    // Clean up active call if completed
    if (CallStatus === 'completed' || CallStatus === 'failed') {
      activeCalls.delete(CallSid);

      // End session
      await Database.query(
        `UPDATE sessions
         SET status = 'ended', ended_at = NOW()
         WHERE call_id = (SELECT id FROM calls WHERE call_sid = $1)`,
        [CallSid]
      );
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Status callback error:', error);
    res.status(500).send('Error');
  }
});

// Recording callback
router.post('/recording', async (req: Request, res: Response) => {
  try {
    const { CallSid, RecordingUrl, RecordingDuration } = req.body;

    console.log(`Recording available: ${CallSid}`);

    // Update call with recording URL
    await Database.query(
      `UPDATE calls
       SET recording_url = $1,
           recording_duration = $2
       WHERE call_sid = $3`,
      [RecordingUrl, RecordingDuration, CallSid]
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Recording callback error:', error);
    res.status(500).send('Error');
  }
});

// Transcription callback
router.post('/transcription', async (req: Request, res: Response) => {
  try {
    const { CallSid, TranscriptionText } = req.body;

    console.log(`Transcription: ${CallSid}`);

    // Store transcription in metadata
    await Database.query(
      `UPDATE calls
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{transcription}',
         $1::jsonb
       )
       WHERE call_sid = $2`,
      [JSON.stringify(TranscriptionText), CallSid]
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Transcription callback error:', error);
    res.status(500).send('Error');
  }
});

// Voicemail callback
router.post('/voicemail', async (req: Request, res: Response) => {
  try {
    const { CallSid, From, To, RecordingUrl, RecordingSid, RecordingDuration } = req.body;

    console.log(`Voicemail received: ${CallSid} from ${From}`);

    // Get organization from phone number
    const phoneResult = await Database.query(
      `SELECT org_id FROM phone_numbers WHERE phone_number = $1`,
      [To]
    );

    if (phoneResult.rows.length > 0) {
      const orgId = phoneResult.rows[0].org_id;

      // Save voicemail
      await Database.query(
        `INSERT INTO voicemails (
          org_id, call_sid, from_number, to_number,
          recording_url, recording_sid, duration_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orgId, CallSid, From, To, RecordingUrl, RecordingSid, RecordingDuration]
      );
    }

    const twilioService = new TwilioService();
    res.type('text/xml').send(
      twilioService.generateTwiML({
        say: 'Thank you for your message. Goodbye.',
        hangup: true,
      })
    );
  } catch (error) {
    console.error('Voicemail callback error:', error);
    res.status(500).send('Error');
  }
});

// Voicemail transcription callback
router.post('/voicemail-transcription', async (req: Request, res: Response) => {
  try {
    const { RecordingSid, TranscriptionText, TranscriptionStatus } = req.body;

    console.log(`Voicemail transcription: ${RecordingSid}`);

    // Update voicemail with transcription
    await Database.query(
      `UPDATE voicemails
       SET transcription = $1,
           transcription_status = $2,
           updated_at = NOW()
       WHERE recording_sid = $3`,
      [TranscriptionText, TranscriptionStatus, RecordingSid]
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Voicemail transcription callback error:', error);
    res.status(500).send('Error');
  }
});

// Conference status callback
router.post('/conference-status', async (req: Request, res: Response) => {
  try {
    const { ConferenceSid, StatusCallbackEvent, FriendlyName } = req.body;

    console.log(`Conference event: ${ConferenceSid} - ${StatusCallbackEvent}`);

    // Log conference events (can be enhanced to track participants, etc.)
    if (StatusCallbackEvent === 'conference-end') {
      // Clean up any transfer records
      await Database.query(
        `UPDATE call_transfers
         SET status = 'completed'
         WHERE conference_sid = $1`,
        [ConferenceSid]
      );
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Conference status callback error:', error);
    res.status(500).send('Error');
  }
});

// Wait music for queue
router.post('/wait-music', async (req: Request, res: Response) => {
  try {
    const twilioService = new TwilioService();

    // You can customize wait music here
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="Polly.Joanna">Thank you for holding. An agent will be with you shortly.</Say>
      <Play loop="10">http://com.twilio.sounds.music.s3.amazonaws.com/ClockworkWaltz.mp3</Play>
    </Response>`;

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Wait music error:', error);
    res.status(500).send('Error');
  }
});

export default router;
