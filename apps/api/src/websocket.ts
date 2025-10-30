import { WebSocketServer, WebSocket } from 'ws';
import { Database } from './db/database';
import { VoiceOrchestrator } from './services/VoiceOrchestrator';
import * as url from 'url';

const WS_PORT = parseInt(process.env.WS_PORT || '8080');

export function startWebSocketServer() {
  const wss = new WebSocketServer({ port: WS_PORT });

  console.log(`🔌 WebSocket server running on ws://localhost:${WS_PORT}`);

  wss.on('connection', async (ws: WebSocket, req) => {
    console.log('New WebSocket connection');

    // Parse session_id from query string
    const queryParams = url.parse(req.url || '', true).query;
    const sessionId = queryParams.session_id as string;

    if (!sessionId) {
      ws.send(JSON.stringify({ type: 'error', message: 'session_id required' }));
      ws.close();
      return;
    }

    try {
      // Get session and assistant from database
      const sessionResult = await Database.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
        ws.close();
        return;
      }

      const session = sessionResult.rows[0];

      const assistantResult = await Database.query(
        'SELECT * FROM assistants WHERE id = $1',
        [session.assistant_id]
      );

      if (assistantResult.rows.length === 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'Assistant not found' }));
        ws.close();
        return;
      }

      const assistant = assistantResult.rows[0];

      // Initialize voice orchestrator
      const orchestrator = new VoiceOrchestrator(sessionId, assistant);

      // Send connected event
      ws.send(JSON.stringify({ type: 'connected', sessionId }));

      // Send first message if configured
      const firstMessage = await orchestrator.getFirstMessage();
      if (firstMessage) {
        ws.send(
          JSON.stringify({
            type: 'assistant-message',
            text: firstMessage.text,
            audio: firstMessage.audio.toString('base64'),
          })
        );
      }

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'user-message') {
            // Process user's text message
            const response = await orchestrator.processUserMessage(message.text);

            ws.send(
              JSON.stringify({
                type: 'assistant-message',
                text: response.text,
                audio: response.audio.toString('base64'),
              })
            );
          } else if (message.type === 'user-audio') {
            // Process user's audio message with STT
            if (!message.data) {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: 'Audio data required',
                })
              );
              return;
            }

            try {
              // Decode base64 audio data
              const audioBuffer = Buffer.from(message.data, 'base64');

              // Process audio through STT and get response
              const response = await orchestrator.processUserAudio(audioBuffer);

              ws.send(
                JSON.stringify({
                  type: 'assistant-message',
                  text: response.text,
                  audio: response.audio.toString('base64'),
                  transcription: response.transcription,
                })
              );
            } catch (error) {
              console.error('Audio processing error:', error);
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: 'Failed to process audio',
                })
              );
            }
          } else if (message.type === 'user-audio-stream-start') {
            // Start streaming audio transcription (for Deepgram live)
            try {
              const deepgram = orchestrator.getDeepgramService();

              // Create live connection
              await deepgram.createLiveConnection({
                model: assistant.stt_model || 'nova-2',
                language: assistant.stt_language || 'en-US',
                interimResults: true,
              });

              // Handle transcription results
              deepgram.on('transcript', async (data: any) => {
                if (data.isFinal && data.text.trim()) {
                  // Process final transcription as user message
                  try {
                    const response = await orchestrator.processUserMessage(data.text);
                    ws.send(
                      JSON.stringify({
                        type: 'assistant-message',
                        text: response.text,
                        audio: response.audio.toString('base64'),
                        transcription: data.text,
                      })
                    );
                  } catch (error) {
                    console.error('Error processing transcription:', error);
                  }
                } else if (!data.isFinal) {
                  // Send interim transcript to client
                  ws.send(
                    JSON.stringify({
                      type: 'interim-transcript',
                      text: data.text,
                      confidence: data.confidence,
                    })
                  );
                }
              });

              ws.send(JSON.stringify({ type: 'audio-stream-ready' }));
            } catch (error) {
              console.error('Failed to start audio stream:', error);
              ws.send(
                JSON.stringify({
                  type: 'error',
                  message: 'Failed to start audio streaming',
                })
              );
            }
          } else if (message.type === 'user-audio-stream-chunk') {
            // Send audio chunk to Deepgram live stream
            try {
              const deepgram = orchestrator.getDeepgramService();
              if (deepgram.isLiveConnectionActive() && message.data) {
                const audioChunk = Buffer.from(message.data, 'base64');
                deepgram.sendAudio(audioChunk);
              }
            } catch (error) {
              console.error('Error sending audio chunk:', error);
            }
          } else if (message.type === 'user-audio-stream-end') {
            // Close Deepgram live connection
            try {
              const deepgram = orchestrator.getDeepgramService();
              deepgram.closeLiveConnection();
              ws.send(JSON.stringify({ type: 'audio-stream-closed' }));
            } catch (error) {
              console.error('Error closing audio stream:', error);
            }
          } else if (message.type === 'end-session') {
            // End the session
            await Database.query(
              `UPDATE sessions SET status = 'ended', ended_at = NOW() WHERE id = $1`,
              [sessionId]
            );

            ws.send(JSON.stringify({ type: 'session-ended' }));
            ws.close();
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Failed to process message',
            })
          );
        }
      });

      ws.on('close', async () => {
        console.log('WebSocket connection closed');

        // Update session status if still active
        await Database.query(
          `UPDATE sessions
           SET status = 'ended', ended_at = NOW()
           WHERE id = $1 AND status = 'active'`,
          [sessionId]
        );
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    } catch (error) {
      console.error('WebSocket setup error:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }));
      ws.close();
    }
  });

  return wss;
}
