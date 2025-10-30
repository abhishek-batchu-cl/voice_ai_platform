import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { assistantsApi } from '../lib/api';

export default function AssistantBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '',
    first_message: '',
    system_prompt: '',
    voice_provider: 'elevenlabs',
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    stt_provider: 'deepgram',
    stt_model: 'nova-2',
    stt_language: 'en-US',
    model_provider: 'openai',
    model_name: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 150,
    interruptions_enabled: true,
    background_denoising: true,
    phone_enabled: false,
    transfer_number: '',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      speed: 1.0,
      pitch: 1.0,
      optimize_streaming_latency: 3,
    },
    call_settings: {
      max_call_duration: 1800,
      silence_timeout: 30,
      voicemail_detection: true,
      recording_enabled: true,
      transcription_enabled: true,
      end_call_phrases: ['goodbye', 'thanks bye', 'end call'],
    },
  });

  const { data: existingData } = useQuery({
    queryKey: ['assistant', id],
    queryFn: () => assistantsApi.get(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingData?.data) {
      setFormData(existingData.data);
    }
  }, [existingData]);

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEditing ? assistantsApi.update(id!, data) : assistantsApi.create(data),
    onSuccess: () => {
      navigate(`/assistants`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? parseFloat(value)
          : type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
  };

  const handleNestedChange = (category: 'voice_settings' | 'call_settings', field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Edit Assistant' : 'Create New Assistant'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white shadow rounded-lg p-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">General Settings</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Assistant Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label htmlFor="first_message" className="block text-sm font-medium text-gray-700">
                First Message (optional)
              </label>
              <textarea
                id="first_message"
                name="first_message"
                value={formData.first_message}
                onChange={handleChange}
                rows={2}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="Hello! How can I help you today?"
              />
            </div>

            <div>
              <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700">
                System Prompt *
              </label>
              <textarea
                id="system_prompt"
                name="system_prompt"
                value={formData.system_prompt}
                onChange={handleChange}
                required
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="You are a helpful assistant..."
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Model Configuration</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="model_provider" className="block text-sm font-medium text-gray-700">
                Model Provider
              </label>
              <select
                id="model_provider"
                name="model_provider"
                value={formData.model_provider}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div>
              <label htmlFor="model_name" className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <input
                type="text"
                id="model_name"
                name="model_name"
                value={formData.model_name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label htmlFor="temperature" className="block text-sm font-medium text-gray-700">
                Temperature
              </label>
              <input
                type="number"
                id="temperature"
                name="temperature"
                value={formData.temperature}
                onChange={handleChange}
                min="0"
                max="1"
                step="0.1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>

            <div>
              <label htmlFor="max_tokens" className="block text-sm font-medium text-gray-700">
                Max Tokens
              </label>
              <input
                type="number"
                id="max_tokens"
                name="max_tokens"
                value={formData.max_tokens}
                onChange={handleChange}
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Voice Configuration</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="voice_provider" className="block text-sm font-medium text-gray-700">
                Voice Provider
              </label>
              <select
                id="voice_provider"
                name="voice_provider"
                value={formData.voice_provider}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label htmlFor="voice_id" className="block text-sm font-medium text-gray-700">
                Voice ID
              </label>
              <input
                type="text"
                id="voice_id"
                name="voice_id"
                value={formData.voice_id}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder="EXAVITQu4vr4xnSDxMaL"
              />
              <p className="mt-1 text-xs text-gray-500">
                Popular voices: Sarah (EXAVITQu4vr4xnSDxMaL), Rachel (21m00Tcm4TlvDq8ikWAM)
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Advanced Voice Settings</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Stability: {formData.voice_settings.stability.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={formData.voice_settings.stability}
                  onChange={(e) => handleNestedChange('voice_settings', 'stability', parseFloat(e.target.value))}
                  className="mt-1 block w-full"
                />
                <p className="mt-1 text-xs text-gray-500">Higher = more stable, lower = more expressive</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Similarity Boost: {formData.voice_settings.similarity_boost.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={formData.voice_settings.similarity_boost}
                  onChange={(e) => handleNestedChange('voice_settings', 'similarity_boost', parseFloat(e.target.value))}
                  className="mt-1 block w-full"
                />
                <p className="mt-1 text-xs text-gray-500">Higher = more similar to original voice</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Speed: {formData.voice_settings.speed.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={formData.voice_settings.speed}
                  onChange={(e) => handleNestedChange('voice_settings', 'speed', parseFloat(e.target.value))}
                  className="mt-1 block w-full"
                />
                <p className="mt-1 text-xs text-gray-500">Speaking speed (0.5 = slow, 2.0 = fast)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Pitch: {formData.voice_settings.pitch.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={formData.voice_settings.pitch}
                  onChange={(e) => handleNestedChange('voice_settings', 'pitch', parseFloat(e.target.value))}
                  className="mt-1 block w-full"
                />
                <p className="mt-1 text-xs text-gray-500">Voice pitch (0.5 = low, 2.0 = high)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Style/Exaggeration: {formData.voice_settings.style.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={formData.voice_settings.style}
                  onChange={(e) => handleNestedChange('voice_settings', 'style', parseFloat(e.target.value))}
                  className="mt-1 block w-full"
                />
                <p className="mt-1 text-xs text-gray-500">Higher = more exaggerated delivery</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Streaming Optimization: {formData.voice_settings.optimize_streaming_latency}
                </label>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={formData.voice_settings.optimize_streaming_latency}
                  onChange={(e) => handleNestedChange('voice_settings', 'optimize_streaming_latency', parseInt(e.target.value))}
                  className="mt-1 block w-full"
                />
                <p className="mt-1 text-xs text-gray-500">Higher = lower latency (0-4, recommended: 3)</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Speech-to-Text Configuration</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="stt_provider" className="block text-sm font-medium text-gray-700">
                STT Provider
              </label>
              <select
                id="stt_provider"
                name="stt_provider"
                value={formData.stt_provider}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="deepgram">Deepgram (Real-time)</option>
                <option value="whisper">OpenAI Whisper</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.stt_provider === 'deepgram'
                  ? 'Best for real-time streaming transcription'
                  : 'Best for pre-recorded audio with high accuracy'}
              </p>
            </div>

            <div>
              <label htmlFor="stt_model" className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <input
                type="text"
                id="stt_model"
                name="stt_model"
                value={formData.stt_model}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                placeholder={formData.stt_provider === 'deepgram' ? 'nova-2' : 'whisper-1'}
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.stt_provider === 'deepgram'
                  ? 'Recommended: nova-2 (latest)'
                  : 'Use: whisper-1'}
              </p>
            </div>

            <div>
              <label htmlFor="stt_language" className="block text-sm font-medium text-gray-700">
                Language
              </label>
              <select
                id="stt_language"
                name="stt_language"
                value={formData.stt_language}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish (Spain)</option>
                <option value="es-MX">Spanish (Mexico)</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="it-IT">Italian</option>
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="ja-JP">Japanese</option>
                <option value="ko-KR">Korean</option>
                <option value="zh-CN">Chinese (Mandarin)</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Phone Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="phone_enabled"
                name="phone_enabled"
                checked={formData.phone_enabled}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="phone_enabled" className="ml-2 block text-sm text-gray-900">
                Enable phone calling capabilities
              </label>
            </div>

            {formData.phone_enabled && (
              <>
                <div>
                  <label htmlFor="transfer_number" className="block text-sm font-medium text-gray-700">
                    Transfer Number (optional)
                  </label>
                  <input
                    type="text"
                    id="transfer_number"
                    name="transfer_number"
                    value={formData.transfer_number}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                    placeholder="+1234567890"
                  />
                  <p className="mt-1 text-xs text-gray-500">Number to transfer calls to (with country code)</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-md space-y-4">
                  <h3 className="text-sm font-medium text-gray-900">Call Behavior Settings</h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Max Call Duration (seconds)
                      </label>
                      <input
                        type="number"
                        value={formData.call_settings.max_call_duration}
                        onChange={(e) => handleNestedChange('call_settings', 'max_call_duration', parseInt(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        min="60"
                        step="60"
                      />
                      <p className="mt-1 text-xs text-gray-500">{Math.floor(formData.call_settings.max_call_duration / 60)} minutes</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Silence Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        value={formData.call_settings.silence_timeout}
                        onChange={(e) => handleNestedChange('call_settings', 'silence_timeout', parseInt(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                        min="5"
                        max="120"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.call_settings.voicemail_detection}
                        onChange={(e) => handleNestedChange('call_settings', 'voicemail_detection', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Enable voicemail detection
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.call_settings.recording_enabled}
                        onChange={(e) => handleNestedChange('call_settings', 'recording_enabled', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Record calls
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.call_settings.transcription_enabled}
                        onChange={(e) => handleNestedChange('call_settings', 'transcription_enabled', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label className="ml-2 block text-sm text-gray-700">
                        Transcribe calls
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/assistants')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
