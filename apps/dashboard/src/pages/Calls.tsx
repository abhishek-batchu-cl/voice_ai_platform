import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callsApi, assistantsApi } from '../lib/api';

export default function Calls() {
  const queryClient = useQueryClient();
  const [makeCallModal, setMakeCallModal] = useState(false);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [callParams, setCallParams] = useState({
    to: '',
    assistantId: '',
  });

  const { data: calls, isLoading } = useQuery({
    queryKey: ['calls'],
    queryFn: () => callsApi.list(),
  });

  const { data: assistants } = useQuery({
    queryKey: ['assistants'],
    queryFn: () => assistantsApi.list(),
  });

  const { data: analytics } = useQuery({
    queryKey: ['callAnalytics'],
    queryFn: () => callsApi.getAnalytics(),
  });

  const makeCallMutation = useMutation({
    mutationFn: (params: { to: string; assistantId: string }) => callsApi.makeCall(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      queryClient.invalidateQueries({ queryKey: ['callAnalytics'] });
      setMakeCallModal(false);
      setCallParams({ to: '', assistantId: '' });
    },
  });

  const endCallMutation = useMutation({
    mutationFn: (callId: string) => callsApi.endCall(callId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });

  const handleMakeCall = () => {
    if (callParams.to && callParams.assistantId) {
      makeCallMutation.mutate(callParams);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      queued: 'bg-gray-100 text-gray-800',
      ringing: 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
      busy: 'bg-yellow-100 text-yellow-800',
      'no-answer': 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatPhoneNumber = (number: string) => {
    if (number.startsWith('+1')) {
      const cleaned = number.slice(2);
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return number;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calls</h1>
          <p className="mt-2 text-sm text-gray-700">
            Monitor and manage your voice AI calls
          </p>
        </div>
        <button
          onClick={() => setMakeCallModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Make Call
        </button>
      </div>

      {/* Analytics Summary */}
      {analytics?.data && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
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
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Calls</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {analytics.data.total_calls}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {analytics.data.completed_calls}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Duration</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatDuration(analytics.data.avg_duration_seconds || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-yellow-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Cost</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCost(analytics.data.total_cost || 0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calls Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-500">Loading calls...</p>
        </div>
      ) : calls?.data?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No calls yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by making your first call.</p>
          <div className="mt-6">
            <button
              onClick={() => setMakeCallModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Make Call
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  To/From
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Direction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {calls?.data?.map((call: any) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPhoneNumber(call.to_number)}
                    </div>
                    <div className="text-xs text-gray-500">
                      from {formatPhoneNumber(call.from_number)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        call.direction === 'outbound'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {call.direction}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                        call.status
                      )}`}
                    >
                      {call.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {call.duration_seconds ? formatDuration(call.duration_seconds) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {call.cost ? formatCost(call.cost) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(call.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedCall(call)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      View
                    </button>
                    {call.status === 'in-progress' && (
                      <button
                        onClick={() => endCallMutation.mutate(call.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        End
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Make Call Modal */}
      {makeCallModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Make Outbound Call</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number *</label>
                    <input
                      type="tel"
                      value={callParams.to}
                      onChange={(e) => setCallParams({ ...callParams, to: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      placeholder="+1234567890"
                    />
                    <p className="mt-1 text-xs text-gray-500">Include country code (e.g., +1 for US)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Assistant *</label>
                    <select
                      value={callParams.assistantId}
                      onChange={(e) => setCallParams({ ...callParams, assistantId: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="">Select an assistant</option>
                      {assistants?.data?.map((assistant: any) => (
                        <option key={assistant.id} value={assistant.id}>
                          {assistant.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleMakeCall}
                    disabled={!callParams.to || !callParams.assistantId || makeCallMutation.isPending}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {makeCallMutation.isPending ? 'Calling...' : 'Make Call'}
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => setMakeCallModal(false)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Details Modal */}
      {selectedCall && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Call Details</h3>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">To</p>
                      <p className="text-sm text-gray-900">{formatPhoneNumber(selectedCall.to_number)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">From</p>
                      <p className="text-sm text-gray-900">{formatPhoneNumber(selectedCall.from_number)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Status</p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                          selectedCall.status
                        )}`}
                      >
                        {selectedCall.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Duration</p>
                      <p className="text-sm text-gray-900">
                        {selectedCall.duration_seconds ? formatDuration(selectedCall.duration_seconds) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Cost</p>
                      <p className="text-sm text-gray-900">
                        {selectedCall.cost ? formatCost(selectedCall.cost) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Started</p>
                      <p className="text-sm text-gray-900">
                        {new Date(selectedCall.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {selectedCall.recording_url && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Recording</p>
                      <audio controls className="w-full">
                        <source src={selectedCall.recording_url} type="audio/mpeg" />
                      </audio>
                    </div>
                  )}

                  {selectedCall.transcription && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Transcription</p>
                      <div className="bg-gray-50 p-3 rounded text-sm text-gray-700">
                        {selectedCall.transcription}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => setSelectedCall(null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
