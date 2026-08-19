import { useNavigate } from 'react-router-dom';

export default function RulesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-bg px-6 py-10">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 text-sm text-brand-green flex items-center gap-1 hover:opacity-80 transition-opacity">
          ← Natrag
        </button>
        <h1 className="font-display font-bold text-2xl text-[#0d1b2a] mb-6">Pravila kviza</h1>
        <ul className="space-y-3">
          {[
            'Kviz traje točno 72 sekunde.',
            'Svako pitanje ima tri ponuđena odgovora (A, B, C).',
            'Za točan odgovor dobivaš +1 bod. Za netočan odgovor 0 bodova. Nema negativnih bodova.',
            'Svaki sudionik ima pravo na 2 pokušaja vezana uz svoju e-mail adresu. Na ljestvici se pamti tvoj najbolji rezultat.',
            'Nakon odabira odgovora ne možeš se vratiti na prethodno pitanje.',
            'Vrijeme se mjeri na poslužitelju i ne može se produžiti mijenjanjem postavki na tvom uređaju.',
            'Konačan rezultat prikazuje se odmah po isteku vremena.',
          ].map((rule, i) => (
            <li key={i} className="flex items-start gap-3 text-[#0d1b2a]/70 text-sm">
              <span className="text-brand-green font-bold shrink-0">{i + 1}.</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
