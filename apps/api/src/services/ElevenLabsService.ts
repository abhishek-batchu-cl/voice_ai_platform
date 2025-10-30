import axios from 'axios';

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY || '';
  }

  async generateSpeech(
    text: string,
    voiceId: string,
    settings?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
    }
  ): Promise<Buffer> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: settings?.stability ?? 0.5,
            similarity_boost: settings?.similarity_boost ?? 0.75,
            style: settings?.style ?? 0,
          },
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('ElevenLabs API error:', error.response?.data || error.message);
      throw new Error('Failed to generate speech from ElevenLabs');
    }
  }

  async listVoices() {
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      return response.data.voices;
    } catch (error: any) {
      console.error('ElevenLabs API error:', error.response?.data || error.message);
      throw new Error('Failed to fetch voices from ElevenLabs');
    }
  }
}
