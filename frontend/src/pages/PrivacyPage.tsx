import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
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
        <h1 className="font-display font-bold text-2xl text-brand-greenDark mb-4">Politika privatnosti</h1>

        <p>
          Ova stranica objašnjava kako aplikacija <strong>72 sekunde</strong> prikuplja i koristi osobne podatke
          sudionika kviza.
        </p>

        <h2 className="font-display font-semibold text-lg mt-6 mb-2">Koje podatke prikupljamo</h2>
        <ul>
          <li>Ime ili nadimak koji unosiš prije početka kviza</li>
          <li>E-mail adresa, koja služi kao identifikator tvog pokušaja i sprječava višestruko igranje</li>
          <li>Tvoji odgovori i rezultat kviza</li>
        </ul>

        <h2 className="font-display font-semibold text-lg mt-6 mb-2">Javni prikaz</h2>
        <p>
          Na javnoj ljestvici prikazuje se samo tvoje ime/nadimak i broj točnih odgovora. E-mail adresa, datum
          rođenja i drugi osobni podaci nikada se javno ne prikazuju.
        </p>

        <h2 className="font-display font-semibold text-lg mt-6 mb-2">E-mail komunikacija</h2>
        <p>
          E-mail adresu koristimo za potvrdu tvog pokušaja i, ako to izričito odabereš odvojenim pristankom, za
          slanje kratke poruke zahvale i informacija o projektu 72 sata bez kompromisa. Ako ne daš tu privolu,
          nećeš primati nikakve marketinške poruke.
        </p>

        <h2 className="font-display font-semibold text-lg mt-6 mb-2">Tvoja prava</h2>
        <p>
          Možeš u bilo kojem trenutku zatražiti brisanje svojih podataka ili povlačenje privole za primanje
          obavijesti. Kontaktiraj organizatora projekta 72 sata bez kompromisa za takav zahtjev.
        </p>
      </div>
    </div>
  );
}
