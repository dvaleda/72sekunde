import { describe, it, expect } from 'vitest';
import { buildAttemptQuestionOrder } from '../lib/questionSelector';
import { QUESTION_BANK } from '../../scripts/questionBank';
import { QuestionRow, MIN_72H_MANDATORY, MIN_72H_TOTAL } from '../lib/types';

const bank = QUESTION_BANK as QuestionRow[];

describe('buildAttemptQuestionOrder', () => {
  it('always starts with 3 consecutive 72H questions', () => {
    for (let i = 0; i < 20; i++) {
      const order = buildAttemptQuestionOrder(bank);
      const first3 = order.slice(0, MIN_72H_MANDATORY);
      expect(first3.every((q) => q.category === '72H')).toBe(true);
    }
  });

  it('contains at least 5 total 72H questions per attempt', () => {
    for (let i = 0; i < 20; i++) {
      const order = buildAttemptQuestionOrder(bank);
      const count72H = order.filter((q) => q.category === '72H').length;
      expect(count72H).toBeGreaterThanOrEqual(MIN_72H_TOTAL);
    }
  });

  it('never repeats a question within one attempt', () => {
    for (let i = 0; i < 20; i++) {
      const order = buildAttemptQuestionOrder(bank);
      const ids = order.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('does not let a single category dominate with 20+ questions', () => {
    for (let i = 0; i < 20; i++) {
      const order = buildAttemptQuestionOrder(bank);
      const counts: Record<string, number> = {};
      for (const q of order) counts[q.category] = (counts[q.category] ?? 0) + 1;
      for (const cat of Object.keys(counts)) {
        expect(counts[cat]).toBeLessThan(20);
      }
    }
  });

  it('avoids same-category back-to-back questions outside the first 3, in the large majority of cases', () => {
    let totalTransitions = 0;
    let repeatedTransitions = 0;
    for (let i = 0; i < 30; i++) {
      const order = buildAttemptQuestionOrder(bank);
      const rest = order.slice(MIN_72H_MANDATORY);
      for (let j = 1; j < rest.length; j++) {
        totalTransitions++;
        if (rest[j].category === rest[j - 1].category) repeatedTransitions++;
      }
    }
    // Best-effort rule ("po mogućnosti"), so we assert it's the strong
    // majority rather than 100%.
    expect(repeatedTransitions / totalTransitions).toBeLessThan(0.15);
  });

  it('produces a different order across two calls (randomization)', () => {
    const orderA = buildAttemptQuestionOrder(bank).map((q) => q.id);
    const orderB = buildAttemptQuestionOrder(bank).map((q) => q.id);
    expect(orderA).not.toEqual(orderB);
  });
});
