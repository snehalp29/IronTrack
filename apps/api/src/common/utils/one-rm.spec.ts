import { estimateOneRm } from './one-rm';

describe('estimateOneRm', () => {
  it('returns 0 when weight is non-positive', () => {
    expect(estimateOneRm(0, 5)).toBe(0);
  });

  it('returns 0 when reps is non-positive', () => {
    expect(estimateOneRm(100, 0)).toBe(0);
  });

  it('calculates Epley one-rep max estimate for positive inputs', () => {
    expect(estimateOneRm(100, 5)).toBeCloseTo(116.6666, 3);
  });
});
