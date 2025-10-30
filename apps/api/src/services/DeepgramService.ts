import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { EventEmitter } from 'events';

export interface DeepgramConfig {
  model?: string;
  language?: string;
  punctuate?: boolean;
  interimResults?: boolean;
  endpointing?: number;
  vadEvents?: boolean;
}

export class DeepgramService extends EventEmitter {
  private deepgram: any;
  private liveConnection: any = null;

  constructor() {
    super();
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');
  }

  /**
   * Create a live transcription connection for real-time streaming
   */
  async createLiveConnection(config: DeepgramConfig = {}) {
    try {
      const connection = this.deepgram.listen.live({
        model: config.model || 'nova-2',
        language: config.language || 'en-US',
        punctuate: config.punctuate !== false,
        interim_results: config.interimResults !== false,
        endpointing: config.endpointing || 300, // ms of silence before finalizing
        vad_events: config.vadEvents !== false,
        encoding: 'linear16',
        sample_rate: 16000,
      });

      this.liveConnection = connection;

      // Handle transcription results
      connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        const isFinal = data.is_final;

        if (transcript) {
          this.emit('transcript', {
            text: transcript,
            isFinal,
            confidence: data.channel?.alternatives?.[0]?.confidence,
          });
        }
      });

      // Handle metadata
      connection.on(LiveTranscriptionEvents.Metadata, (data: any) => {
        this.emit('metadata', data);
      });

      // Handle errors
      connection.on(LiveTranscriptionEvents.Error, (error: any) => {
        console.error('Deepgram live transcription error:', error);
        this.emit('error', error);
      });

      // Handle connection close
      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('Deepgram live connection closed');
        this.emit('close');
      });

      return connection;
    } catch (error) {
      console.error('Failed to create Deepgram live connection:', error);
      throw new Error('Failed to initialize live transcription');
    }
  }

  /**
   * Send audio data to the live connection
   */
  sendAudio(audioData: Buffer) {
    if (!this.liveConnection) {
      throw new Error('No active live connection');
    }
    this.liveConnection.send(audioData);
  }

  /**
   * Close the live connection
   */
  closeLiveConnection() {
    if (this.liveConnection) {
      this.liveConnection.finish();
      this.liveConnection = null;
    }
  }

  /**
   * Transcribe pre-recorded audio file or buffer
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    config: DeepgramConfig = {}
  ): Promise<string> {
    try {
      const { result, error } = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: config.model || 'nova-2',
          language: config.language || 'en-US',
          punctuate: config.punctuate !== false,
        }
      );

      if (error) {
        throw error;
      }

      const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      return transcript;
    } catch (error) {
      console.error('Deepgram transcription error:', error);
      throw new Error('Failed to transcribe audio with Deepgram');
    }
  }

  /**
   * Check if live connection is active
   */
  isLiveConnectionActive(): boolean {
    return this.liveConnection !== null;
  }
}
