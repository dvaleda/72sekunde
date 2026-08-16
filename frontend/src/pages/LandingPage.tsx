import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-green flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-display font-bold text-2xl">72</span>
          </div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-brand-greenDark tracking-tight">
            72 SEKUNDE
          </h1>
        </div>

        <p className="text-lg font-semibold text-gray-800 max-w-sm mb-3">
          Koliko znaš o vjeri, Mariji Bistrici i projektu 72 sata bez kompromisa?
        </p>

        <p className="text-gray-500 max-w-xs mb-10 leading-relaxed">
          Imaš 72 sekunde. Odgovori na što više pitanja. Budi brz. Budi precizan. Pruži nadu.
        </p>

        <button
          onClick={() => navigate('/register')}
          className="w-full max-w-xs bg-brand-green hover:bg-brand-greenDark active:scale-[0.98] transition-all text-white font-display font-bold text-lg py-4 rounded-2xl shadow-lg shadow-brand-green/20"
        >
          KRENI
        </button>

        <div className="mt-6 text-xs text-gray-400 space-x-3">
          <a href="/rules" className="underline">Pravila kviza</a>
          <span>·</span>
          <a href="/privacy" className="underline">Privatnost</a>
        </div>
      </main>
    </div>
  );
}
