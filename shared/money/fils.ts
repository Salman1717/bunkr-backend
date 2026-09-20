// Polyfill BigInt.prototype.toJSON for JSON serialization and Jest IPC workers
if (typeof (BigInt.prototype as any).toJSON !== 'function') {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

/**
 * Bunkr Money Math Engine (Fils Standard)
 *
 * ALL monetary amounts MUST be integer fils (1 AED = 100 fils).
 * ZERO floating-point arithmetic allowed.
 */

/**
 * Converts AED string or integer/decimal representation to bigint fils.
 * Example: "750.00" -> 75000n, "45.5" -> 4550n, 650 -> 65000n.
 */
export function aedToFils(aed: string | number): bigint {
  const str = typeof aed === 'number' ? aed.toFixed(2) : aed.trim();
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const parts = cleanStr.split('.');
  let dirhamStr = parts[0] || '0';
  let filsStr = parts[1] || '00';

  if (filsStr.length === 1) {
    filsStr += '0';
  } else if (filsStr.length > 2) {
    filsStr = filsStr.slice(0, 2);
  }

  const totalFils = BigInt(dirhamStr) * 100n + BigInt(filsStr);
  return isNegative ? -totalFils : totalFils;
}

/**
 * Converts bigint fils to human-readable AED formatted string.
 * Example: 75000n -> "750.00", -86600n -> "-866.00".
 */
export function filsToAedString(fils: bigint): string {
  const isNegative = fils < 0n;
  const absFils = isNegative ? -fils : fils;

  const dirhams = absFils / 100n;
  const remainderFils = absFils % 100n;

  const filsFormatted = remainderFils.toString().padStart(2, '0');
  const result = `${dirhams.toString()}.${filsFormatted}`;

  return isNegative ? `-${result}` : result;
}

/**
 * Sums an array of bigint fils.
 */
export function addFils(...amounts: bigint[]): bigint {
  return amounts.reduce((acc, curr) => acc + curr, 0n);
}

/**
 * Subtracts b from a in bigint fils.
 */
export function subFils(a: bigint, b: bigint): bigint {
  return a - b;
}

/**
 * Multiplies fils by an integer scalar multiplier.
 */
export function mulFils(fils: bigint, scalar: bigint): bigint {
  return fils * scalar;
}

/**
 * Divides fils by an integer denominator (floor integer division).
 */
export function divFilsFloor(fils: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error('Division by zero in fils arithmetic');
  }
  return fils / denominator;
}

/**
 * Largest-Remainder Method (Hamilton-Hare distribution).
 *
 * Distributes gross `totalFils` across N entities proportionally to integer `weights`.
 * Guarantees that sum(result) === totalFils EXACTLY down to 1 fils.
 *
 * @param totalFils Total gross fils to distribute
 * @param weights Proportional integer weights for each item (e.g. scaled consumed man-days)
 */
export function distributeLargestRemainder(
  totalFils: bigint,
  weights: bigint[],
): bigint[] {
  if (weights.length === 0) {
    return [];
  }

  const totalWeight = weights.reduce((acc, w) => acc + w, 0n);

  if (totalWeight === 0n) {
    // If sum of weights is zero, return 0 for all items
    return new Array(weights.length).fill(0n);
  }

  const floors: bigint[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];

  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    const numerator = totalFils * w;
    const floorVal = numerator / totalWeight;
    const remVal = numerator % totalWeight;

    floors.push(floorVal);
    remainders.push({ index: i, remainder: remVal });
  }

  const currentSum = floors.reduce((acc, val) => acc + val, 0n);
  let residue = totalFils - currentSum;

  // Sort by remainder descending. Stable sort using index as tie-breaker.
  remainders.sort((a, b) => {
    if (b.remainder > a.remainder) return 1;
    if (b.remainder < a.remainder) return -1;
    return a.index - b.index;
  });

  const shares = [...floors];
  let rIdx = 0;
  while (residue > 0n && rIdx < remainders.length) {
    const targetIdx = remainders[rIdx].index;
    shares[targetIdx] += 1n;
    residue -= 1n;
    rIdx++;
  }

  return shares;
}

/**
 * Distributes `totalFils` equally among `count` members using largest-remainder distribution.
 */
export function allocateEqualShare(totalFils: bigint, count: number): bigint[] {
  if (count <= 0) return [];
  const weights = new Array(count).fill(1n);
  return distributeLargestRemainder(totalFils, weights);
}

/**
 * Calculates prorated rent for an occupied bed duration.
 */
export function calculateProratedRent(
  monthlyRentFils: bigint,
  occupiedDays: number,
  daysInCycle: number,
): bigint {
  if (daysInCycle <= 0) return 0n;
  return (monthlyRentFils * BigInt(occupiedDays)) / BigInt(daysInCycle);
}
