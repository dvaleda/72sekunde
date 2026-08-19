import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
  const navigate = useNavigate();

  const sections = [
    {
      title: 'Koje podatke prikupljamo',
      content: 'Ime ili nadimak, e-mail adresu (kao identifikator pokušaja), te tvoje odgovore i rezultat kviza.',
    },
    {
      title: 'Javni prikaz',
      content: 'Na javnoj ljestvici prikazuje se samo tvoje ime/nadimak i broj točnih odgovora. E-mail adresa nikada se javno ne prikazuje.',
    },
    {
      title: 'E-mail komunikacija',
      content: 'E-mail koristimo za potvrdu pokušaja i, ako to odabereš, za slanje informacija o projektu 72 sata bez kompromisa.',
    },
    {
      title: 'Tvoja prava',
      content: 'Možeš u bilo kojem trenutku zatražiti brisanje podataka ili povlačenje privole. Kontaktiraj organizatora projekta 72 sata bez kompromisa.',
    },
  ];

  return (
    <div className="min-h-screen gradient-bg px-6 py-10">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 text-sm text-brand-green flex items-center gap-1 hover:opacity-80 transition-opacity">
          ← Natrag
        </button>
        <h1 className="font-display font-bold text-2xl text-[#0d1b2a] mb-2">Politika privatnosti</h1>
        <p className="text-[#0d1b2a]/60 text-sm mb-6">Aplikacija <strong className="text-[#0d1b2a]/80">72 sekunde</strong> — kako koristimo tvoje podatke.</p>
        <div className="space-y-4">
          {sections.map(({ title, content }) => (
            <div key={title} className="bg-white/80 border border-black/[0.07] rounded-2xl px-5 py-4 shadow-sm">
              <h2 className="font-display font-semibold text-brand-green text-sm mb-1">{title}</h2>
              <p className="text-[#0d1b2a]/65 text-sm leading-relaxed">{content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
