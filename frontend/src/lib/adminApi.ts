const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function getToken(): string | null {
  return sessionStorage.getItem('admin_token');
}

export function setToken(token: string) {
  sessionStorage.setItem('admin_token', token);
}

export function clearToken() {
  sessionStorage.removeItem('admin_token');
}

async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    clearToken();
    window.location.href = '/admin';
    throw new Error('Sesija je istekla.');
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/csv')) {
    return (await res.blob()) as unknown as T;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Greška (${res.status})`);
  return body as T;
}

export const adminApi = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || 'Prijava neuspješna.');
    return body as { token: string };
  },

  dashboard: () =>
    adminRequest<{
      totalPlayers: number;
      finishedQuizzes: number;
      averageScore: number;
      topScore: number;
      marketingConsentCount: number;
    }>('/dashboard'),

  leaderboard: (search = '') => adminRequest<{ leaderboard: any[] }>(`/leaderboard?search=${encodeURIComponent(search)}`),

  players: (search = '') => adminRequest<{ players: any[] }>(`/players?search=${encodeURIComponent(search)}`),

  deletePlayer: (id: string) => adminRequest(`/players/${id}`, { method: 'DELETE' }),

  revokeConsent: (id: string) => adminRequest(`/players/${id}/revoke-consent`, { method: 'POST' }),

  questions: () => adminRequest<{ questions: any[] }>('/questions'),

  createQuestion: (payload: any) => adminRequest('/questions', { method: 'POST', body: JSON.stringify(payload) }),

  updateQuestion: (id: string, payload: any) =>
    adminRequest(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deactivateQuestion: (id: string) => adminRequest(`/questions/${id}`, { method: 'DELETE' }),

  eventConfig: () => adminRequest<{ config: any }>('/event-config'),

  updateEventConfig: (payload: any) =>
    adminRequest<{ config: any }>('/event-config', { method: 'PUT', body: JSON.stringify(payload) }),

  exportCsv: () => adminRequest<Blob>('/export'),
};
