import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

interface LocationState { attemptId?: string; expiresAt?: string; firstQuestion?: { finished: false; question: Question; expiresAt: string; sequenceNumber: number } | { finished: true; reason: string }; }
type Question = { id: string; text: string; options: { A: string; B: string; C: string }; category: string; };
type AnswerState = { selected: 'A' | 'B' | 'C'; correct: boolean; correctAnswer: 'A' | 'B' | 'C' } | null;

function playSound(type: 'correct' | 'wrong') {
  try {
    const ctx = new AudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.connect(g);
    if (type === 'correct') {
      o.frequency.setValueAtTime(520, ctx.currentTime);
      o.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.3);
    } else {
      o.frequency.setValueAtTime(280, ctx.currentTime);
      o.frequency.setValueAtTime(220, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.start(); o.stop(ctx.currentTime + 0.25);
    }
  } catch { /* AudioContext not available */ }
}

function haptic(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* not available */ }
}

const CATEGORY_LABELS: Record<string, string> = {
  '72H': '72H',
  'marija_bistrica': 'Marija Bistrica',
  'biblija': 'Biblija',
  'vjera': 'Vjera',
  'sveci': 'Sveci',
  'marija_krunica': 'Marija i krunica',
};

const CATEGORY_COLORS: Record<string, string> = {
  '72H': 'rgba(153,199,41,0.18)',
  'marija_bistrica': 'rgba(0,155,235,0.18)',
  'biblija': 'rgba(240,192,64,0.18)',
  'vjera': 'rgba(180,120,255,0.18)',
  'sveci': 'rgba(255,140,80,0.18)',
  'marija_krunica': 'rgba(0,155,235,0.18)',
};

const CATEGORY_BORDER: Record<string, string> = {
  '72H': 'rgba(153,199,41,0.35)',
  'marija_bistrica': 'rgba(0,155,235,0.3)',
  'biblija': 'rgba(240,192,64,0.3)',
  'vjera': 'rgba(180,120,255,0.3)',
  'sveci': 'rgba(255,140,80,0.3)',
  'marija_krunica': 'rgba(0,155,235,0.3)',
};

const CATEGORY_TEXT: Record<string, string> = {
  '72H': '#99c729',
  'marija_bistrica': '#009beb',
  'biblija': '#f0c040',
  'vjera': '#b478ff',
  'sveci': '#ff8c50',
  'marija_krunica': '#009beb',
};

// SVG circular arc timer
function ArcTimer({ progress, urgent }: { progress: number; urgent: boolean }) {
  const r = 44;
  const cx = 52;
  const cy = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);
  const color = urgent ? '#f87171' : '#99c729';
  const glowId = urgent ? 'glow-red' : 'glow-green';

  return (
    <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="5" className="timer-arc-track" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        strokeWidth="5"
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="timer-arc-fill"
        filter={`url(#${glowId})`}
      />
    </svg>
  );
}

export default function QuizPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as LocationState;

  const [attemptId] = useState<string | null>(state.attemptId ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(state.expiresAt ?? null);
  const [question, setQuestion] = useState<Question | null>(
    state.firstQuestion && !state.firstQuestion.finished ? state.firstQuestion.question : null
  );
  const [questionKey, setQuestionKey] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(72);
  const [locked, setLocked] = useState(false);
  const [answerState, setAnswerState] = useState<AnswerState>(null);
  const [streak, setStreak] = useState(0);
  const [showStreak, setShowStreak] = useState(false);
  const [streakBonusMsg, setStreakBonusMsg] = useState(false);
  const [frozenSeconds, setFrozenSeconds] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [error, setError] = useState<string | null>(null);
  const finishingRef = useRef(false);
  const streakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (!attemptId) navigate('/register'); }, [attemptId, navigate]);

  useEffect(() => {
    if (!attemptId) return;
    let n = 3;
    setCountdown(n);
    const interval = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(interval); setCountdown(null); }
      else setCountdown(n);
    }, 800);
    return () => clearInterval(interval);
  }, [attemptId]);

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

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remainingMs = new Date(expiresAt).getTime() - Date.now();
      const remaining = Math.max(0, Math.floor(remainingMs / 1000));
      setSecondsLeft(remaining);
      if (remainingMs <= 0) finish();
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [expiresAt, finish]);

  const loadNextQuestion = useCallback(async () => {
    if (!attemptId) return;
    setLocked(true);
    setAnswerState(null);
    try {
      const res = await api.getNextQuestion(attemptId);
      if (res.finished) { finish(); return; }
      setQuestion(res.question);
      setExpiresAt(res.expiresAt);
      setQuestionKey(k => k + 1);
      setLocked(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) { finish(); return; }
      setError('Greška prilikom učitavanja pitanja.');
      setLocked(false);
    }
  }, [attemptId, finish]);

  useEffect(() => {
    if (countdown !== null) return;
    if (state.firstQuestion && !state.firstQuestion.finished && question) {
      setLocked(false);
      return;
    }
    loadNextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  async function handleAnswer(option: 'A' | 'B' | 'C') {
    if (!attemptId || !question || locked || secondsLeft <= 0 || countdown !== null) return;
    setLocked(true);
    setQuestionCount(c => c + 1);

    try {
      const res = await api.submitAnswer(attemptId, question.id, option);
      setAnswerState({ selected: option, correct: res.correct, correctAnswer: res.correctAnswer });
      setFrozenSeconds(secondsLeft);

      if (res.correct) {
        playSound('correct');
        haptic(40);
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak >= 3) {
          setShowStreak(true);
          if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
          streakTimerRef.current = setTimeout(() => setShowStreak(false), 1200);
        }
        if (res.streakBonus) {
          setStreakBonusMsg(true);
          setTimeout(() => setStreakBonusMsg(false), 1500);
        }
      } else {
        playSound('wrong');
        haptic([30, 30, 30]);
        setStreak(0);
      }

      setTimeout(() => {
        setExpiresAt(res.expiresAt);
        setFrozenSeconds(null);
        loadNextQuestion();
      }, 600);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 410 || err.status === 409)) {
        finish(); return;
      }
      loadNextQuestion();
    }
  }

  if (!attemptId) return null;

  const displaySeconds = frozenSeconds ?? secondsLeft;
  const isUrgent = displaySeconds <= 10;
  const progress = displaySeconds / 72;

  function btnStyle(key: 'A' | 'B' | 'C') {
    if (!answerState) return 'answer-btn';
    if (key === answerState.correctAnswer) return 'answer-btn-correct';
    if (key === answerState.selected && !answerState.correct) return 'answer-btn-wrong';
    return 'answer-btn answer-btn-dim';
  }

  function keyBadgeStyle(key: 'A' | 'B' | 'C') {
    if (!answerState) return { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' };
    if (key === answerState.correctAnswer) return { background: 'rgba(153,199,41,0.3)', color: '#99c729' };
    if (key === answerState.selected && !answerState.correct) return { background: 'rgba(239,68,68,0.3)', color: '#f87171' };
    return { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' };
  }

  // Countdown screen
  if (countdown !== null) {
    return (
      <div className="min-h-screen gradient-bg flex flex-col items-center justify-center gap-4">
        <div className="relative mb-2">
          <ArcTimer progress={1} urgent={false} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              key={countdown}
              className="font-display font-black text-5xl leading-none tabular-nums animate-bounce-in"
              style={{
                background: 'linear-gradient(135deg, #c8e86a, #99c729)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {countdown === 0 ? '!' : countdown}
            </div>
          </div>
        </div>
        <p className="text-white/25 text-[11px] tracking-[0.3em] uppercase">Spremi se</p>
      </div>
    );
  }

  const catColor = question?.category ? CATEGORY_TEXT[question.category] : '#99c729';
  const catBg = question?.category ? CATEGORY_COLORS[question.category] : 'rgba(153,199,41,0.1)';
  const catBorder = question?.category ? CATEGORY_BORDER[question.category] : 'rgba(153,199,41,0.3)';

  return (
    <div className="min-h-screen gradient-bg flex flex-col px-5 py-6">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <img src="/logo-transparent.png" alt="72H" className="h-6" />
          {questionCount > 0 && (
            <span className="text-white/20 text-xs tabular-nums">{questionCount} odg.</span>
          )}
        </div>

        {/* Timer — compact row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative shrink-0">
            <ArcTimer progress={progress} urgent={isUrgent} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`font-display font-black text-3xl tabular-nums leading-none ${isUrgent ? 'text-red-400 timer-glow-red' : 'text-brand-green timer-glow-green'}`}>
                {displaySeconds}
              </span>
              <span className="text-white/20 text-[9px] tracking-widest uppercase mt-0.5">sek</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            {streakBonusMsg ? (
              <span className="font-display font-black text-sm animate-bounce-in" style={{ color: '#99c729' }}>+3 sekunde!</span>
            ) : showStreak ? (
              <span className="font-display font-black text-sm animate-bounce-in" style={{ color: '#99c729' }}>{streak}× zaredom!</span>
            ) : (
              <span className={`text-xs ${isUrgent ? 'text-red-400/70 font-semibold' : 'text-white/20'}`}>{isUrgent ? 'Požuri!' : 'Odgovori na što više pitanja'}</span>
            )}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

        {!question ? (
          <div className="flex-1 flex flex-col gap-3">
            <div className="h-6 w-24 rounded-full shimmer" />
            <div className="rounded-2xl flex-1 shimmer" style={{ minHeight: '120px' }} />
            <div className="space-y-2">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-12 rounded-xl shimmer" style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          </div>
        ) : (
          <div key={questionKey} className="flex-1 flex flex-col animate-slide-up">
            {/* Category tag */}
            {question.category && (
              <div className="mb-3">
                <span
                  className="text-[10px] font-black tracking-[0.22em] uppercase px-3 py-1.5 rounded-full"
                  style={{ background: catBg, border: `1px solid ${catBorder}`, color: catColor }}
                >
                  {CATEGORY_LABELS[question.category] ?? question.category}
                </span>
              </div>
            )}

            {/* Question card */}
            <div
              className="rounded-2xl px-5 py-5 mb-3 flex-1 flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderTop: `2px solid ${catBorder}`,
                backdropFilter: 'blur(16px)',
              }}
            >
              <p className="font-display font-black text-xl text-white text-center leading-snug">
                {question.text}
              </p>
            </div>

            {/* Answer buttons */}
            <div className="space-y-2">
              {(['A', 'B', 'C'] as const).map((key) => (
                <button
                  key={key}
                  disabled={locked}
                  onClick={() => handleAnswer(key)}
                  className={`${btnStyle(key)} w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 disabled:cursor-default`}
                >
                  <span
                    className="w-7 h-7 rounded-md font-display font-black flex items-center justify-center shrink-0 text-[11px] transition-all duration-150"
                    style={keyBadgeStyle(key)}
                  >
                    {key}
                  </span>
                  <span className="text-white/75 text-sm leading-snug">{question.options[key]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
