import axios from 'axios';

const API_KEY = localStorage.getItem('api_key') || '';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
});

// Update API key when it changes
export function setApiKey(key: string) {
  localStorage.setItem('api_key', key);
  api.defaults.headers['X-API-Key'] = key;
}

export function getApiKey(): string {
  return localStorage.getItem('api_key') || '';
}

// API functions
export const assistantsApi = {
  list: () => api.get('/assistants'),
  get: (id: string) => api.get(`/assistants/${id}`),
  create: (data: any) => api.post('/assistants', data),
  update: (id: string, data: any) => api.put(`/assistants/${id}`, data),
  delete: (id: string) => api.delete(`/assistants/${id}`),
};

export const sessionsApi = {
  create: (assistantId: string, metadata?: any) =>
    api.post('/sessions', { assistant_id: assistantId, metadata }),
  get: (id: string) => api.get(`/sessions/${id}`),
  end: (id: string) => api.post(`/sessions/${id}/end`),
  getMessages: (id: string) => api.get(`/sessions/${id}/messages`),
};

export const phoneNumbersApi = {
  list: () => api.get('/phone-numbers'),
  search: (params: { countryCode: string; areaCode?: string; contains?: string }) =>
    api.post('/phone-numbers/search', params),
  purchase: (params: { phoneNumber?: string; countryCode?: string; assistantId?: string }) =>
    api.post('/phone-numbers', params),
  update: (id: string, data: { assistantId?: string }) =>
    api.put(`/phone-numbers/${id}`, data),
  release: (id: string) => api.delete(`/phone-numbers/${id}`),
};

export const callsApi = {
  list: (params?: { status?: string; direction?: string; assistantId?: string }) =>
    api.get('/calls', { params }),
  get: (id: string) => api.get(`/calls/${id}`),
  makeCall: (params: { to: string; assistantId: string; from?: string }) =>
    api.post('/calls', params),
  endCall: (id: string) => api.post(`/calls/${id}/end`),
  getAnalytics: () => api.get('/calls/analytics/summary'),
};
