import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { verifyAdminCredentials, issueAdminToken, requireAdmin } from '../lib/adminAuth';

export const adminRouter = Router();

// ---------- POST /api/admin/login ----------
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

adminRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Neispravni podaci.' });
  const { email, password } = parsed.data;
  if (!verifyAdminCredentials(email, password)) {
    return res.status(401).json({ error: 'Neispravni podaci za prijavu.' });
  }
  const token = issueAdminToken(email);
  return res.json({ token });
});

// Everything below requires a valid admin JWT.
adminRouter.use(requireAdmin);

// ---------- GET /api/admin/dashboard ----------
adminRouter.get('/dashboard', async (_req, res) => {
  const { count: totalPlayers } = await supabase.from('players').select('*', { count: 'exact', head: true });
  const { count: finishedCount } = await supabase
    .from('attempts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'finished');
  const { data: finishedAttempts } = await supabase.from('attempts').select('score').eq('status', 'finished');
  const { count: marketingCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('marketing_consent', true);

  const scores = (finishedAttempts ?? []).map((a) => a.score);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const topScore = scores.length ? Math.max(...scores) : 0;

  return res.json({
    totalPlayers: totalPlayers ?? 0,
    finishedQuizzes: finishedCount ?? 0,
    averageScore: Math.round(avgScore * 100) / 100,
    topScore,
    marketingConsentCount: marketingCount ?? 0,
  });
});

// ---------- GET /api/admin/leaderboard ----------
adminRouter.get('/leaderboard', async (req, res) => {
  const search = req.query.search ? String(req.query.search) : '';
  let query = supabase
    .from('leaderboard_view')
    .select('*')
    .order('score', { ascending: false })
    .order('elapsed_seconds', { ascending: true })
    .order('finished_at', { ascending: true });
  if (search) query = query.ilike('nickname', `%${search}%`);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Greška baze podataka.' });
  return res.json({ leaderboard: data ?? [] });
});

// ---------- GET /api/admin/players ----------
adminRouter.get('/players', async (req, res) => {
  const search = req.query.search ? String(req.query.search) : '';
  let query = supabase
    .from('players')
    .select('id, nickname, email, marketing_consent, terms_accepted, created_at')
    .order('created_at', { ascending: false });
  if (search) query = query.or(`nickname.ilike.%${search}%,email.ilike.%${search}%`);
  const { data: players, error } = await query;
  if (error) return res.status(500).json({ error: 'Greška baze podataka.' });

  const playerIds = (players ?? []).map((p) => p.id);
  const { data: attempts } = await supabase
    .from('attempts')
    .select('player_id, score, answered_count, status, finished_at, started_at')
    .in('player_id', playerIds.length ? playerIds : ['00000000-0000-0000-0000-000000000000']);

  const attemptsByPlayer = new Map<string, any>();
  for (const a of attempts ?? []) {
    // one attempt per player expected; keep the finished one if present
    if (!attemptsByPlayer.has(a.player_id) || a.status === 'finished') {
      attemptsByPlayer.set(a.player_id, a);
    }
  }

  const rows = (players ?? []).map((p) => ({
    ...p,
    attempt: attemptsByPlayer.get(p.id) ?? null,
  }));

  return res.json({ players: rows });
});

// ---------- Player deletion / consent (GDPR) ----------
adminRouter.delete('/players/:id', async (req, res) => {
  const { error } = await supabase.from('players').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Greška prilikom brisanja.' });
  return res.json({ deleted: true });
});

adminRouter.post('/players/:id/revoke-consent', async (req, res) => {
  const { error } = await supabase
    .from('players')
    .update({ marketing_consent: false })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Greška prilikom ažuriranja.' });
  return res.json({ updated: true });
});

// ---------- Questions CRUD ----------
adminRouter.get('/questions', async (_req, res) => {
  const { data, error } = await supabase.from('questions').select('*').order('id');
  if (error) return res.status(500).json({ error: 'Greška baze podataka.' });
  return res.json({ questions: data ?? [] });
});

const questionSchema = z.object({
  id: z.string().min(1).max(50),
  category: z.enum(['72H', 'MARIJA_BISTRICA', 'BIBLIJA', 'VJERA', 'SVECI', 'MARIJA_KRUNICA']),
  question_text: z.string().min(1),
  option_a: z.string().min(1),
  option_b: z.string().min(1),
  option_c: z.string().min(1),
  correct_answer: z.enum(['A', 'B', 'C']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  active: z.boolean().default(true),
});

adminRouter.post('/questions', async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Neispravni podaci.', details: parsed.error.flatten() });
  if (new Set([parsed.data.option_a, parsed.data.option_b, parsed.data.option_c]).size !== 3) {
    return res.status(400).json({ error: 'Odgovori A/B/C moraju biti različiti.' });
  }
  const { data, error } = await supabase.from('questions').insert(parsed.data).select('*').single();
  if (error) return res.status(500).json({ error: 'Greška prilikom stvaranja pitanja (možda ID već postoji).' });
  return res.status(201).json({ question: data });
});

adminRouter.put('/questions/:id', async (req, res) => {
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Neispravni podaci.' });
  if (parsed.data.option_a && parsed.data.option_b && parsed.data.option_c) {
    if (new Set([parsed.data.option_a, parsed.data.option_b, parsed.data.option_c]).size !== 3) {
      return res.status(400).json({ error: 'Odgovori A/B/C moraju biti različiti.' });
    }
  }
  const { data, error } = await supabase
    .from('questions')
    .update(parsed.data)
    .eq('id', req.params.id)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: 'Greška prilikom ažuriranja pitanja.' });
  return res.json({ question: data });
});

adminRouter.delete('/questions/:id', async (req, res) => {
  // Soft-delete by deactivating rather than hard delete, so historical
  // answers referencing this question_id stay valid.
  const { error } = await supabase.from('questions').update({ active: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Greška prilikom brisanja pitanja.' });
  return res.json({ deactivated: true });
});

// ---------- Event settings ----------
adminRouter.get('/event-config', async (_req, res) => {
  const { data, error } = await supabase.from('event_config').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: 'Greška baze podataka.' });
  return res.json({ config: data });
});

const eventConfigSchema = z.object({
  project_name: z.string().min(1).optional(),
  edition_year: z.number().int().optional(),
  slogan: z.string().optional().nullable(),
  official_registration_url: z.string().url().optional().nullable().or(z.literal('')),
  official_project_url: z.string().url().optional().nullable(),
  organizer_name: z.string().optional().nullable(),
  age_min: z.number().int().optional().nullable(),
  age_max: z.number().int().optional().nullable(),
});

adminRouter.put('/event-config', async (req, res) => {
  const parsed = eventConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Neispravni podaci.', details: parsed.error.flatten() });
  const { data, error } = await supabase
    .from('event_config')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: 'Greška prilikom ažuriranja postavki.' });
  return res.json({ config: data });
});

// ---------- Export CSV ----------
adminRouter.get('/export', async (_req, res) => {
  const { data: players } = await supabase
    .from('players')
    .select('nickname, email, marketing_consent, created_at, id');
  const { data: attempts } = await supabase
    .from('attempts')
    .select('player_id, score, answered_count, finished_at, status');

  const attemptsByPlayer = new Map<string, any>();
  for (const a of attempts ?? []) {
    if (a.status === 'finished') attemptsByPlayer.set(a.player_id, a);
  }

  const header = ['nickname', 'email', 'score', 'answered_count', 'date', 'marketing_consent'];
  const lines = [header.join(',')];

  for (const p of players ?? []) {
    const a = attemptsByPlayer.get(p.id);
    const row = [
      csvEscape(p.nickname),
      csvEscape(p.email),
      a ? String(a.score) : '',
      a ? String(a.answered_count) : '',
      a?.finished_at ? String(a.finished_at) : '',
      p.marketing_consent ? 'true' : 'false',
    ];
    lines.push(row.join(','));
  }

  const csv = lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="72sekunde-export.csv"');
  return res.send(csv);
});

function csvEscape(value: string): string {
  if (value == null) return '';
  const needsQuoting = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}
