import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, EventConfig } from '../lib/api';

interface ResultState {
  score?: number;
  answeredCount?: number;
  rank?: number | null;
  attemptId?: string;
  attemptsUsed?: number;
  playerId?: string;
}

const MEDALS = ['', '🥇', '🥈', '🥉'];

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as ResultState;

  const [leaderboard, setLeaderboard] = useState<{ rank: number; nickname: string; score: number }[]>([]);
  const [myRank, setMyRank] = useState<number | null>(state.rank ?? null);
  const [myRow, setMyRow] = useState<{ rank: number; nickname: string; score: number } | null>(null);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [displayScore, setDisplayScore] = useState(0);

  const finalScore = state.score ?? 0;
  const attemptsUsed = state.attemptsUsed ?? 3;
  const canPlayAgain = attemptsUsed < 2;
  useEffect(() => {
    if (finalScore === 0) return;
    const steps = 28;
    const increment = finalScore / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= finalScore) { setDisplayScore(finalScore); clearInterval(timer); }
      else setDisplayScore(Math.floor(current));
    }, 800 / steps);
    return () => clearInterval(timer);
  }, [finalScore]);

  useEffect(() => {
    if (!state.attemptId && state.score === undefined) { navigate('/'); return; }
    api.getLeaderboard(state.attemptId).then((res) => {
      setLeaderboard(res.leaderboard.slice(0, 10));
      if (res.myRank) setMyRank(res.myRank);
      if (res.myRow) setMyRow(res.myRow);
    }).catch(() => {});
    api.getEventConfig().then((res) => setConfig(res.config)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registrationOpen = Boolean(config?.official_registration_url);

  function handlePlayAgain() {
    navigate('/register', { state: { playerId: state.playerId, attemptsUsed } });
  }

  const scoreMessage =
    finalScore >= 25 ? 'Nevjerojatno! Pravi poznavatelj vjere.' :
    finalScore >= 18 ? 'Izvrsno! Znanje te ne izdaje.' :
    finalScore >= 10 ? 'Dobro! Ima još prostora za rast.' :
    'Dobar pokušaj! Nauči nešto novo i vrati se.';

  async function handleShare() {
    const text = `Rezultat: ${finalScore} bodova u 72 sekunde kvizu! Možeš li bolje? https://seven2sekunde.onrender.com`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); alert('Kopirano u međuspremnik!'); }
    } catch { /* cancelled */ }
  }

  const myRankInTop10 = myRank !== null && myRank <= 10;

  const scoreGradient =
    finalScore >= 20 ? 'linear-gradient(135deg, #c8e86a 0%, #99c729 50%, #6aab00 100%)' :
    finalScore >= 10 ? 'linear-gradient(135deg, #7dd3fc 0%, #009beb 100%)' :
    'linear-gradient(135deg, #7dd3fc 0%, #009beb 100%)';

  return (
    <div className="min-h-dvh gradient-bg flex flex-col px-5 py-6">
      <div className="max-w-sm mx-auto w-full flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <img src="/logo-transparent.png" alt="72H" className="h-10" />
          <span className="text-brand-blue font-bold text-[10px] tracking-[0.25em] uppercase font-semibold">Rezultat</span>
        </div>

        {/* Score card */}
        <div className="shrink-0 mb-3">
          <div
            className="rounded-2xl px-5 py-5 text-center relative overflow-hidden"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.07)',
              borderTop: `2px solid ${finalScore >= 20 ? '#99c729' : finalScore >= 10 ? '#009beb' : 'rgba(0,0,0,0.1)'}`,
              boxShadow: '0 6px 32px rgba(0,100,180,0.12)',
            }}
          >
            {/* Watermark — high score number, low score faint ? */}
            {finalScore >= 15 ? (
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 font-display font-black leading-none tabular-nums pointer-events-none select-none"
                style={{ fontSize: '120px', opacity: 0.04, color: finalScore >= 20 ? '#99c729' : '#009beb' }}
              >
                {finalScore}
              </div>
            ) : (
              <div
                className="absolute right-4 top-1/2 -translate-y-1/2 font-display font-black leading-none pointer-events-none select-none"
                style={{ fontSize: '100px', opacity: 0.04, color: '#000' }}
              >
                ?
              </div>
            )}
            <div
              className="font-display font-black text-[72px] leading-none tabular-nums text-transparent bg-clip-text relative"
              style={{ backgroundImage: scoreGradient }}
            >
              {displayScore}
            </div>
            <p className="text-[#0d1b2a]/60 text-sm font-medium mt-1 relative">{scoreMessage}</p>
            <p className="text-[#0d1b2a]/45 text-xs mt-2 relative">
              {state.answeredCount ?? 0} pitanja
              {myRank ? <span> &middot; plasman <strong className="text-[#0d1b2a]/70">#{myRank}</strong></span> : null}
              <span> &middot; pokušaj {attemptsUsed}/2</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 space-y-2 mb-3">
          {canPlayAgain && (
            <button
              onClick={handlePlayAgain}
              className="w-full font-display font-black text-sm py-3 rounded-xl tracking-widest transition-all active:scale-[0.97]"
              style={{ border: '1px solid rgba(120,170,0,0.4)', color: '#4a7a00', background: 'rgba(153,199,41,0.08)' }}
            >
              IGRAJ PONOVO — preostao {2 - attemptsUsed} pokušaj
            </button>
          )}

          <div className="flex gap-2">
            <a
              href="https://72h.hr/"
              className="flex-1 text-center font-display font-black text-sm py-3 rounded-xl tracking-widest transition-all active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #a8d42e 0%, #99c729 50%, #7aab1a 100%)',
                boxShadow: '0 4px 20px rgba(153,199,41,0.3)',
                color: '#0a1a04',
              }}
            >
              {registrationOpen ? 'PRIJAVI SE NA 72H!' : 'SAZNAJ VIŠE O 72H'}
            </a>
            <button
              onClick={handleShare}
              className="flex-1 font-display font-black text-sm py-3 rounded-xl tracking-widest transition-all active:scale-[0.97]"
              style={{ border: '1px solid rgba(13,27,42,0.12)', color: 'rgba(13,27,42,0.55)', background: 'rgba(13,27,42,0.04)' }}
            >
              PODIJELI
            </button>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full text-xs text-[#0d1b2a]/45 hover:text-[#0d1b2a]/70 transition-colors py-1 tracking-wide"
          >
            ← Povratak na početnu
          </button>
        </div>

        {/* Leaderboard */}
        <div className="mt-1">
          <p className="text-brand-blue font-bold text-[10px] tracking-[0.25em] uppercase mb-2">Ljestvica</p>

          {/* Prize announcement */}
          <div
            className="rounded-xl px-4 py-3 mb-3 text-center"
            style={{ background: 'rgba(153,199,41,0.12)', border: '1px solid rgba(153,199,41,0.25)' }}
          >
            <p className="text-[#3d6b00] text-sm font-semibold">
              🏆 Podjela nagrada i objava pobjednika u <strong>15:00</strong>
            </p>
            <p className="text-[#3d6b00]/70 text-xs mt-1">
              Nagrade osvajaju prva 3 mjesta + predzadnje mjesto!
            </p>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 20px rgba(0,100,180,0.1)' }}
          >
            {leaderboard.length === 0 ? (
              <div className="px-3 py-3 space-y-2.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3" style={{ opacity: 1 - i * 0.15 }}>
                    <div className="w-5 h-3 rounded shimmer shrink-0" />
                    <div className="flex-1 h-3 rounded shimmer" />
                    <div className="w-6 h-3 rounded shimmer shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {leaderboard.map((row, i) => {
                  const isMe = myRank !== null && myRank === row.rank;
                  const isTop3 = row.rank <= 3;
                  return (
                    <div
                      key={row.rank}
                      className={`flex items-center px-3 py-2 gap-3 ${i < leaderboard.length - 1 ? 'border-b border-black/[0.05]' : ''}`}
                      style={isMe ? { background: 'rgba(153,199,41,0.08)', borderLeft: '3px solid #99c729' } : {}}
                    >
                      <span className="w-5 text-center shrink-0 text-xs">
                        {isTop3
                          ? MEDALS[row.rank]
                          : <span className="font-display font-black text-[#0d1b2a]/40 tabular-nums">{row.rank}</span>
                        }
                      </span>
                      <span className={`flex-1 text-xs truncate ${isMe ? 'text-[#0d1b2a] font-bold' : 'text-[#0d1b2a]/60 font-medium'}`}>
                        {row.nickname}
                      </span>
                      <span
                        className="font-display font-black text-sm tabular-nums shrink-0"
                        style={{ color: isMe ? '#3d6b00' : isTop3 ? '#0d1b2a' : 'rgba(13,27,42,0.4)' }}
                      >
                        {row.score}
                      </span>
                    </div>
                  );
                })}
                {!myRankInTop10 && (
                  <>
                    <div className="px-3 py-1 text-center text-[#0d1b2a]/30 text-xs tracking-widest">· · ·</div>
                    <div
                      className="flex items-center px-3 py-2.5 gap-3"
                      style={{ background: 'rgba(153,199,41,0.08)', borderLeft: '3px solid #99c729' }}
                    >
                      <span className="w-5 text-center shrink-0 font-display font-black text-xs text-[#0d1b2a]/40 tabular-nums">{myRow?.rank ?? myRank ?? '—'}</span>
                      <span className="flex-1 text-xs font-bold text-[#0d1b2a] truncate">{myRow?.nickname ?? 'Ti'}</span>
                      <span className="font-display font-black text-sm tabular-nums" style={{ color: '#3d6b00' }}>{myRow?.score ?? finalScore}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
