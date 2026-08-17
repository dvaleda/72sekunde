import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ totalPlayers: number; topScore: number } | null>(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen gradient-bg flex flex-col px-6 py-10">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full animate-fade-in">

        <img
          src="/logo-transparent.png"
          alt="72 sata bez kompromisa"
          className="w-32 mb-10"
        />

        <h1 className="font-display font-black text-6xl leading-none tracking-tight mb-4">
          <span className="text-brand-green">72</span>
          <span className="text-white"> SEK</span>
          <span className="text-brand-blue">UNDE</span>
        </h1>

        <p className="text-white/40 text-sm leading-relaxed mb-8">
          Koliko znaš o vjeri, Mariji Bistrici i projektu 72 sata bez kompromisa?
          Imaš 72 sekunde — odgovori na što više pitanja.
        </p>

        {stats && stats.totalPlayers > 0 && (
          <div className="flex gap-3 mb-8">
            <div className="flex-1 glass-card rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="font-display font-black text-2xl text-white tabular-nums">{stats.totalPlayers}</span>
              <span className="text-white/45 text-xs leading-tight">igrača<br />do sad</span>
            </div>
            <div className="flex-1 glass-card rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="font-display font-black text-2xl tabular-nums" style={{ color: '#99c729' }}>{stats.topScore}</span>
              <span className="text-white/45 text-xs leading-tight">trenutni<br />rekord</span>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/register')}
          className="w-full font-display font-black text-xl py-4 rounded-2xl tracking-widest transition-all duration-150 active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #a8d42e 0%, #99c729 50%, #7aab1a 100%)',
            boxShadow: '0 0 40px rgba(153,199,41,0.3), 0 1px 0 rgba(255,255,255,0.12) inset',
            color: '#0a1a04',
          }}
        >
          KRENI
        </button>

      </div>

      <div className="text-center text-[11px] text-white/20 space-x-4 pb-2">
        <a href="/rules" className="hover:text-white/45 transition-colors">Pravila kviza</a>
        <span>·</span>
        <a href="/privacy" className="hover:text-white/45 transition-colors">Privatnost</a>
      </div>
    </div>
  );
}
