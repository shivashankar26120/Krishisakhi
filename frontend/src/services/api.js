import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: BASE, timeout: 120000 });

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ks_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ks_token');
      localStorage.removeItem('ks_farmer');
      window.dispatchEvent(new Event('ks_unauthorized'));
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  me: () => api.get('/api/auth/me'),
};

// ── Farmer Profile ────────────────────────────────────────────
export const farmerApi = {
  getProfile: () => api.get('/api/farmer/profile'),
  updateProfile: (data) => api.put('/api/farmer/profile', data),
};

// ── Disease ───────────────────────────────────────────────────
export const diseaseApi = {
  predict: (formData) =>
    api.post('/api/disease/predict', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getHistory: (page = 1, limit = 20) =>
    api.get('/api/disease/history', { params: { page, limit } }),
  getAnalysis: (id) => api.get(`/api/disease/history/${id}`),
};

// ── Chat ──────────────────────────────────────────────────────
export const chatApi = {
  createSession: (language = 'kn') =>
    api.post('/api/chat/sessions', { language }),
  getSessions: (page = 1) =>
    api.get('/api/chat/sessions', { params: { page, limit: 20 } }),
  getMessages: (sessionId) =>
    api.get(`/api/chat/sessions/${sessionId}/messages`),
  sendQuery: (sessionId, question, language = 'kn') =>
    api.post(`/api/chat/sessions/${sessionId}/query`, { question, language }),
  sendVoiceQuery: (sessionId, audioBlob, language = 'kn') => {
    const fd = new FormData();
    fd.append('audio', audioBlob, 'recording.webm');
    fd.append('language', language);
    return api.post(`/api/chat/sessions/${sessionId}/voice-query`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteSession: (sessionId) =>
    api.delete(`/api/chat/sessions/${sessionId}`),
};

// ── Schemes ───────────────────────────────────────────────────
export const schemesApi = {
  list: (params) => api.get('/api/schemes', { params }),
  getById: (id) => api.get(`/api/schemes/${id}`),
};

// ── Market ────────────────────────────────────────────────────
export const marketApi = {
  getPrices: (params) => api.get('/api/market/prices', { params }),
};

// ── Voice synthesize proxy (via Node → Python) ────────────────
export const voiceApi = {
  synthesize: (text) =>
    api.post('/api/voice/synthesize', { text }, { responseType: 'arraybuffer' }),
  getStatus: () => api.get('/api/voice/status'),
};

export default api;
