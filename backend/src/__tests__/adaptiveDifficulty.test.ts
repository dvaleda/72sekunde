import { describe, it, expect } from 'vitest';
import { computeTargetDifficulty, pickAdaptiveNext } from '../lib/questionSelector';
import { QuestionRow } from '../lib/types';

function q(id: string, category: string, difficulty: 'EASY' | 'MEDIUM' | 'HARD'): QuestionRow {
  return {
    id,
    category: category as any,
    question_text: `Q ${id}`,
    option_a: 'A',
    option_b: 'B',
    option_c: 'C',
    correct_answer: 'A',
    difficulty,
    active: true,
  };
}

describe('computeTargetDifficulty', () => {
  it('defaults to MEDIUM with no history', () => {
    expect(computeTargetDifficulty([])).toBe('MEDIUM');
  });

  it('escalates to HARD after a correct streak', () => {
    const outcomes = [{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }];
    expect(computeTargetDifficulty(outcomes)).toBe('HARD');
  });

  it('never drops below MEDIUM even after consecutive misses (no punitive EASY wall)', () => {
    const outcomes = [{ isCorrect: false }, { isCorrect: false }, { isCorrect: false }];
    expect(computeTargetDifficulty(outcomes)).toBe('MEDIUM');
  });

  it('holds at MEDIUM for mixed recent results', () => {
    const outcomes = [{ isCorrect: true }, { isCorrect: false }, { isCorrect: true }];
    expect(computeTargetDifficulty(outcomes)).toBe('MEDIUM');
  });

  it('only looks at the last 3 answers, ignoring older history', () => {
    const outcomes = [
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: false },
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: true },
    ];
    expect(computeTargetDifficulty(outcomes)).toBe('HARD');
  });
});

describe('pickAdaptiveNext', () => {
  it('returns null for an empty pool', () => {
    expect(pickAdaptiveNext([], 'HARD', null)).toBeNull();
  });

  it('prefers the target difficulty and a different category than last', () => {
    const pool = [q('a', 'BIBLIJA', 'MEDIUM'), q('b', 'VJERA', 'HARD'), q('c', 'BIBLIJA', 'HARD')];
    const picked = pickAdaptiveNext(pool, 'HARD', 'BIBLIJA');
    expect(picked?.id).toBe('b'); // HARD + different category than last (BIBLIJA)
  });

  it('falls back to target difficulty even if same category, when no other category matches', () => {
    const pool = [q('a', 'BIBLIJA', 'MEDIUM'), q('c', 'BIBLIJA', 'HARD')];
    const picked = pickAdaptiveNext(pool, 'HARD', 'BIBLIJA');
    expect(picked?.id).toBe('c');
  });

  it('falls back toward a harder tier (not straight to EASY) when target tier is unavailable', () => {
    const pool = [q('a', 'SVECI', 'EASY'), q('b', 'SVECI', 'MEDIUM')];
    const picked = pickAdaptiveNext(pool, 'HARD', null);
    expect(picked?.id).toBe('b'); // MEDIUM preferred over EASY when HARD unavailable
  });

  it('always returns something when the pool is non-empty', () => {
    const pool = [q('a', 'SVECI', 'EASY')];
    const picked = pickAdaptiveNext(pool, 'HARD', null);
    expect(picked?.id).toBe('a');
  });
});