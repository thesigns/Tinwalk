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

// Two notations rolled together: '2d6' and '1d3' make '2d6+1d3'.
export function addDice(a, b) {
  return /^\s*-/.test(b) ? `${a}${b.trim()}` : `${a}+${b.trim()}`;
}
