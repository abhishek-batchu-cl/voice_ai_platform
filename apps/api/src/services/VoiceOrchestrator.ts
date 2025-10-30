import { Database } from '../db/database';
import { OpenAIService } from './OpenAIService';
import { ElevenLabsService } from './ElevenLabsService';
import { DeepgramService } from './DeepgramService';
import { Assistant, Message } from '../types';

export class VoiceOrchestrator {
  private openai: OpenAIService;
  private elevenlabs: ElevenLabsService;
  private deepgram: DeepgramService;
  private sessionId: string;
  private assistant: Assistant;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(sessionId: string, assistant: Assistant) {
    this.sessionId = sessionId;
    this.assistant = assistant;
    this.openai = new OpenAIService();
    this.elevenlabs = new ElevenLabsService();
    this.deepgram = new DeepgramService();

    // Initialize with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: assistant.system_prompt,
    });
  }

  async processUserMessage(userMessage: string): Promise<{
    text: string;
    audio: Buffer;
  }> {
    try {
      // Save user message to database
      await this.saveMessage('user', userMessage);

      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Generate response using LLM
      const assistantResponse = await this.generateLLMResponse();

      // Save assistant message to database
      await this.saveMessage('assistant', assistantResponse);

      // Add to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantResponse,
      });

      // Generate audio
      const audio = await this.generateAudio(assistantResponse);

      return {
        text: assistantResponse,
        audio,
      };
    } catch (error) {
      console.error('Error processing user message:', error);
      throw error;
    }
  }

  private async generateLLMResponse(): Promise<string> {
    if (this.assistant.model_provider === 'openai') {
      const response = await this.openai.generateResponse(this.conversationHistory, {
        model: this.assistant.model_name,
        temperature: this.assistant.temperature || 0.7,
        max_tokens: this.assistant.max_tokens || 500,
        // TODO: Add tool support - pass tools from database
      });

      // For now, just return the content (tools will be handled in future enhancement)
      return response.content || '';
    }

    throw new Error(`Unsupported model provider: ${this.assistant.model_provider}`);
  }

  private async generateAudio(text: string): Promise<Buffer> {
    if (this.assistant.voice_provider === 'elevenlabs') {
      return await this.elevenlabs.generateSpeech(
        text,
        this.assistant.voice_id,
        this.assistant.voice_settings
      );
    } else if (this.assistant.voice_provider === 'openai') {
      return await this.openai.generateSpeech(text, this.assistant.voice_id);
    }

    throw new Error(`Unsupported voice provider: ${this.assistant.voice_provider}`);
  }

  private async saveMessage(role: string, content: string): Promise<void> {
    await Database.query(
      `INSERT INTO messages (session_id, role, content)
       VALUES ($1, $2, $3)`,
      [this.sessionId, role, content]
    );
  }

  async getFirstMessage(): Promise<{ text: string; audio: Buffer } | null> {
    if (!this.assistant.first_message) {
      return null;
    }

    // Save first message to database
    await this.saveMessage('assistant', this.assistant.first_message);

    // Add to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: this.assistant.first_message,
    });

    const audio = await this.generateAudio(this.assistant.first_message);

    return {
      text: this.assistant.first_message,
      audio,
    };
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  /**
   * Process audio input from user and generate response
   */
  async processUserAudio(audioBuffer: Buffer): Promise<{
    text: string;
    audio: Buffer;
    transcription: string;
  }> {
    try {
      // Transcribe audio to text using configured STT provider
      const transcription = await this.transcribeAudio(audioBuffer);

      if (!transcription) {
        throw new Error('Failed to transcribe audio');
      }

      // Process the transcribed text as a regular message
      const response = await this.processUserMessage(transcription);

      return {
        ...response,
        transcription,
      };
    } catch (error) {
      console.error('Error processing user audio:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio using the configured STT provider
   */
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const sttProvider = this.assistant.stt_provider || 'deepgram';

    if (sttProvider === 'deepgram') {
      return await this.deepgram.transcribeAudio(audioBuffer, {
        model: this.assistant.stt_model || 'nova-2',
        language: this.assistant.stt_language || 'en-US',
      });
    } else if (sttProvider === 'whisper') {
      return await this.openai.transcribeAudio(audioBuffer, {
        language: this.assistant.stt_language?.split('-')[0] || 'en',
      });
    }

    throw new Error(`Unsupported STT provider: ${sttProvider}`);
  }

  /**
   * Get the Deepgram service instance for streaming
   */
  getDeepgramService(): DeepgramService {
    return this.deepgram;
  }
}
