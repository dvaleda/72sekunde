import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const locationState = (useLocation().state ?? {}) as { playerId?: string; attemptsUsed?: number };

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (locationState.playerId) {
      setLoading(true);
      try {
        const { attempt } = await api.createAttempt(locationState.playerId);
        const firstQuestion = await api.getNextQuestion(attempt.id);
        navigate('/play', { state: { attemptId: attempt.id, expiresAt: attempt.expiresAt, firstQuestion } });
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError('Nešto je pošlo po zlu. Pokušaj ponovno.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!nickname.trim() || !email.trim()) { setError('Ime/nadimak i e-mail su obavezni.'); return; }
    if (!rulesAccepted) { setError('Potrebno je prihvatiti pravila kviza.'); return; }

    setLoading(true);
    try {
      const already = await api.checkAttempt(email.trim().toLowerCase());
      if (already.hasPlayed) {
        setError('Iskorištena su oba pokušaja. Hvala na sudjelovanju!');
        setLoading(false);
        return;
      }
      const { player } = await api.createPlayer({ nickname: nickname.trim(), email: email.trim(), termsAccepted: true, marketingConsent });
      const { attempt } = await api.createAttempt(player.id);
      const firstQuestion = await api.getNextQuestion(attempt.id);
      navigate('/play', { state: { attemptId: attempt.id, expiresAt: attempt.expiresAt, firstQuestion } });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Nešto je pošlo po zlu. Pokušaj ponovno.');
    } finally {
      setLoading(false);
    }
  }

  if (locationState.playerId) {
    return (
      <div className="min-h-dvh gradient-bg flex flex-col px-6 py-10">
        <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center items-center text-center gap-8 animate-fade-in">
          <img src="/logo-transparent.png" alt="72H" className="w-48" />
          <div>
            <h2 className="font-display font-bold text-2xl text-[#0d1b2a] mb-3">Još jedan pokušaj?</h2>
            <p className="text-[#0d1b2a]/60 text-sm leading-relaxed">
              Preostalo ti je {2 - (locationState.attemptsUsed ?? 0)} od 2 pokušaja.<br />
              Na ljestvici se pamti tvoj najbolji rezultat.
            </p>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={(e) => handleSubmit(e as any)}
            disabled={loading}
            className="w-full font-display font-black text-lg py-4 rounded-2xl tracking-widest transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #a8d42e 0%, #99c729 50%, #7aab1a 100%)',
              boxShadow: '0 4px 32px rgba(153,199,41,0.3)',
              color: '#0a1a04',
            }}
          >
            {loading ? 'Trenutak...' : 'KRENI'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh gradient-bg flex flex-col px-6 py-10">
      <div className="max-w-sm mx-auto w-full animate-fade-in">

        <div className="pt-4 pb-10">
          <img src="/logo-transparent.png" alt="72H" className="h-14 mb-8" />
          <h2 className="font-display font-bold text-2xl text-[#0d1b2a] mb-1">Prijava</h2>
          <p className="text-[#0d1b2a]/55 text-sm">2 pokušaja · pamti se najbolji rezultat</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0d1b2a]/55 tracking-widest uppercase mb-2">Ime ili nadimak</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={50}
              className="field-input"
              placeholder="npr. Ana"
              autoComplete="nickname"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0d1b2a]/55 tracking-widest uppercase mb-2">E-mail adresa</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
              placeholder="ime@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="pt-1 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(e) => setRulesAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-green shrink-0"
              />
              <span className="text-sm text-[#0d1b2a]/60 leading-relaxed">
                Prihvaćam{' '}
                <a href="/rules" target="_blank" className="text-brand-green underline underline-offset-2">pravila kviza</a>
                {' '}i uvjete korištenja.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-green shrink-0"
              />
              <span className="text-sm text-[#0d1b2a]/60 leading-relaxed">
                Želim primati obavijesti o projektu 72 sata bez kompromisa.
              </span>
            </label>
          </div>

          {error && (
            <p className="text-red-400/90 text-sm border border-red-400/20 bg-red-400/8 rounded-xl px-4 py-3 animate-shake">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-display font-black text-lg py-4 rounded-2xl tracking-widest transition-all active:scale-[0.97] disabled:opacity-50 mt-2"
            style={{
              background: 'linear-gradient(135deg, #a8d42e 0%, #99c729 50%, #7aab1a 100%)',
              boxShadow: '0 4px 32px rgba(153,199,41,0.3)',
              color: '#0a1a04',
            }}
          >
            {loading ? 'Trenutak...' : 'ZAPOČNI KVIZ'}
          </button>
        </form>
      </div>
    </div>
  );
}
