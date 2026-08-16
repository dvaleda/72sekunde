const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error || `Greška (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface Player {
  id: string;
  nickname: string;
  email: string;
  marketing_consent: boolean;
  terms_accepted: boolean;
}

export interface AttemptSummary {
  id: string;
  expiresAt: string;
  startedAt: string;
  status: string;
}

export interface EventConfig {
  project_name: string;
  edition_year: number;
  slogan: string | null;
  official_registration_url: string | null;
  official_project_url: string | null;
  organizer_name: string | null;
  age_min: number | null;
  age_max: number | null;
}

export const api = {
  createPlayer: (payload: { nickname: string; email: string; termsAccepted: true; marketingConsent: boolean }) =>
    request<{ player: Player }>('/players', { method: 'POST', body: JSON.stringify(payload) }),

  checkAttempt: (email: string) =>
    request<{ hasPlayed: boolean; attemptsUsed: number }>(`/attempts/check?email=${encodeURIComponent(email)}`),

  createAttempt: (playerId: string) =>
    request<{ attempt: AttemptSummary; attemptsUsed: number }>('/attempts', { method: 'POST', body: JSON.stringify({ playerId }) }),

  getNextQuestion: (attemptId: string) =>
    request<
      | { finished: true; reason: string }
      | {
          finished: false;
          question: { id: string; text: string; options: { A: string; B: string; C: string } };
          expiresAt: string;
          sequenceNumber: number;
        }
    >(`/attempts/${attemptId}/question`),

  submitAnswer: (attemptId: string, questionId: string, selected: 'A' | 'B' | 'C') =>
    request<{ accepted: true }>(`/attempts/${attemptId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId, selected }),
    }),

  finishAttempt: (attemptId: string) =>
    request<{ score: number; answeredCount: number; rank: number | null; attemptsUsed: number; playerId: string }>(`/attempts/${attemptId}/finish`, {
      method: 'POST',
    }),

  getLeaderboard: (attemptId?: string) =>
    request<{ leaderboard: { rank: number; nickname: string; score: number }[]; myRank: number | null }>(
      `/leaderboard${attemptId ? `?attemptId=${attemptId}` : ''}`
    ),

  getEventConfig: () => request<{ config: EventConfig }>('/event-config'),
};
