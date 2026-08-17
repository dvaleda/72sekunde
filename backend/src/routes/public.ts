import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { buildAttemptQuestionOrder, computeTargetDifficulty, pickAdaptiveNext } from '../lib/questionSelector';
import { QUIZ_DURATION_SECONDS, QuestionRow, AttemptRow, OptionKey, MIN_72H_MANDATORY } from '../lib/types';
import { sendQuizResultEmail } from '../lib/email';

export const publicRouter = Router();

// ---------- POST /api/players ----------
const createPlayerSchema = z.object({
  nickname: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(255),
  termsAccepted: z.literal(true),
  marketingConsent: z.boolean(),
});

publicRouter.post('/players', async (req, res) => {
  const parsed = createPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Neispravni podaci.', details: parsed.error.flatten() });
  }
  const { nickname, email, termsAccepted, marketingConsent } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Upsert-like behavior: if the player already exists (e.g. they reloaded
  // the registration page before starting), reuse their row rather than
  // erroring, but the one-attempt-per-email rule is enforced separately
  // in /attempts.
  const { data: existing, error: findErr } = await supabase
    .from('players')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (findErr) return res.status(500).json({ error: 'Greška baze podataka.' });

  if (existing) {
    return res.json({ player: existing });
  }

  const { data: created, error: insertErr } = await supabase
    .from('players')
    .insert({
      nickname,
      email: normalizedEmail,
      terms_accepted: termsAccepted,
      marketing_consent: marketingConsent,
    })
    .select('*')
    .single();

  if (insertErr) return res.status(500).json({ error: 'Greška prilikom stvaranja igrača.' });

  return res.status(201).json({ player: created });
});

const MAX_ATTEMPTS = 2;

// ---------- GET /api/attempts/check?email=... ----------
publicRouter.get('/attempts/check', async (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email je obavezan.' });

  const { data: player } = await supabase.from('players').select('id').eq('email', email).maybeSingle();
  if (!player) return res.json({ hasPlayed: false, attemptsUsed: 0 });

  const { count } = await supabase
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', player.id)
    .eq('status', 'finished');

  const attemptsUsed = count ?? 0;
  return res.json({ hasPlayed: attemptsUsed >= MAX_ATTEMPTS, attemptsUsed });
});

// ---------- POST /api/attempts ----------
const createAttemptSchema = z.object({ playerId: z.string().uuid() });

publicRouter.post('/attempts', async (req, res) => {
  const parsed = createAttemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Neispravni podaci.' });
  const { playerId } = parsed.data;

  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .maybeSingle();
  if (playerErr || !player) return res.status(404).json({ error: 'Igrač nije pronađen.' });

  // Enforce max 3 finished attempts per player.
  const { count: finishedCount } = await supabase
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('status', 'finished');
  if ((finishedCount ?? 0) >= MAX_ATTEMPTS) {
    return res.status(409).json({ error: 'Iskoristio/la si sva 3 pokušaja.' });
  }

  // If there's an unexpired in-progress attempt, resume it instead of
  // creating a second one (handles reload / double-tab).
  const nowIso = new Date().toISOString();
  const { data: existingInProgress } = await supabase
    .from('attempts')
    .select('*')
    .eq('player_id', playerId)
    .eq('status', 'in_progress')
    .gt('expires_at', nowIso)
    .maybeSingle();

  if (existingInProgress) {
    return res.json({ attempt: sanitizeAttempt(existingInProgress) });
  }

  // Any old in-progress-but-expired attempts get closed out defensively.
  await supabase
    .from('attempts')
    .update({ status: 'expired' })
    .eq('player_id', playerId)
    .eq('status', 'in_progress')
    .lte('expires_at', nowIso);

  const { data: activeQuestions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('active', true);
  if (qErr || !activeQuestions) return res.status(500).json({ error: 'Greška prilikom dohvaćanja pitanja.' });

  // Collect all question IDs the player has already seen across previous attempts.
  const { data: prevAttempts } = await supabase
    .from('attempts')
    .select('question_order')
    .eq('player_id', playerId)
    .neq('status', 'in_progress');
  const previouslySeenIds = new Set<string>(
    (prevAttempts ?? []).flatMap((a: any) => a.question_order as string[])
  );

  let order: QuestionRow[];
  try {
    order = buildAttemptQuestionOrder(activeQuestions as QuestionRow[], previouslySeenIds);
  } catch (e) {
    return res.status(500).json({ error: 'Greška u bazi pitanja.' });
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + QUIZ_DURATION_SECONDS * 1000);

  const { data: attempt, error: attemptErr } = await supabase
    .from('attempts')
    .insert({
      player_id: playerId,
      attempt_number: (finishedCount ?? 0) + 1,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'in_progress',
      question_order: order.map((q) => q.id),
    })
    .select('*')
    .single();

  if (attemptErr || !attempt) {
    console.error('[attempts] insert error:', attemptErr);
    return res.status(500).json({ error: 'Greška pri pokretanju kviza. Molimo pokušaj ponovo za nekoliko sekundi.' });
  }

  return res.status(201).json({ attempt: sanitizeAttempt(attempt), attemptsUsed: (finishedCount ?? 0) + 1 });
});

function sanitizeAttempt(attempt: AttemptRow) {
  // Never leak question_order or score composition to the client ahead of time.
  return {
    id: attempt.id,
    expiresAt: attempt.expires_at,
    startedAt: attempt.started_at,
    status: attempt.status,
  };
}

// ---------- GET /api/attempts/:id/question ----------
publicRouter.get('/attempts/:id/question', async (req, res) => {
  const attemptId = req.params.id;
  const { attempt, error } = await loadLiveAttempt(attemptId);
  if (error) return res.status(error.status).json({ error: error.message });
  if (!attempt) return res.status(404).json({ error: 'Pokušaj nije pronađen.' });

  const expired = await closeIfExpired(attempt);
  if (expired) {
    return res.json({ finished: true, reason: 'time_up' });
  }

 const { data: answeredRows } = await supabase
    .from('answers')
    .select('question_id, is_correct, sequence_number')
    .eq('attempt_id', attemptId)
    .order('sequence_number', { ascending: true });
  const answeredIds = new Set((answeredRows ?? []).map((r) => r.question_id));

  const order: string[] = attempt.question_order;
  let nextQuestionId: string | undefined;

  if (answeredIds.size < MIN_72H_MANDATORY) {
    // Still inside the mandatory first-5-are-72H opening: serve strictly
    // in the precomputed order, no adaptivity yet (nothing to adapt to).
    nextQuestionId = order.find((qid) => !answeredIds.has(qid));
  } else {
    // Past the mandatory opening: pick adaptively from whatever's left in
    // the pool, based on the player's recent performance in this attempt.
    const remainingIds = order.filter((qid) => !answeredIds.has(qid));
    if (remainingIds.length > 0) {
      const { data: remainingRows } = await supabase
        .from('questions')
        .select('*')
        .in('id', remainingIds);
      const remainingQuestions = (remainingRows ?? []) as QuestionRow[];
      // Preserve the pool's original relative order (it already encodes
      // the anti-repeat / category-spread guarantees) rather than however
      // the DB happened to return rows.
      remainingQuestions.sort((a, b) => remainingIds.indexOf(a.id) - remainingIds.indexOf(b.id));

      const recentOutcomes = (answeredRows ?? [])
        .slice(-3)
        .map((r) => ({ isCorrect: Boolean(r.is_correct) }));
      const targetDifficulty = computeTargetDifficulty(recentOutcomes);

      const lastAnsweredId = answeredRows?.[answeredRows.length - 1]?.question_id ?? null;
      let lastCategory: string | null = null;
      if (lastAnsweredId) {
        const { data: lastQ } = await supabase
          .from('questions')
          .select('category')
          .eq('id', lastAnsweredId)
          .maybeSingle();
        lastCategory = lastQ?.category ?? null;
      }

      const picked = pickAdaptiveNext(remainingQuestions, targetDifficulty, lastCategory);
      nextQuestionId = picked?.id;
    }
  }

  if (!nextQuestionId) {
    // Ran through the whole prepared pool (shouldn't normally happen within 72s).
    return res.json({ finished: true, reason: 'pool_exhausted' });
  }

  const { data: question } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, category')
    .eq('id', nextQuestionId)
    .single();

  if (!question) return res.status(500).json({ error: 'Pitanje nije pronađeno.' });

  return res.json({
    finished: false,
    question: {
      id: question.id,
      text: question.question_text,
      category: question.category,
      options: { A: question.option_a, B: question.option_b, C: question.option_c },
    },
    expiresAt: attempt.expires_at,
    sequenceNumber: answeredIds.size + 1,
  });
});

// ---------- POST /api/attempts/:id/answer ----------
const answerSchema = z.object({
  questionId: z.string().min(1),
  selected: z.enum(['A', 'B', 'C']),
});

publicRouter.post('/attempts/:id/answer', async (req, res) => {
  const attemptId = req.params.id;
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Neispravan odgovor.' });
  const { questionId, selected } = parsed.data;

  const { attempt, error } = await loadLiveAttempt(attemptId);
  if (error) return res.status(error.status).json({ error: error.message });
  if (!attempt) return res.status(404).json({ error: 'Pokušaj nije pronađen.' });

  const expired = await closeIfExpired(attempt);
  if (expired) {
    return res.status(410).json({ error: 'Vrijeme je isteklo.' });
  }

  const order: string[] = attempt.question_order;
  if (!order.includes(questionId)) {
    return res.status(400).json({ error: 'Pitanje ne pripada ovom pokušaju.' });
  }

  // Reject if already answered (no going back / no double submission).
  const { data: existingAnswer } = await supabase
    .from('answers')
    .select('id')
    .eq('attempt_id', attemptId)
    .eq('question_id', questionId)
    .maybeSingle();
  if (existingAnswer) {
    return res.status(409).json({ error: 'Na ovo pitanje je već odgovoreno.' });
  }

  const { data: question } = await supabase
    .from('questions')
    .select('correct_answer')
    .eq('id', questionId)
    .single();
  if (!question) return res.status(404).json({ error: 'Pitanje nije pronađeno.' });

  const { data: answeredRows } = await supabase
    .from('answers')
    .select('id, is_correct')
    .eq('attempt_id', attemptId);
  const sequenceNumber = (answeredRows?.length ?? 0) + 1;

  const isCorrect = (selected as OptionKey) === question.correct_answer;

  const { error: insertErr } = await supabase.from('answers').insert({
    attempt_id: attemptId,
    question_id: questionId,
    selected_answer: selected,
    is_correct: isCorrect,
    sequence_number: sequenceNumber,
  });
  if (insertErr) return res.status(500).json({ error: 'Greška prilikom spremanja odgovora.' });

  // Bonus +3s only when current answer completes an exact new group of 3 correct in a row.
  // Count consecutive correct answers ending with this one.
  const allOutcomes = [...(answeredRows ?? []).map((a: any) => a.is_correct), isCorrect];
  let consecutiveCorrect = 0;
  for (let i = allOutcomes.length - 1; i >= 0; i--) {
    if (allOutcomes[i]) consecutiveCorrect++;
    else break;
  }
  const streakBonus = consecutiveCorrect > 0 && consecutiveCorrect % 3 === 0;
  const bonusMs = streakBonus ? 3000 : 0;

  // Extend expires_at by 700ms (feedback display) + streak bonus
  const newExpiresAt = new Date(new Date(attempt.expires_at).getTime() + 700 + bonusMs);

  await supabase
    .from('attempts')
    .update({
      score: attempt.score + (isCorrect ? 1 : 0),
      answered_count: attempt.answered_count + 1,
      expires_at: newExpiresAt.toISOString(),
    })
    .eq('id', attemptId);

  return res.json({ accepted: true, correct: isCorrect, correctAnswer: question.correct_answer, expiresAt: newExpiresAt.toISOString(), streakBonus });
});

// ---------- POST /api/attempts/:id/finish ----------
publicRouter.post('/attempts/:id/finish', async (req, res) => {
  const attemptId = req.params.id;
  const { attempt, error } = await loadLiveAttempt(attemptId, true);
  if (error) return res.status(error.status).json({ error: error.message });
  if (!attempt) return res.status(404).json({ error: 'Pokušaj nije pronađen.' });

  if (attempt.status === 'finished') {
    return res.json(await buildResultPayload(attempt));
  }

  const finishedAttempt = await finalizeAttempt(attempt);
  const payload = await buildResultPayload(finishedAttempt);

  // Fire-and-forget email (only if consent given).
  const { data: player } = await supabase.from('players').select('*').eq('id', attempt.player_id).single();
  if (player?.marketing_consent) {
    const { data: config } = await supabase.from('event_config').select('*').eq('id', 1).single();
    sendQuizResultEmail({
      to: player.email,
      nickname: player.nickname,
      score: finishedAttempt.score,
      answeredCount: finishedAttempt.answered_count,
      officialProjectUrl: config?.official_project_url ?? 'https://72h.hr/',
      officialRegistrationUrl: config?.official_registration_url ?? null,
    }).catch((e) => console.error('[email] failed to send result email', e));
  }

  return res.json(payload);
});

async function getFinishedCount(playerId: string): Promise<number> {
  const { count } = await supabase
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .eq('status', 'finished');
  return count ?? 0;
}

// ---------- GET /api/leaderboard ----------
publicRouter.get('/leaderboard', async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit ?? 50));
  const { data, error } = await supabase
    .from('leaderboard_view')
    .select('*')
    .order('score', { ascending: false })
    .order('elapsed_seconds', { ascending: true })
    .order('finished_at', { ascending: true })
    .limit(limit);

  if (error) return res.status(500).json({ error: 'Greška prilikom dohvaćanja ljestvice.' });

  const rows = (data ?? []).map((row: any, idx: number) => ({
    rank: idx + 1,
    nickname: row.nickname,
    score: row.score,
  }));

  const totalPlayers = (data ?? []).length;
  const topScore = totalPlayers > 0 ? (data as any[])[0].score : 0;

  let myRank: number | null = null;
  let myRow: { rank: number; nickname: string; score: number } | null = null;
  const attemptId = req.query.attemptId ? String(req.query.attemptId) : null;
  if (attemptId) {
    const { data: all } = await supabase
      .from('leaderboard_view')
      .select('attempt_id, nickname, score')
      .order('score', { ascending: false })
      .order('elapsed_seconds', { ascending: true })
      .order('finished_at', { ascending: true });
    const idx = (all ?? []).findIndex((r: any) => r.attempt_id === attemptId);
    if (idx >= 0) {
      myRank = idx + 1;
      myRow = { rank: myRank, nickname: (all as any[])[idx].nickname, score: (all as any[])[idx].score };
    }
  }

  return res.json({ leaderboard: rows, myRank, myRow, totalPlayers, topScore });
});

// ---------- GET /api/stats ----------
publicRouter.get('/stats', async (_req, res) => {
  const { data } = await supabase
    .from('leaderboard_view')
    .select('score')
    .order('score', { ascending: false });
  const totalPlayers = (data ?? []).length;
  const topScore = totalPlayers > 0 ? (data as any[])[0].score : 0;
  return res.json({ totalPlayers, topScore });
});

// ---------- GET /api/event-config ----------
publicRouter.get('/event-config', async (_req, res) => {
  const { data, error } = await supabase.from('event_config').select('*').eq('id', 1).single();
  if (error || !data) return res.status(500).json({ error: 'Greška prilikom dohvaćanja postavki.' });
  const { id, updated_at, ...publicConfig } = data;
  return res.json({ config: publicConfig });
});

// ---------------- helpers ----------------

async function loadLiveAttempt(
  attemptId: string,
  allowFinished = false
): Promise<{ attempt: AttemptRow | null; error: { status: number; message: string } | null }> {
  const { data, error } = await supabase.from('attempts').select('*').eq('id', attemptId).maybeSingle();
  if (error) return { attempt: null, error: { status: 500, message: 'Greška baze podataka.' } };
  if (!data) return { attempt: null, error: null };
  if (!allowFinished && data.status === 'expired') {
    return { attempt: null, error: { status: 410, message: 'Vrijeme je isteklo.' } };
  }
  return { attempt: data as AttemptRow, error: null };
}

async function closeIfExpired(attempt: AttemptRow): Promise<boolean> {
  if (attempt.status !== 'in_progress') return attempt.status !== 'finished' ? true : false;
  const now = Date.now();
  const expiresAt = new Date(attempt.expires_at).getTime();
  if (now >= expiresAt) {
    await finalizeAttempt(attempt);
    return true;
  }
  return false;
}

async function finalizeAttempt(attempt: AttemptRow): Promise<AttemptRow> {
  if (attempt.status === 'finished') return attempt;

  // Recompute score/answered_count from the answers table server-side —
  // never trust any client-sent score.
  const { data: answers } = await supabase
    .from('answers')
    .select('is_correct')
    .eq('attempt_id', attempt.id);

  const score = (answers ?? []).filter((a) => a.is_correct).length;
  const answeredCount = (answers ?? []).length;

  const finishedAt = new Date().toISOString();
  const { data: updated } = await supabase
    .from('attempts')
    .update({
      status: 'finished',
      finished_at: finishedAt,
      score,
      answered_count: answeredCount,
    })
    .eq('id', attempt.id)
    .select('*')
    .single();

  return (updated as AttemptRow) ?? { ...attempt, status: 'finished', finished_at: finishedAt, score, answered_count: answeredCount };
}

async function buildResultPayload(attempt: AttemptRow) {
  const { data: all } = await supabase
    .from('leaderboard_view')
    .select('attempt_id')
    .order('score', { ascending: false })
    .order('elapsed_seconds', { ascending: true })
    .order('finished_at', { ascending: true });
  const idx = (all ?? []).findIndex((r: any) => r.attempt_id === attempt.id);
  const finishedCount = await getFinishedCount(attempt.player_id);
  return {
    score: attempt.score,
    answeredCount: attempt.answered_count,
    rank: idx >= 0 ? idx + 1 : null,
    attemptsUsed: finishedCount,
    playerId: attempt.player_id,
  };
}
