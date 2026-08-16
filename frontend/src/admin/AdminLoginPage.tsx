import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, setToken } from '../lib/adminApi';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await adminApi.login(email, password);
      setToken(token);
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Prijava neuspješna.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
        <h1 className="font-display font-bold text-xl text-brand-greenDark mb-6">Admin prijava</h1>
        <div className="space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
          />
          <input
            type="password"
            placeholder="Lozinka"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-green text-white font-semibold py-3 rounded-xl disabled:opacity-60"
          >
            {loading ? 'Prijava...' : 'Prijavi se'}
          </button>
        </div>
      </form>
    </div>
  );
}
