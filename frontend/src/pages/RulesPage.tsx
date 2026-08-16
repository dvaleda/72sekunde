import { useNavigate } from 'react-router-dom';

export default function RulesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="max-w-lg mx-auto prose prose-sm">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 text-sm text-brand-green underline"
        >
          ← Natrag
        </button>
        <h1 className="font-display font-bold text-2xl text-brand-greenDark mb-4">Pravila kviza</h1>

        <ul className="space-y-2">
          <li>Kviz traje točno 72 sekunde.</li>
          <li>Svako pitanje ima tri ponuđena odgovora (A, B, C).</li>
          <li>Za točan odgovor dobivaš +1 bod. Za netočan odgovor 0 bodova. Nema negativnih bodova.</li>
          <li>Svaki sudionik ima pravo na <strong>2 pokušaja</strong> vezana uz svoju e-mail adresu. Na ljestvici se pamti tvoj najbolji rezultat.</li>
          <li>Nakon odabira odgovora ne možeš se vratiti na prethodno pitanje.</li>
          <li>Vrijeme se mjeri na poslužitelju i ne može se produžiti mijenjanjem postavki na tvom uređaju.</li>
          <li>Konačan rezultat prikazuje se odmah po isteku vremena.</li>
        </ul>
      </div>
    </div>
  );
}
