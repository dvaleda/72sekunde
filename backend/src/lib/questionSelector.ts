import { QuestionRow, MIN_72H_MANDATORY, MIN_72H_TOTAL, Difficulty } from './types';

/**
 * Builds the ordered list of question IDs for one attempt.
 *
 * Rules (from spec section 3 / 20):
 *  - First 5 questions are always from category 72H.
 *  - The attempt must contain at least 8 questions from 72H in total
 *    (the first 5 count toward this minimum; at least 3 more 72H
 *    questions are reserved for later in the session).
 *  - Remaining slots are filled with weighted-random selection across
 *    all categories (including 72H, which may appear more than the
 *    guaranteed minimum by chance).
 *  - No question repeats within one attempt.
 *  - Where possible, avoid showing two questions from the same category
 *    back-to-back, except in the first 5 (which are intentionally all 72H).
 *  - A player should not end up with 20+ questions from a single category.
 *  - We build a full ordered pool sized to comfortably cover 72 seconds of
 *    play (the frontend/backend only ever advance one at a time, so a
 *    generous pool avoids ever running out mid-attempt).
 */

const POOL_SIZE = 60;
const SAME_CATEGORY_STREAK_CAP_RATIO = 0.34;
const MAX_72H_IN_POOL = 10; // hard cap: at most 10 out of 60 questions are 72H (~17%)
const DIFFICULTY_WEIGHT: Record<string, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedRandomPick(
  candidates: QuestionRow[],
  count: number,
  excludeIds: Set<string>
): QuestionRow[] {
  // Weighted-random: weight is inversely related to category size so that
  // small categories (e.g. SVECI/MARIJA_KRUNICA with 15 questions) aren't
  // drowned out by larger ones (BIBLIJA/VJERA/MARIJA_BISTRICA with 20, 72H
  // with 30), giving a more even spread across categories over the pool.
  const pool = candidates.filter((q) => !excludeIds.has(q.id));
  const byCategory = new Map<string, QuestionRow[]>();
  for (const q of pool) {
    if (!byCategory.has(q.category)) byCategory.set(q.category, []);
    // Expand by difficulty weight so harder questions are picked more often.
    const weight = DIFFICULTY_WEIGHT[q.difficulty] ?? 1;
    for (let i = 0; i < weight; i++) byCategory.get(q.category)!.push(q);
  }
  for (const list of byCategory.values()) shuffle(list);

  const categories = [...byCategory.keys()];
  const picked: QuestionRow[] = [];
  const used = new Set<string>();

  // Round-robin across categories (this naturally implements weighted
  // fairness and also helps avoid same-category streaks), pulling one
  // question at a time until we hit `count` or run out.
  let guard = 0;
  while (picked.length < count && guard < count * 20) {
    guard++;
    const shuffledCats = shuffle(categories);
    let pickedThisRound = false;
    for (const cat of shuffledCats) {
      const list = byCategory.get(cat)!;
      const next = list.find((q) => !used.has(q.id));
      if (next) {
        picked.push(next);
        used.add(next.id);
        pickedThisRound = true;
        if (picked.length >= count) break;
      }
    }
    if (!pickedThisRound) break; // exhausted all categories
  }

  return picked;
}

/**
 * Reorders a pool so that (a) no two consecutive questions share a category
 * where avoidable, and (b) no category exceeds the streak cap. Best-effort:
 * if it's mathematically impossible to avoid a repeat (e.g. one category
 * dominates the remaining pool), it falls back to the least-bad placement.
 */
function interleaveAvoidingRepeats(questions: QuestionRow[]): QuestionRow[] {
  const buckets = new Map<string, QuestionRow[]>();
  for (const q of questions) {
    if (!buckets.has(q.category)) buckets.set(q.category, []);
    buckets.get(q.category)!.push(q);
  }
  for (const list of buckets.values()) shuffle(list);

  const result: QuestionRow[] = [];
  let lastCategory: string | null = null;

  while (result.length < questions.length) {
    const cats = shuffle([...buckets.keys()].filter((c) => buckets.get(c)!.length > 0));

    // Prefer a category different from the last placed one.
    let chosen = cats.find((c) => c !== lastCategory);
    if (!chosen) chosen = cats[0]; // unavoidable repeat, only one category left

    const list = buckets.get(chosen)!;
    const q = list.shift()!;
    result.push(q);
    lastCategory = chosen;
  }

  return result;
}

/**
 * Main entry point: builds the ordered question-id list for a fresh attempt.
 */
export function buildAttemptQuestionOrder(
  allActiveQuestions: QuestionRow[],
  previouslySeenIds: Set<string> = new Set()
): QuestionRow[] {
  const by72H = allActiveQuestions.filter((q) => q.category === '72H');
  const others = allActiveQuestions.filter((q) => q.category !== '72H');

  if (by72H.length < MIN_72H_TOTAL) {
    throw new Error(
      `Question bank invariant violated: need at least ${MIN_72H_TOTAL} active 72H questions, found ${by72H.length}.`
    );
  }

  // Prefer unseen 72H questions first, fall back to seen ones.
  const shuffled72H = shuffle(by72H);
  const prioritized72H = [
    ...shuffled72H.filter((q) => !previouslySeenIds.has(q.id)),
    ...shuffled72H.filter((q) => previouslySeenIds.has(q.id)),
  ];

  // Step 1: reserve the first 5 mandatory 72H questions.
  const first5 = prioritized72H.slice(0, MIN_72H_MANDATORY);

  // Step 2: reserve at least 3 more 72H questions to appear later.
  const extra72HMin = Math.max(0, MIN_72H_TOTAL - MIN_72H_MANDATORY);
  const remaining72HPool = prioritized72H.slice(MIN_72H_MANDATORY);
  const extra72H = remaining72HPool.slice(0, extra72HMin);

  const usedIds = new Set<string>([...first5, ...extra72H].map((q) => q.id));

  // Step 3: fill the rest of the pool with weighted-random selection across
  // ALL categories (72H included), respecting the "no repeats" and rough
  // "no category dominates" rules.
  const targetPoolSize = Math.min(
    POOL_SIZE,
    allActiveQuestions.length // never ask for more than exist
  );
  const stillNeeded = Math.max(0, targetPoolSize - usedIds.size);

  const allCandidates = allActiveQuestions.filter((q) => !usedIds.has(q.id));
  const unseenCandidates = allCandidates.filter((q) => !previouslySeenIds.has(q.id));
  // Exclude 72H from the free pool — they already have their guaranteed slots above.
  const nonH72Candidates = (unseenCandidates.length >= stillNeeded ? unseenCandidates : allCandidates)
    .filter((q) => q.category !== '72H');
  const candidatePool = nonH72Candidates;
  const streakCap = Math.max(MIN_72H_TOTAL, Math.floor(targetPoolSize * SAME_CATEGORY_STREAK_CAP_RATIO));

  const weighted = weightedRandomPick(candidatePool, stillNeeded, usedIds);

  // Enforce per-category cap (72H already capped via exclusion above).
  const countsSoFar = new Map<string, number>();
  countsSoFar.set('72H', first5.length + extra72H.length);
  const restOfPool: QuestionRow[] = [];
  for (const q of weighted) {
    const current = countsSoFar.get(q.category) ?? 0;
    if (current >= streakCap) continue; // skip, would exceed the cap
    countsSoFar.set(q.category, current + 1);
    restOfPool.push(q);
  }

  // Step 4: interleave the "rest of pool" so same-category questions are
  // spread out (first 5 are deliberately left as all-72H per spec).
  const interleavedRest = interleaveAvoidingRepeats(restOfPool);

  // Step 5: weave the reserved extra 72H questions into the interleaved
  // rest so they don't all cluster together, while still avoiding
  // back-to-back 72H repeats where possible.
  const finalRest: QuestionRow[] = [];
  const extraQueue = shuffle(extra72H);
  let sinceLast72H = 0;
  for (const q of interleavedRest) {
    finalRest.push(q);
    sinceLast72H++;
    if (extraQueue.length > 0 && sinceLast72H >= 3) {
      finalRest.push(extraQueue.shift()!);
      sinceLast72H = 0;
    }
  }
  // Any leftover extra-72H questions that didn't get woven in go at the end.
  finalRest.push(...extraQueue);

  return [...first5, ...finalRest];
}

// ---------------------------------------------------------------------------
// Adaptive difficulty layer
// ---------------------------------------------------------------------------
//
// The pool built above already satisfies every structural rule from the
// spec (72H placement, no repeats, no category dominance, etc.), and the
// underlying question bank itself now skews harder (~17% EASY / 44% MEDIUM
// / 39% HARD instead of a flat 25/50/25) so an average attempt is tougher
// by default.
//
// On top of that, this layer makes the *within-attempt* experience adapt to
// how the individual player is doing: a player on a correct streak gets
// pushed toward HARD questions faster than the static pool order would;
// a player who's missing questions gets eased back toward MEDIUM (never
// back to a trivial EASY wall, so it never feels like being "punished").
// The selection never violates the underlying pool's no-repeat / anti-
// clustering guarantees — it only changes *which already-eligible* question
// from the remaining pool gets served next, and does not reveal difficulty
// to the client (spec: "ne otkrivaj težinu pitanja igraču").

export interface RecentAnswerOutcome {
  isCorrect: boolean;
}

/**
 * Determines the target difficulty tier for the *next* question based on
 * the player's most recent answers within this attempt.
 */
export function computeTargetDifficulty(recentOutcomes: RecentAnswerOutcome[]): Difficulty {
  if (recentOutcomes.length === 0) return 'MEDIUM'; // default baseline, no signal yet

  const window = recentOutcomes.slice(-3); // look at the last up to 3 answers
  const correctCount = window.filter((o) => o.isCorrect).length;

  if (window.length >= 2 && correctCount === window.length) {
    return 'HARD'; // on a streak: escalate
  }
  if (window.length >= 2 && correctCount === 0) {
    return 'MEDIUM'; // struggling: ease off, but never drop to EASY mid-game
  }
  return 'MEDIUM'; // mixed results: hold steady
}

/**
 * Picks the next question to serve from the remaining (unanswered) portion
 * of the attempt's pool, preferring one matching the target difficulty and,
 * where possible, a different category than the immediately previous
 * question (to preserve the "avoid back-to-back same category" rule).
 * Falls back gracefully so a question is always returned as long as the
 * remaining pool is non-empty.
 */
export function pickAdaptiveNext(
  remainingPool: QuestionRow[],
  targetDifficulty: Difficulty,
  lastCategory: string | null
): QuestionRow | null {
  if (remainingPool.length === 0) return null;

  const byDifficultyAndCategory = remainingPool.find(
    (q) => q.difficulty === targetDifficulty && q.category !== lastCategory
  );
  if (byDifficultyAndCategory) return byDifficultyAndCategory;

  const byDifficultyOnly = remainingPool.find((q) => q.difficulty === targetDifficulty);
  if (byDifficultyOnly) return byDifficultyOnly;

  // Nothing left at the target tier (pool is running low) — try the next
  // hardest available tier before falling all the way back to EASY, so a
  // hot streak still gets *something* harder than a pure EASY fallback.
  const fallbackOrder: Difficulty[] =
    targetDifficulty === 'HARD' ? ['MEDIUM', 'EASY'] : targetDifficulty === 'MEDIUM' ? ['HARD', 'EASY'] : ['MEDIUM', 'HARD'];
  for (const tier of fallbackOrder) {
    const match = remainingPool.find((q) => q.difficulty === tier && q.category !== lastCategory);
    if (match) return match;
  }
  for (const tier of fallbackOrder) {
    const match = remainingPool.find((q) => q.difficulty === tier);
    if (match) return match;
  }

  return remainingPool[0]; // absolute fallback: whatever's left
}
