import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const locationState = (useLocation().state ?? {}) as { playerId?: string; attemptsUsed?: number };

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Returning player — skip registration, go straight to new attempt.
    if (locationState.playerId) {
      setLoading(true);
      try {
        const { attempt } = await api.createAttempt(locationState.playerId);
        navigate('/play', { state: { attemptId: attempt.id, expiresAt: attempt.expiresAt } });
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError('Nešto je pošlo po zlu. Pokušaj ponovno.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!nickname.trim() || !email.trim()) {
      setError('Ime/nadimak i e-mail su obavezni.');
      return;
    }
    if (!rulesAccepted) {
      setError('Moraš potvrditi da si pročitao/la pravila kviza.');
      return;
    }

    setLoading(true);
    try {
      const already = await api.checkAttempt(email.trim().toLowerCase());
      if (already.hasPlayed) {
        setError('Iskoristio/la si oba pokušaja. Hvala na sudjelovanju!');
        setLoading(false);
        return;
      }

      const { player } = await api.createPlayer({
        nickname: nickname.trim(),
        email: email.trim(),
        termsAccepted: true,
        marketingConsent,
      });
      const { attempt } = await api.createAttempt(player.id);
      navigate('/play', { state: { attemptId: attempt.id, expiresAt: attempt.expiresAt } });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Nešto je pošlo po zlu. Pokušaj ponovno.');
    } finally {
      setLoading(false);
    }
  }

  // Returning player — show a simple confirmation instead of the full form.
  if (locationState.playerId) {
    return (
      <div className="min-h-screen flex flex-col bg-white px-6 py-10">
        <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center items-center text-center gap-6">
          <h2 className="font-display font-bold text-2xl text-brand-greenDark">Još jedan pokušaj?</h2>
          <p className="text-gray-500 text-sm">
            Preostalo ti je {2 - (locationState.attemptsUsed ?? 0)} od 2 pokušaja. Na ljestvici se pamti tvoj najbolji rezultat.
          </p>
          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
          <button
            onClick={(e) => handleSubmit(e as any)}
            disabled={loading}
            className="w-full bg-brand-green hover:bg-brand-greenDark active:scale-[0.98] transition-all text-white font-display font-bold text-lg py-4 rounded-2xl shadow-lg shadow-brand-green/20 disabled:opacity-60"
          >
            {loading ? 'Trenutak...' : 'KRENI!'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white px-6 py-10">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center">
        <h2 className="font-display font-bold text-2xl text-brand-greenDark mb-1">Prijava igrača</h2>
        <p className="text-gray-500 text-sm mb-2">Unesi svoje podatke i kreni s izazovom.</p>
        <p className="text-brand-green text-sm font-semibold mb-8">Imaš 2 pokušaja — na ljestvici se pamti tvoj najbolji rezultat.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Ime ili nadimak</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={50}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-green"
              placeholder="npr. Ana"
              autoComplete="nickname"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail adresa</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-green"
              placeholder="ime@example.com"
              autoComplete="email"
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={rulesAccepted}
              onChange={(e) => setRulesAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 accent-brand-green shrink-0"
            />
            <span>
              Potvrđujem da sam pročitao/la{' '}
              <a href="/rules" target="_blank" className="underline text-brand-green">
                pravila kviza
              </a>{' '}
              i prihvaćam uvjete sudjelovanja.
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-1 w-5 h-5 accent-brand-green shrink-0"
            />
            <span>
              Želim primati e-mail obavijesti povezane s prijavom i informacijama o projektu 72 sata bez kompromisa.
            </span>
          </label>

          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-green hover:bg-brand-greenDark active:scale-[0.98] transition-all text-white font-display font-bold text-lg py-4 rounded-2xl shadow-lg shadow-brand-green/20 disabled:opacity-60"
          >
            {loading ? 'Trenutak...' : 'ZAPOČNI KVIZ'}
          </button>
        </form>
      </div>
    </div>
  );
}
