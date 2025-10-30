import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assistantsApi } from '../lib/api';

export default function AssistantsList() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['assistants'],
    queryFn: () => assistantsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assistantsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
    },
  });

  const assistants = data?.data?.assistants || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Assistants</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all your voice AI assistants
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to="/assistants/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Create Assistant
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : assistants.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No assistants yet. Create your first one!</p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Name
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Model
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Voice
                      </th>
                      <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {assistants.map((assistant: any) => (
                      <tr key={assistant.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                          {assistant.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {assistant.model_provider} / {assistant.model_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {assistant.voice_provider}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link
                            to={`/test/${assistant.id}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Test
                          </Link>
                          <Link
                            to={`/assistants/${assistant.id}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this assistant?')) {
                                deleteMutation.mutate(assistant.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
