import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { assistantsApi } from '../lib/api';

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['assistants'],
    queryFn: () => assistantsApi.list(),
  });

  const assistants = data?.data?.assistants || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Manage your voice AI assistants</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Assistants</dt>
                  <dd className="text-3xl font-semibold text-gray-900">
                    {isLoading ? '...' : assistants.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <Link
          to="/assistants/new"
          className="bg-indigo-50 overflow-hidden shadow rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <div className="p-5">
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <p className="mt-2 text-sm font-medium text-indigo-600">Create New Assistant</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {assistants.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Assistants</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {assistants.slice(0, 5).map((assistant: any) => (
                <li key={assistant.id}>
                  <Link
                    to={`/assistants/${assistant.id}`}
                    className="block hover:bg-gray-50 transition-colors"
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {assistant.name}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {assistant.model_provider}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            {assistant.voice_provider} • {assistant.model_name}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <Link
                            to={`/test/${assistant.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Test →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
