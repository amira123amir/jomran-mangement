import { describe, it, expect } from 'vitest';
import { pad2 } from '../../utils/dateHelpers';

describe('pad2', () => {
  it('pads single digits with leading zero', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(5)).toBe('05');
    expect(pad2(9)).toBe('09');
  });

  it('does not pad double digits', () => {
    expect(pad2(10)).toBe('10');
    expect(pad2(23)).toBe('23');
    expect(pad2(59)).toBe('59');
  });
});
