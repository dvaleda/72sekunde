import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, clearToken } from '../lib/adminApi';

type Tab = 'dashboard' | 'leaderboard' | 'players' | 'questions' | 'settings';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');

  useEffect(() => {
    if (!sessionStorage.getItem('admin_token')) navigate('/admin');
  }, [navigate]);

  function logout() {
    clearToken();
    navigate('/admin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="font-display font-bold text-brand-greenDark">72 sekunde – Admin</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800">
          Odjava
        </button>
      </header>

      <nav className="bg-white border-b border-gray-100 px-6 flex gap-6 overflow-x-auto text-sm font-medium">
        {(
          [
            ['dashboard', 'Dashboard'],
            ['leaderboard', 'Ljestvica'],
            ['players', 'Igrači'],
            ['questions', 'Pitanja'],
            ['settings', 'Postavke'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-3 border-b-2 whitespace-nowrap ${
              tab === key ? 'border-brand-green text-brand-green' : 'border-transparent text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-4xl mx-auto">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'leaderboard' && <LeaderboardTab />}
        {tab === 'players' && <PlayersTab />}
        {tab === 'questions' && <QuestionsTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="font-display font-bold text-2xl text-brand-greenDark">{value}</div>
    </div>
  );
}

function DashboardTab() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.dashboard>> | null>(null);
  useEffect(() => {
    adminApi.dashboard().then(setData).catch(() => {});
  }, []);
  if (!data) return <p className="text-gray-400">Učitavanje...</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <Card label="Ukupno igrača" value={data.totalPlayers} />
      <Card label="Završeni kvizovi" value={data.finishedQuizzes} />
      <Card label="Prosječan rezultat" value={data.averageScore} />
      <Card label="Najbolji rezultat" value={data.topScore} />
      <Card label="Marketinška privola" value={data.marketingConsentCount} />
    </div>
  );
}

function LeaderboardTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    adminApi.leaderboard(search).then((r) => setRows(r.leaderboard));
  }, [search]);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <input
          placeholder="Pretraži po imenu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs"
        />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="px-4 py-2">Ime</th>
            <th className="px-4 py-2">Rezultat</th>
            <th className="px-4 py-2">Odgovoreno</th>
            <th className="px-4 py-2">Vrijeme (s)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.attempt_id} className="border-b border-gray-50">
              <td className="px-4 py-2 font-medium">{r.nickname}</td>
              <td className="px-4 py-2">{r.score}</td>
              <td className="px-4 py-2">{r.answered_count}</td>
              <td className="px-4 py-2">{Math.round(r.elapsed_seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayersTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  function load() {
    adminApi.players(search).then((r) => setRows(r.players));
  }
  useEffect(load, [search]);

  async function handleDelete(id: string) {
    if (!confirm('Trajno izbrisati ovog igrača i sve njegove podatke?')) return;
    await adminApi.deletePlayer(id);
    load();
  }
  async function handleRevoke(id: string) {
    await adminApi.revokeConsent(id);
    load();
  }
  async function handleExport() {
    const blob = await adminApi.exportCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '72sekunde-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <input
          placeholder="Pretraži po imenu ili e-mailu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <button onClick={handleExport} className="bg-brand-green text-white text-sm font-semibold px-4 py-2 rounded-lg">
          EXPORT CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="px-4 py-2">Ime</th>
            <th className="px-4 py-2">E-mail</th>
            <th className="px-4 py-2">Rezultat</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Privola</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-gray-50">
              <td className="px-4 py-2 font-medium">{p.nickname}</td>
              <td className="px-4 py-2 text-gray-500">{p.email}</td>
              <td className="px-4 py-2">{p.attempt?.score ?? '-'}</td>
              <td className="px-4 py-2">{p.attempt?.status ?? 'nije igrao'}</td>
              <td className="px-4 py-2">{p.marketing_consent ? 'da' : 'ne'}</td>
              <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                {p.marketing_consent && (
                  <button onClick={() => handleRevoke(p.id)} className="text-xs text-gray-500 underline">
                    povuci privolu
                  </button>
                )}
                <button onClick={() => handleDelete(p.id)} className="text-xs text-red-600 underline">
                  izbriši
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CATEGORIES = ['72H', 'MARIJA_BISTRICA', 'BIBLIJA', 'VJERA', 'SVECI', 'MARIJA_KRUNICA'];

function QuestionsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  function load() {
    adminApi.questions().then((r) => setRows(r.questions));
  }
  useEffect(load, []);

  async function handleSave(q: any) {
    if (rows.find((r) => r.id === q.id)) {
      await adminApi.updateQuestion(q.id, q);
    } else {
      await adminApi.createQuestion(q);
    }
    setEditing(null);
    load();
  }

  async function handleDeactivate(id: string) {
    if (!confirm('Deaktivirati ovo pitanje?')) return;
    await adminApi.deactivateQuestion(id);
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{rows.length} pitanja ukupno</p>
        <button
          onClick={() => setEditing({ id: '', category: '72H', question_text: '', option_a: '', option_b: '', option_c: '', correct_answer: 'A', difficulty: 'MEDIUM', active: true })}
          className="bg-brand-green text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          Novo pitanje
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Kategorija</th>
              <th className="px-4 py-2">Pitanje</th>
              <th className="px-4 py-2">Težina</th>
              <th className="px-4 py-2">Aktivno</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id} className="border-b border-gray-50">
                <td className="px-4 py-2 text-gray-400">{q.id}</td>
                <td className="px-4 py-2">{q.category}</td>
                <td className="px-4 py-2 max-w-xs truncate">{q.question_text}</td>
                <td className="px-4 py-2">{q.difficulty}</td>
                <td className="px-4 py-2">{q.active ? 'da' : 'ne'}</td>
                <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => setEditing(q)} className="text-xs text-brand-green underline">
                    uredi
                  </button>
                  {q.active && (
                    <button onClick={() => handleDeactivate(q.id)} className="text-xs text-red-600 underline">
                      deaktiviraj
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <QuestionEditor question={editing} onCancel={() => setEditing(null)} onSave={handleSave} />}
    </div>
  );
}

function QuestionEditor({ question, onCancel, onSave }: { question: any; onCancel: () => void; onSave: (q: any) => void }) {
  const [q, setQ] = useState(question);
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <h3 className="font-display font-bold text-lg">Uredi pitanje</h3>
        <input
          placeholder="ID (npr. 72H-31)"
          value={q.id}
          disabled={Boolean(question.id)}
          onChange={(e) => setQ({ ...q, id: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
        />
        <select
          value={q.category}
          onChange={(e) => setQ({ ...q, category: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <textarea
          placeholder="Tekst pitanja"
          value={q.question_text}
          onChange={(e) => setQ({ ...q, question_text: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          rows={2}
        />
        {(['A', 'B', 'C'] as const).map((k) => (
          <input
            key={k}
            placeholder={`Odgovor ${k}`}
            value={q[`option_${k.toLowerCase()}`]}
            onChange={(e) => setQ({ ...q, [`option_${k.toLowerCase()}`]: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        ))}
        <select
          value={q.correct_answer}
          onChange={(e) => setQ({ ...q, correct_answer: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="A">Točan: A</option>
          <option value="B">Točan: B</option>
          <option value="C">Točan: C</option>
        </select>
        <select
          value={q.difficulty}
          onChange={(e) => setQ({ ...q, difficulty: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="EASY">EASY</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HARD">HARD</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={q.active} onChange={(e) => setQ({ ...q, active: e.target.checked })} />
          Aktivno
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">
            Odustani
          </button>
          <button onClick={() => onSave(q)} className="flex-1 bg-brand-green text-white rounded-lg py-2 text-sm font-semibold">
            Spremi
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [config, setConfig] = useState<any | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.eventConfig().then((r) => setConfig(r.config));
  }, []);

  async function handleSave() {
    const { config: updated } = await adminApi.updateEventConfig(config);
    setConfig(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!config) return <p className="text-gray-400">Učitavanje...</p>;

  const fields: [string, string][] = [
    ['project_name', 'Naziv projekta'],
    ['edition_year', 'Godina izdanja'],
    ['slogan', 'Slogan'],
    ['official_registration_url', 'URL za prijavu'],
    ['official_project_url', 'URL projekta'],
    ['organizer_name', 'Organizator'],
    ['age_min', 'Min. dob'],
    ['age_max', 'Max. dob'],
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-lg space-y-4">
      {fields.map(([key, label]) => (
        <div key={key}>
          <label className="block text-xs text-gray-500 mb-1">{label}</label>
          <input
            value={config[key] ?? ''}
            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      ))}
      <button onClick={handleSave} className="bg-brand-green text-white font-semibold px-4 py-2 rounded-lg text-sm">
        Spremi postavke
      </button>
      {saved && <span className="text-green-600 text-sm ml-3">Spremljeno!</span>}
    </div>
  );
}
