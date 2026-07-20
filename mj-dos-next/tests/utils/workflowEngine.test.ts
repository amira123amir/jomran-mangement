import { describe, it, expect } from 'vitest';
import { isCEO } from '../../utils/workflowEngine';

describe('workflowEngine', () => {
  it('isCEO returns true for CEO name', () => {
    expect(isCEO('محمد جمران')).toBe(true);
  });

  it('isCEO returns false for non-CEO', () => {
    expect(isCEO('أحمد')).toBe(false);
  });
});
