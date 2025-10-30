import twilio from 'twilio';
import { Database } from '../db/database';

export class TwilioService {
  private client: twilio.Twilio | null = null;
  private accountSid: string;
  private authToken: string;

  constructor(accountSid?: string, authToken?: string) {
    this.accountSid = accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = authToken || process.env.TWILIO_AUTH_TOKEN || '';

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  private ensureClient(): twilio.Twilio {
    if (!this.client) {
      throw new Error('Twilio client not initialized. Check your Twilio credentials.');
    }
    return this.client;
  }

  // Purchase a phone number
  async purchasePhoneNumber(
    countryCode: string = 'US',
    areaCode?: string,
    capabilities: { voice?: boolean; sms?: boolean } = { voice: true }
  ) {
    try {
      const client = this.ensureClient();

      // Search for available numbers
      const numbers = await client.availablePhoneNumbers(countryCode).local.list({
        areaCode: areaCode ? parseInt(areaCode) : undefined,
        voiceEnabled: capabilities.voice,
        smsEnabled: capabilities.sms,
        limit: 1,
      });

      if (numbers.length === 0) {
        throw new Error('No available phone numbers found');
      }

      const selectedNumber = numbers[0];

      // Purchase the number
      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumber: selectedNumber.phoneNumber,
        voiceUrl: `${process.env.BASE_URL}/api/v1/twilio/voice`,
        voiceMethod: 'POST',
        statusCallback: `${process.env.BASE_URL}/api/v1/twilio/status`,
        statusCallbackMethod: 'POST',
      });

      return {
        phoneNumber: purchasedNumber.phoneNumber,
        friendlyName: purchasedNumber.friendlyName,
        sid: purchasedNumber.sid,
        capabilities: {
          voice: purchasedNumber.capabilities.voice,
          sms: purchasedNumber.capabilities.sms,
          mms: purchasedNumber.capabilities.mms,
        },
      };
    } catch (error: any) {
      console.error('Error purchasing phone number:', error);
      throw new Error(`Failed to purchase phone number: ${error.message}`);
    }
  }

  // Release a phone number
  async releasePhoneNumber(sid: string) {
    try {
      const client = this.ensureClient();
      await client.incomingPhoneNumbers(sid).remove();
      return { success: true };
    } catch (error: any) {
      console.error('Error releasing phone number:', error);
      throw new Error(`Failed to release phone number: ${error.message}`);
    }
  }

  // Make an outbound call
  async makeCall(params: {
    to: string;
    from: string;
    assistantId: string;
    metadata?: any;
    detectVoicemail?: boolean;
  }) {
    try {
      const client = this.ensureClient();
      const callParams: any = {
        to: params.to,
        from: params.from,
        url: `${process.env.BASE_URL}/api/v1/twilio/voice?assistant_id=${params.assistantId}`,
        statusCallback: `${process.env.BASE_URL}/api/v1/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true,
        recordingStatusCallback: `${process.env.BASE_URL}/api/v1/twilio/recording`,
      };

      // Enable voicemail detection if requested
      if (params.detectVoicemail) {
        callParams.machineDetection = 'DetectMessageEnd';
        callParams.machineDetectionTimeout = 30;
        callParams.machineDetectionSpeechThreshold = 2400;
        callParams.machineDetectionSpeechEndThreshold = 1200;
        callParams.machineDetectionSilenceTimeout = 5000;
      }

      const call = await client.calls.create(callParams);

      // Save call to database
      await Database.query(
        `INSERT INTO calls (
          call_sid, direction, from_number, to_number,
          status, assistant_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          call.sid,
          'outbound',
          params.from,
          params.to,
          'initiated',
          params.assistantId,
          JSON.stringify(params.metadata || {}),
        ]
      );

      return {
        callSid: call.sid,
        status: call.status,
        to: call.to,
        from: call.from,
      };
    } catch (error: any) {
      console.error('Error making call:', error);
      throw new Error(`Failed to make call: ${error.message}`);
    }
  }

  // Generate TwiML for voice response
  generateTwiML(params: {
    say?: string;
    play?: string;
    gather?: {
      input?: string[];
      action?: string;
      timeout?: number;
      speechTimeout?: string;
      speechModel?: string;
    };
    record?: boolean;
    hangup?: boolean;
  }): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (params.say) {
      response.say(
        {
          voice: 'Polly.Joanna',
        },
        params.say
      );
    }

    if (params.play) {
      response.play(params.play);
    }

    if (params.gather) {
      const gather = response.gather({
        input: (params.gather.input || ['speech']) as any,
        action: params.gather.action,
        timeout: params.gather.timeout || 3,
        speechTimeout: params.gather.speechTimeout || 'auto',
        speechModel: (params.gather.speechModel || 'experimental_conversations') as any,
      });

      if (params.say) {
        gather.say(params.say);
      }
    }

    if (params.record) {
      response.record({
        action: `${process.env.BASE_URL}/api/v1/twilio/recording`,
        transcribe: true,
        transcribeCallback: `${process.env.BASE_URL}/api/v1/twilio/transcription`,
      });
    }

    if (params.hangup) {
      response.hangup();
    }

    return response.toString();
  }

  // Create a TwiML stream for real-time audio
  generateStreamTwiML(streamUrl: string, customParams?: any): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    const connect = response.connect();
    connect.stream({
      url: streamUrl,
      ...customParams,
    });

    return response.toString();
  }

  // Update call status
  async updateCallStatus(callSid: string, status: string) {
    try {
      const client = this.ensureClient();
      const call = await client.calls(callSid).fetch();

      await Database.query(
        `UPDATE calls
         SET status = $1,
             duration_seconds = $2,
             cost = $3
         WHERE call_sid = $4`,
        [status, call.duration, call.price, callSid]
      );

      return call;
    } catch (error: any) {
      console.error('Error updating call status:', error);
      throw error;
    }
  }

  // Get call details
  async getCallDetails(callSid: string) {
    try {
      const client = this.ensureClient();
      const call = await client.calls(callSid).fetch();
      return {
        sid: call.sid,
        status: call.status,
        duration: call.duration,
        from: call.from,
        to: call.to,
        price: call.price,
        priceUnit: call.priceUnit,
        answeredBy: call.answeredBy,
      };
    } catch (error: any) {
      console.error('Error getting call details:', error);
      throw error;
    }
  }

  // List available phone numbers
  async searchAvailableNumbers(params: {
    countryCode?: string;
    areaCode?: string;
    contains?: string;
    limit?: number;
  }) {
    try {
      const client = this.ensureClient();
      const numbers = await client
        .availablePhoneNumbers(params.countryCode || 'US')
        .local.list({
          areaCode: params.areaCode ? parseInt(params.areaCode) : undefined,
          contains: params.contains,
          limit: params.limit || 10,
        });

      return numbers.map((num) => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        locality: num.locality,
        region: num.region,
        capabilities: num.capabilities,
      }));
    } catch (error: any) {
      console.error('Error searching numbers:', error);
      throw error;
    }
  }

  // List international numbers
  async searchInternationalNumbers(params: {
    countryCode: string;
    limit?: number;
  }) {
    try {
      const client = this.ensureClient();
      const numbers = await client
        .availablePhoneNumbers(params.countryCode)
        .mobile.list({
          limit: params.limit || 10,
        });

      return numbers.map((num) => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        locality: num.locality,
        region: num.region,
        capabilities: num.capabilities,
      }));
    } catch (error: any) {
      console.error('Error searching international numbers:', error);
      throw error;
    }
  }

  // Transfer call to another number
  async transferCall(callSid: string, to: string, from: string, transferType: 'warm' | 'cold' = 'cold') {
    try {
      const client = this.ensureClient();

      if (transferType === 'warm') {
        // Warm transfer - use conference (conference is created automatically)
        const conferenceName = `Transfer-${callSid}`;

        // Add original call to conference
        await client.calls(callSid).update({
          twiml: this.generateConferenceTwiML(conferenceName),
        });

        // Call the transfer target and add to same conference
        const transferCall = await client.calls.create({
          to: to,
          from: from,
          twiml: this.generateConferenceTwiML(conferenceName),
        });

        return {
          success: true,
          conferenceName: conferenceName,
          transferCallSid: transferCall.sid,
        };
      } else {
        // Cold transfer - redirect directly
        await client.calls(callSid).update({
          twiml: this.generateTransferTwiML(to),
        });

        return {
          success: true,
          callSid: callSid,
        };
      }
    } catch (error: any) {
      console.error('Error transferring call:', error);
      throw new Error(`Failed to transfer call: ${error.message}`);
    }
  }

  // Generate TwiML for conference
  private generateConferenceTwiML(conferenceSid: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    const dial = response.dial();
    dial.conference(conferenceSid);
    return response.toString();
  }

  // Generate TwiML for transfer
  private generateTransferTwiML(to: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    response.dial(to);
    return response.toString();
  }

  // Generate TwiML for voicemail
  generateVoicemailTwiML(greeting?: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.say(
      { voice: 'Polly.Joanna' },
      greeting || 'Please leave a message after the beep.'
    );

    response.record({
      action: `${process.env.BASE_URL}/api/v1/twilio/voicemail`,
      method: 'POST',
      maxLength: 300, // 5 minutes
      playBeep: true,
      transcribe: true,
      transcribeCallback: `${process.env.BASE_URL}/api/v1/twilio/voicemail-transcription`,
    });

    return response.toString();
  }

  // Get call recordings
  async getCallRecordings(callSid: string) {
    try {
      const client = this.ensureClient();
      const recordings = await client.recordings.list({ callSid: callSid });

      return recordings.map((rec) => ({
        sid: rec.sid,
        duration: rec.duration,
        dateCreated: rec.dateCreated,
        url: `https://api.twilio.com${rec.uri.replace('.json', '.mp3')}`,
        status: rec.status,
      }));
    } catch (error: any) {
      console.error('Error getting recordings:', error);
      throw error;
    }
  }

  // Delete recording
  async deleteRecording(recordingSid: string) {
    try {
      const client = this.ensureClient();
      await client.recordings(recordingSid).remove();
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting recording:', error);
      throw error;
    }
  }

  // Download recording
  async getRecordingUrl(recordingSid: string): Promise<string> {
    try {
      const client = this.ensureClient();
      const recording = await client.recordings(recordingSid).fetch();
      return `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    } catch (error: any) {
      console.error('Error getting recording URL:', error);
      throw error;
    }
  }

  // Create call queue
  async createQueue(friendlyName: string, maxSize: number = 100) {
    try {
      const client = this.ensureClient();
      const queue = await client.queues.create({
        friendlyName: friendlyName,
        maxSize: maxSize,
      });

      return {
        sid: queue.sid,
        friendlyName: queue.friendlyName,
        maxSize: queue.maxSize,
      };
    } catch (error: any) {
      console.error('Error creating queue:', error);
      throw error;
    }
  }

  // Add call to queue
  generateQueueTwiML(queueName: string, waitUrl?: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.say({ voice: 'Polly.Joanna' }, 'Please hold while we connect you.');

    const enqueue = response.enqueue({
      waitUrl: waitUrl || `${process.env.BASE_URL}/api/v1/twilio/wait-music`,
    });
    enqueue.queue(queueName);

    return response.toString();
  }

  // Dequeue call
  async dequeueCall(queueSid: string, callbackUrl: string) {
    try {
      const client = this.ensureClient();
      const member = await client.queues(queueSid).members.list({ limit: 1 });

      if (member.length > 0) {
        await client.queues(queueSid).members(member[0].callSid).update({
          url: callbackUrl,
          method: 'POST',
        });

        return {
          success: true,
          callSid: member[0].callSid,
        };
      }

      return {
        success: false,
        message: 'No calls in queue',
      };
    } catch (error: any) {
      console.error('Error dequeuing call:', error);
      throw error;
    }
  }

  // Check business hours
  isBusinessHours(timezone: string = 'America/New_York'): boolean {
    const now = new Date();
    const options = { timeZone: timezone, hour12: false };
    const hour = parseInt(now.toLocaleString('en-US', { ...options, hour: 'numeric' }));
    const day = now.toLocaleString('en-US', { ...options, weekday: 'short' });

    // Business hours: Monday-Friday, 9 AM - 5 PM
    const isWeekday = !['Sat', 'Sun'].includes(day);
    const isWorkingHours = hour >= 9 && hour < 17;

    return isWeekday && isWorkingHours;
  }

  // Generate after-hours TwiML
  generateAfterHoursTwiML(message?: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    response.say(
      { voice: 'Polly.Joanna' },
      message || 'Thank you for calling. Our office is currently closed. Please call back during business hours, Monday through Friday, 9 AM to 5 PM Eastern Time.'
    );

    response.say(
      { voice: 'Polly.Joanna' },
      'You may also leave a voicemail and we will get back to you as soon as possible.'
    );

    response.record({
      action: `${process.env.BASE_URL}/api/v1/twilio/voicemail`,
      method: 'POST',
      maxLength: 300,
      playBeep: true,
      transcribe: true,
      transcribeCallback: `${process.env.BASE_URL}/api/v1/twilio/voicemail-transcription`,
    });

    response.hangup();

    return response.toString();
  }

  // Hangup call
  async hangupCall(callSid: string) {
    try {
      const client = this.ensureClient();
      await client.calls(callSid).update({ status: 'completed' });
      return { success: true };
    } catch (error: any) {
      console.error('Error hanging up call:', error);
      throw error;
    }
  }

  // Get queue statistics
  async getQueueStats(queueSid: string) {
    try {
      const client = this.ensureClient();
      const queue = await client.queues(queueSid).fetch();
      const members = await client.queues(queueSid).members.list();

      return {
        queueName: queue.friendlyName,
        currentSize: queue.currentSize,
        maxSize: queue.maxSize,
        averageWaitTime: queue.averageWaitTime,
        members: members.map((m) => ({
          callSid: m.callSid,
          waitTime: m.waitTime,
          position: m.position,
        })),
      };
    } catch (error: any) {
      console.error('Error getting queue stats:', error);
      throw error;
    }
  }
}
