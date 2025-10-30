import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phoneNumbersApi, assistantsApi } from '../lib/api';

export default function PhoneNumbers() {
  const queryClient = useQueryClient();
  const [searchModal, setSearchModal] = useState(false);
  const [searchParams, setSearchParams] = useState({
    countryCode: 'US',
    areaCode: '',
    contains: '',
  });

  const { data: phoneNumbers, isLoading } = useQuery({
    queryKey: ['phoneNumbers'],
    queryFn: () => phoneNumbersApi.list(),
  });

  const { data: assistants } = useQuery({
    queryKey: ['assistants'],
    queryFn: () => assistantsApi.list(),
  });

  const { data: searchResults, refetch: searchNumbers } = useQuery({
    queryKey: ['phoneNumberSearch', searchParams],
    queryFn: () => phoneNumbersApi.search(searchParams),
    enabled: false,
  });

  const purchaseMutation = useMutation({
    mutationFn: (params: { phoneNumber: string; assistantId?: string }) =>
      phoneNumbersApi.purchase(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
      setSearchModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, assistantId }: { id: string; assistantId: string }) =>
      phoneNumbersApi.update(id, { assistantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => phoneNumbersApi.release(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
    },
  });

  const handleSearch = () => {
    searchNumbers();
  };

  const handlePurchase = (phoneNumber: string) => {
    purchaseMutation.mutate({ phoneNumber });
  };

  const formatPhoneNumber = (number: string) => {
    // Format +1234567890 to +1 (234) 567-890
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
          <h1 className="text-3xl font-bold text-gray-900">Phone Numbers</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your Twilio phone numbers for voice AI assistants
          </p>
        </div>
        <button
          onClick={() => setSearchModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Purchase Number
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-500">Loading phone numbers...</p>
        </div>
      ) : phoneNumbers?.data?.length === 0 ? (
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No phone numbers</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by purchasing a phone number.</p>
          <div className="mt-6">
            <button
              onClick={() => setSearchModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Purchase Number
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Assistant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capabilities
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {phoneNumbers?.data?.map((number: any) => (
                <tr key={number.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPhoneNumber(number.phone_number)}
                    </div>
                    <div className="text-xs text-gray-500">{number.twilio_sid}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{number.country_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={number.assistant_id || ''}
                      onChange={(e) =>
                        updateMutation.mutate({
                          id: number.id,
                          assistantId: e.target.value,
                        })
                      }
                      className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="">Not assigned</option>
                      {assistants?.data?.map((assistant: any) => (
                        <option key={assistant.id} value={assistant.id}>
                          {assistant.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-1">
                      {number.capabilities?.voice && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Voice
                        </span>
                      )}
                      {number.capabilities?.sms && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          SMS
                        </span>
                      )}
                      {number.capabilities?.mms && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          MMS
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Are you sure you want to release ${formatPhoneNumber(number.phone_number)}?`
                          )
                        ) {
                          releaseMutation.mutate(number.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Release
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Search Modal */}
      {searchModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Search Available Numbers
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Country</label>
                    <select
                      value={searchParams.countryCode}
                      onChange={(e) =>
                        setSearchParams({ ...searchParams, countryCode: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                    >
                      <option value="US">United States (+1)</option>
                      <option value="CA">Canada (+1)</option>
                      <option value="GB">United Kingdom (+44)</option>
                      <option value="AU">Australia (+61)</option>
                      <option value="DE">Germany (+49)</option>
                      <option value="FR">France (+33)</option>
                      <option value="ES">Spain (+34)</option>
                      <option value="IT">Italy (+39)</option>
                      <option value="JP">Japan (+81)</option>
                      <option value="IN">India (+91)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Area Code (optional)
                    </label>
                    <input
                      type="text"
                      value={searchParams.areaCode}
                      onChange={(e) =>
                        setSearchParams({ ...searchParams, areaCode: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      placeholder="415"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Contains (optional)
                    </label>
                    <input
                      type="text"
                      value={searchParams.contains}
                      onChange={(e) =>
                        setSearchParams({ ...searchParams, contains: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      placeholder="555"
                    />
                  </div>

                  <button
                    onClick={handleSearch}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Search
                  </button>
                </div>

                {searchResults?.data && (
                  <div className="mt-4 max-h-60 overflow-y-auto">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Available Numbers</h4>
                    {searchResults.data.length === 0 ? (
                      <p className="text-sm text-gray-500">No numbers found. Try different search criteria.</p>
                    ) : (
                      <div className="space-y-2">
                        {searchResults.data.map((number: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                          >
                            <div>
                              <div className="text-sm font-medium">{formatPhoneNumber(number.phoneNumber)}</div>
                              <div className="text-xs text-gray-500">
                                {number.locality && `${number.locality}, `}
                                {number.region}
                              </div>
                            </div>
                            <button
                              onClick={() => handlePurchase(number.phoneNumber)}
                              disabled={purchaseMutation.isPending}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {purchaseMutation.isPending ? 'Purchasing...' : 'Purchase'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 sm:mt-6">
                <button
                  onClick={() => setSearchModal(false)}
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
