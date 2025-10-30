import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { assistantsApi, sessionsApi } from '../lib/api';

export default function TestChat() {
  const { assistantId } = useParams();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { data: assistantData } = useQuery({
    queryKey: ['assistant', assistantId],
    queryFn: () => assistantsApi.get(assistantId!),
  });

  const assistant = assistantData?.data;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startSession = async () => {
    try {
      const response = await sessionsApi.create(assistantId!);
      const { websocket_url } = response.data;

      // Connect WebSocket
      const websocket = new WebSocket(websocket_url);

      websocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          console.log('Session connected:', data.sessionId);
        } else if (data.type === 'assistant-message') {
          // If there's a transcription, show it as user message first
          if (data.transcription) {
            setMessages((prev) => [
              ...prev,
              { role: 'user', content: data.transcription },
            ]);
          }

          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.text },
          ]);

          // Play audio
          if (data.audio && audioRef.current) {
            const audioBlob = new Blob(
              [Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0))],
              { type: 'audio/mpeg' }
            );
            const audioUrl = URL.createObjectURL(audioBlob);
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch((err) => console.error('Audio play error:', err));
          }

          setIsLoading(false);
          setInterimTranscript('');
        } else if (data.type === 'interim-transcript') {
          // Show interim transcription
          setInterimTranscript(data.text);
        } else if (data.type === 'audio-stream-ready') {
          console.log('Audio streaming ready');
        } else if (data.type === 'audio-stream-closed') {
          console.log('Audio streaming closed');
        } else if (data.type === 'error') {
          console.error('WebSocket error:', data.message);
          setIsLoading(false);
        }
      };

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setIsLoading(false);
      };

      setWs(websocket);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !ws || !isConnected) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    ws.send(
      JSON.stringify({
        type: 'user-message',
        text: userMessage,
      })
    );
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Convert to base64 and send to WebSocket
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(',')[1];

          if (ws && isConnected) {
            setIsLoading(true);
            ws.send(
              JSON.stringify({
                type: 'user-audio',
                data: base64Audio,
              })
            );
          }
        };
        reader.readAsDataURL(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const endSession = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'end-session' }));
      ws.close();
    }
    setWs(null);
    setIsConnected(false);
    setMessages([]);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Test: {assistant?.name || 'Loading...'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isConnected ? (
            <span className="text-green-600">● Connected</span>
          ) : (
            <span className="text-gray-400">○ Disconnected</span>
          )}
        </p>
      </div>

      {!isConnected ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">Start a conversation with your assistant</p>
          <button
            onClick={startSession}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            Start Session
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow mb-4" style={{ height: '500px' }}>
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                      <span className="animate-pulse">...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t p-4">
                {interimTranscript && (
                  <div className="mb-2 text-sm text-gray-500 italic">
                    Transcribing: {interimTranscript}
                  </div>
                )}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={!isConnected || isLoading || isRecording}
                  />
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={!isConnected || isLoading}
                    className={`px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isRecording
                        ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title={isRecording ? 'Click to stop recording' : 'Click to start recording'}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!isConnected || isLoading || !input.trim() || isRecording}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={endSession}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              End Session
            </button>
          </div>
        </>
      )}

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
