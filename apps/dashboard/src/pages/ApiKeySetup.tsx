import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setApiKey } from '../lib/api';

export default function ApiKeySetup() {
  const [apiKey, setApiKeyInput] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      setApiKey(apiKey.trim());
      navigate('/');
      window.location.reload(); // Reload to update API key in headers
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome to Voice AI Platform</h2>
        <p className="text-gray-600 mb-6">
          Enter your API key to get started. You can find this in your organization settings or by
          running the seed script.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="text"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="vapi_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              setApiKey('vapi_demo_key_for_ui_preview');
              navigate('/');
              window.location.reload();
            }}
            className="w-full mt-3 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Continue with Demo (Preview UI)
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-500 text-center">
          Demo mode lets you explore the UI without a backend connection
        </p>
      </div>
    </div>
  );
}
