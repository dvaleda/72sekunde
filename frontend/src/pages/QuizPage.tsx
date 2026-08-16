import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

interface LocationState {
  attemptId?: string;
  expiresAt?: string;
}

type Question = {
  id: string;
  text: string;
  options: { A: string; B: string; C: string };
};

export default function QuizPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as LocationState;

  const [attemptId] = useState<string | null>(state.attemptId ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(state.expiresAt ?? null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(72);
  const [locked, setLocked] = useState(false);
  const [loadingNext, setLoadingNext] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const finishingRef = useRef(false);

  useEffect(() => {
    if (!attemptId) {
      navigate('/register');
    }
  }, [attemptId, navigate]);

  const finish = useCallback(async () => {
    if (finishingRef.current || !attemptId) return;
    finishingRef.current = true;
    try {
      const result = await api.finishAttempt(attemptId);
      navigate('/result', { state: { ...result, attemptId } });
    } catch {
      navigate('/result', { state: { attemptId } });
    }
  }, [attemptId, navigate]);

  // Server-authoritative countdown: we only ever compute time remaining
  // from the server-provided expiresAt timestamp vs the local clock. We
  // never let the client extend or set this value itself.
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remainingMs = new Date(expiresAt).getTime() - Date.now();
      const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(remaining);
      if (remainingMs <= 0) {
        finish();
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [expiresAt, finish]);

  const loadNextQuestion = useCallback(async () => {
    if (!attemptId) return;
    setLocked(true);
    try {
      const res = await api.getNextQuestion(attemptId);
      if (res.finished) {
        finish();
        return;
      }
      setQuestion(res.question);
      setExpiresAt(res.expiresAt);
      setLocked(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        finish();
        return;
      }
      setError('Greška prilikom učitavanja pitanja.');
      setLocked(false);
    }
  }, [attemptId, finish]);

  useEffect(() => {
    loadNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function handleAnswer(option: 'A' | 'B' | 'C') {
    if (!attemptId || !question || locked || secondsLeft <= 0) return;
    setLocked(true);
    try {
      await api.submitAnswer(attemptId, question.id, option);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 410 || err.status === 409)) {
        finish();
        return;
      }
    }
    loadNextQuestion();
  }

  if (!attemptId) return null;

  return (
    <div className="min-h-screen flex flex-col bg-white px-5 py-6">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <span className="font-display font-bold text-brand-greenDark text-sm tracking-wide">72 SEKUNDE</span>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div
            className={`font-display font-extrabold text-6xl tabular-nums ${
              secondsLeft <= 10 ? 'text-red-600' : 'text-brand-green'
            }`}
          >
            {secondsLeft}
          </div>
          <div className="text-gray-400 text-xs mt-1 tracking-widest uppercase">sekundi</div>
        </div>

        {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}

        {loadingNext && !question ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Učitavanje...</div>
        ) : (
          <div className="flex-1 flex flex-col">
            <p className="font-display font-semibold text-lg text-gray-900 text-center mb-6 min-h-[3.5rem] flex items-center justify-center">
              {question.text}
            </p>

            <div className="space-y-3">
              {(['A', 'B', 'C'] as const).map((key) => (
                <button
                  key={key}
                  disabled={locked}
                  onClick={() => handleAnswer(key)}
                  className="w-full text-left border-2 border-gray-200 hover:border-brand-green active:scale-[0.98] disabled:opacity-50 transition-all rounded-2xl px-5 py-4 flex items-center gap-3"
                >
                  <span className="w-8 h-8 rounded-full bg-brand-green/10 text-brand-green font-display font-bold flex items-center justify-center shrink-0">
                    {key}
                  </span>
                  <span className="text-gray-800 font-medium">{question.options[key]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
