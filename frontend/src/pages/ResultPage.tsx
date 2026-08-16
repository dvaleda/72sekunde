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

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as ResultState;

  const [leaderboard, setLeaderboard] = useState<{ rank: number; nickname: string; score: number }[]>([]);
  const [myRank, setMyRank] = useState<number | null>(state.rank ?? null);
  const [config, setConfig] = useState<EventConfig | null>(null);

  useEffect(() => {
    if (!state.attemptId && state.score === undefined) {
      navigate('/');
      return;
    }
    api
      .getLeaderboard(state.attemptId)
      .then((res) => {
        setLeaderboard(res.leaderboard.slice(0, 10));
        if (res.myRank) setMyRank(res.myRank);
      })
      .catch(() => {});
    api
      .getEventConfig()
      .then((res) => setConfig(res.config))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attemptsUsed = state.attemptsUsed ?? 3;
  const canPlayAgain = attemptsUsed < 2;

  function handlePlayAgain() {
    navigate('/register', { state: { playerId: state.playerId, attemptsUsed } });
  }

  const registrationOpen = Boolean(config?.official_registration_url);

  return (
    <div className="min-h-screen flex flex-col bg-white px-5 py-8">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col">
        <div className="text-center mb-8">
          <h1 className="font-display font-extrabold text-2xl text-brand-greenDark mb-1">Vrijeme je isteklo!</h1>
          <p className="text-gray-500 text-sm">Bravo! Hvala ti što si sudjelovao/la.</p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="mb-4 text-sm text-brand-green underline text-center w-full"
        >
          ← Povratak na početnu
        </button>

        <div className="bg-brand-green/5 border border-brand-green/20 rounded-2xl p-6 text-center mb-6">
          <div className="font-display font-extrabold text-5xl text-brand-green mb-1">{state.score ?? 0}</div>
          <div className="text-gray-600 text-sm mb-4">točnih odgovora</div>
          <div className="text-gray-500 text-xs">Odgovorio/la si na {state.answeredCount ?? 0} pitanja</div>
          {myRank && <div className="text-gray-500 text-xs mt-1">Plasman: #{myRank}</div>}
          <div className="text-gray-400 text-xs mt-1">Pokušaj {attemptsUsed} od 2</div>
        </div>

        <p className="text-center text-gray-600 text-sm mb-6">
          Zanima te više o 72 sata bez kompromisa? Prijavi se!
        </p>

        {canPlayAgain && (
          <button
            onClick={handlePlayAgain}
            className="w-full text-center border-2 border-brand-green text-brand-green font-display font-bold text-lg py-4 rounded-2xl mb-3 active:scale-[0.98] transition-all"
          >
            IGRAJ PONOVO ({2 - attemptsUsed} pokušaj preostao)
          </button>
        )}

        {registrationOpen ? (
          <a
            href={config?.official_registration_url ?? '#'}
            className="w-full text-center bg-brand-green hover:bg-brand-greenDark text-white font-display font-bold text-lg py-4 rounded-2xl shadow-lg shadow-brand-green/20 mb-8"
          >
            PRIJAVI SE NA 72H
          </a>
        ) : (
          <a
            href={config?.official_project_url ?? 'https://72h.hr/'}
            className="w-full text-center bg-brand-green hover:bg-brand-greenDark text-white font-display font-bold text-lg py-4 rounded-2xl shadow-lg shadow-brand-green/20 mb-8"
          >
            SAZNAJ VIŠE O 72H
          </a>
        )}

        <div>
          <h2 className="font-display font-bold text-brand-greenDark mb-3">Ljestvica</h2>
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            {leaderboard.map((row) => (
              <div
                key={row.rank}
                className={`flex items-center justify-between px-4 py-3 text-sm ${
                  row.rank % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <span className="text-gray-500 w-8">#{row.rank}</span>
                <span className="flex-1 font-medium text-gray-800">{row.nickname}</span>
                <span className="font-display font-bold text-brand-green">{row.score}</span>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">Ljestvica se učitava...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
