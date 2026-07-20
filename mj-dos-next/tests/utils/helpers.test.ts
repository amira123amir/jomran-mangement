import { describe, it, expect } from 'vitest';
import { uid } from '../../utils/helpers';

describe('uid', () => {
  it('returns a string starting with the prefix', () => {
    const id = uid('order');
    expect(id).toMatch(/^order-/);
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid('test')));
    expect(ids.size).toBe(100);
  });
});
