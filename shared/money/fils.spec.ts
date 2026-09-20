import {
  aedToFils,
  filsToAedString,
  addFils,
  subFils,
  mulFils,
  divFilsFloor,
  distributeLargestRemainder,
  allocateEqualShare,
  calculateProratedRent,
} from './fils';

describe('Shared Money Utilities (Fils Standard)', () => {
  describe('aedToFils & filsToAedString', () => {
    it('converts AED string to bigint fils accurately without floating point loss', () => {
      expect(aedToFils('750.00')).toBe(75000n);
      expect(aedToFils('650')).toBe(65000n);
      expect(aedToFils('2400.00')).toBe(240000n);
      expect(aedToFils('45.00')).toBe(4500n);
      expect(aedToFils('-866.00')).toBe(-86600n);
      expect(aedToFils(50)).toBe(5000n);
    });

    it('converts bigint fils to formatted AED string', () => {
      expect(filsToAedString(75000n)).toBe('750.00');
      expect(filsToAedString(65000n)).toBe('650.00');
      expect(filsToAedString(240000n)).toBe('2400.00');
      expect(filsToAedString(-86600n)).toBe('-866.00');
      expect(filsToAedString(0n)).toBe('0.00');
      expect(filsToAedString(50n)).toBe('0.50');
    });
  });

  describe('Basic Fils Arithmetic', () => {
    it('performs addition, subtraction, and multiplication', () => {
      expect(addFils(75000n, 72000n, 5000n)).toBe(152000n);
      expect(subFils(152000n, 86600n)).toBe(65400n);
      expect(mulFils(5000n, 4n)).toBe(20000n);
      expect(divFilsFloor(20000n, 4n)).toBe(5000n);
    });

    it('throws error on division by zero', () => {
      expect(() => divFilsFloor(100n, 0n)).toThrow('Division by zero in fils arithmetic');
    });
  });

  describe('Largest-Remainder Distribution (Hamilton-Hare)', () => {
    it('distributes indivisible amounts with zero loss (sum equals total)', () => {
      // 10001 fils distributed equally across 3 members
      const shares = distributeLargestRemainder(10001n, [1n, 1n, 1n]);
      expect(shares).toEqual([3334n, 3334n, 3333n]);
      const total = addFils(...shares);
      expect(total).toBe(10001n);
    });

    it('distributes mess charges for benchmark scenario (240,000 fils, 100 man-days)', () => {
      // Arun: 30 days, Bilal: 28 days, Chen: 30 days, Dev: 12 days
      const weights = [30n, 28n, 30n, 12n];
      const shares = distributeLargestRemainder(240000n, weights);
      expect(shares).toEqual([72000n, 67200n, 72000n, 28800n]); // 720.00, 672.00, 720.00, 288.00 AED
      expect(addFils(...shares)).toBe(240000n);
    });

    it('handles non-exact decimal man-days (scaled by 10)', () => {
      // Arun: 29.6 days (296), Bilal: 28.4 days (284), Chen: 30 days (300) -> total 88.0 days (880)
      const weights = [296n, 284n, 300n];
      const totalGrocery = 150000n; // 1500.00 AED
      const shares = distributeLargestRemainder(totalGrocery, weights);
      expect(addFils(...shares)).toBe(totalGrocery);
    });
  });

  describe('Equal Share Allocation', () => {
    it('splits expense amount equally among members without losing residue', () => {
      // 1000 fils among 3 room members
      const shares = allocateEqualShare(1000n, 3);
      expect(shares).toEqual([334n, 333n, 333n]);
      expect(addFils(...shares)).toBe(1000n);
    });
  });

  describe('Prorated Rent', () => {
    it('calculates prorated rent based on occupied days', () => {
      const rent = calculateProratedRent(65000n, 15, 30);
      expect(rent).toBe(32500n);
    });
  });
});
