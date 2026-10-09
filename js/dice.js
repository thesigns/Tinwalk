// Dice notation such as '2d6', '1d6+2' or '2d6+1d3-1': a sum of dice and
// whole numbers, each term added or subtracted.

const TERM = /([+-]?)(\d+)(?:d(\d+))?/g;

// The terms of a notation as { sign, count, sides }. A whole number n is n
// one-sided dice, so it needs no case of its own.
function terms(notation) {
  return [...notation.replace(/\s/g, '').matchAll(TERM)].map(([, sign, count, sides]) => ({
    sign: sign === '-' ? -1 : 1,
    count: Number(count),
    sides: sides ? Number(sides) : 1,
  }));
}

export function rollDice(notation, random = Math.random) {
  let total = 0;
  for (const { sign, count, sides } of terms(notation)) {
    for (let i = 0; i < count; i++) total += sign * (1 + Math.floor(random() * sides));
  }
  return total;
}

// The lowest and highest possible rolls: [min, max].
export function diceRange(notation) {
  let min = 0;
  let max = 0;
  for (const { sign, count, sides } of terms(notation)) {
    const [low, high] = sign > 0 ? [count, count * sides] : [-count * sides, -count];
    min += low;
    max += high;
  }
  return [min, max];
}

export function diceAverage(notation) {
  return terms(notation).reduce((sum, { sign, count, sides }) => sum + (sign * count * (sides + 1)) / 2, 0);
}

// Notations rolled together, with like dice gathered so the sum reads as
// players write it: '2d6', '1d6' and '1d3' make '3d6+1d3'. Dice keep the
// order they first appear in, and whole numbers come last.
export function addDice(...notations) {
  const gathered = new Map();
  for (const { sign, count, sides } of notations.flatMap(terms)) {
    const key = `${sign}:${sides}`;
    gathered.set(key, { sign, sides, count: (gathered.get(key)?.count ?? 0) + count });
  }
  const dice = [...gathered.values()].filter(({ sides }) => sides > 1);
  const number = [...gathered.values()].filter(({ sides }) => sides === 1).reduce((sum, { sign, count }) => sum + sign * count, 0);
  const parts = dice.map(({ sign, count, sides }) => `${sign < 0 ? '-' : '+'}${count}d${sides}`);
  if (number !== 0) parts.push(`${number < 0 ? '-' : '+'}${Math.abs(number)}`);
  return parts.join('').replace(/^\+/, '') || '0';
}
