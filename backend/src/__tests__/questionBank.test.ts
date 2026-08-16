import { describe, it, expect } from 'vitest';
import { QUESTION_BANK } from '../../scripts/questionBank';

const VALID_CATEGORIES = new Set(['72H', 'MARIJA_BISTRICA', 'BIBLIJA', 'VJERA', 'SVECI', 'MARIJA_KRUNICA']);

describe('question bank quality (spec section 31)', () => {
  it('has exactly 120 active questions', () => {
    const active = QUESTION_BANK.filter((q) => q.active);
    expect(active.length).toBe(120);
  });

  it('has unique ids', () => {
    const ids = QUESTION_BANK.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every question has non-empty A/B/C options', () => {
    for (const q of QUESTION_BANK) {
      expect(q.option_a.trim().length).toBeGreaterThan(0);
      expect(q.option_b.trim().length).toBeGreaterThan(0);
      expect(q.option_c.trim().length).toBeGreaterThan(0);
    }
  });

  it('correct_answer is always A, B, or C', () => {
    for (const q of QUESTION_BANK) {
      expect(['A', 'B', 'C']).toContain(q.correct_answer);
    }
  });

  it('every question has a known, non-empty category', () => {
    for (const q of QUESTION_BANK) {
      expect(VALID_CATEGORIES.has(q.category)).toBe(true);
    }
  });

  it('no question has identical A/B/C answers', () => {
    for (const q of QUESTION_BANK) {
      const set = new Set([q.option_a, q.option_b, q.option_c]);
      expect(set.size).toBe(3);
    }
  });

  it('has no fully duplicated questions (same text + same options)', () => {
    const seen = new Set<string>();
    for (const q of QUESTION_BANK) {
      const key = `${q.question_text}|${q.option_a}|${q.option_b}|${q.option_c}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('matches the required category distribution', () => {
    const counts: Record<string, number> = {};
    for (const q of QUESTION_BANK) counts[q.category] = (counts[q.category] ?? 0) + 1;
    expect(counts['72H']).toBe(30);
    expect(counts['MARIJA_BISTRICA']).toBe(20);
    expect(counts['BIBLIJA']).toBe(20);
    expect(counts['VJERA']).toBe(20);
    expect(counts['SVECI']).toBe(15);
    expect(counts['MARIJA_KRUNICA']).toBe(15);
  });

  it('skews toward MEDIUM/HARD rather than a flat 25/50/25 split (intentional difficulty rebalance)', () => {
    const counts: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const q of QUESTION_BANK) counts[q.difficulty]++;
    const total = QUESTION_BANK.length;
    // Target: roughly 17% EASY / 44% MEDIUM / 39% HARD.
    expect(counts.EASY / total).toBeLessThan(0.2);
    expect(counts.HARD / total).toBeGreaterThan(0.3);
    expect(counts.EASY + counts.MEDIUM + counts.HARD).toBe(total);
  });

  it('no answer option text is implausibly longer than the others (rough length-balance check)', () => {
    for (const q of QUESTION_BANK) {
      const lens = [q.option_a.length, q.option_b.length, q.option_c.length];
      const max = Math.max(...lens);
      const min = Math.min(...lens);
      // Not a hard spec rule with numbers attached, so keep this generous;
      // it just catches egregious outliers (e.g. one 200-char option).
      expect(max - min).toBeLessThan(65);
    }
  });
});
