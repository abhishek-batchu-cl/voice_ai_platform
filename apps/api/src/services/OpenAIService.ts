import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    config: {
      model: string;
      temperature: number;
      max_tokens: number;
      tools?: Array<{
        type: 'function';
        function: {
          name: string;
          description: string;
          parameters: Record<string, any>;
        };
      }>;
    }
  ): Promise<{
    content: string | null;
    toolCalls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: config.model,
        messages: messages as any,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        tools: config.tools,
        tool_choice: config.tools && config.tools.length > 0 ? 'auto' : undefined,
      });

      const message = completion.choices[0]?.message;

      return {
        content: message?.content || null,
        toolCalls: message?.tool_calls as any,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate response from OpenAI');
    }
  }

  async generateSpeech(text: string, voice: string = 'alloy'): Promise<Buffer> {
    try {
      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: voice as any,
        input: text,
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    } catch (error) {
      console.error('OpenAI TTS error:', error);
      throw new Error('Failed to generate speech from OpenAI');
    }
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    config: {
      language?: string;
      temperature?: number;
    } = {}
  ): Promise<string> {
    try {
      // OpenAI expects a File object, so we create one from the buffer
      const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

      const transcription = await this.client.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: config.language || 'en',
        temperature: config.temperature || 0,
        response_format: 'text',
      });

      return transcription as string;
    } catch (error) {
      console.error('OpenAI Whisper transcription error:', error);
      throw new Error('Failed to transcribe audio with Whisper');
    }
  }
}
