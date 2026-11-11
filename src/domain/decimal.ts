/**
 * Точная десятичная арифметика для денежных расчётов (без ошибок двоичных дробей).
 * Значение хранится как BigInt, умноженный на 10^SCALE.
 */
const SCALE = 12;
const FACTOR = BigInt(10) ** BigInt(SCALE);

export type Dec = bigint & { readonly __dec?: never };

/** Число или строка вида «92,6968» / «92.6968» → Dec. Только конечные значения. */
export function dec(value: number | string): Dec {
  const text = String(value).trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    // числа вроде 1e-7 приводим к фиксированной записи
    const asNumber = Number(text);
    if (!Number.isFinite(asNumber)) throw new Error(`Некорректное число: ${value}`);
    return dec(asNumber.toFixed(SCALE));
  }
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const digits = (fraction + "0".repeat(SCALE)).slice(0, SCALE);
  const result = BigInt(whole) * FACTOR + BigInt(digits);
  return (negative ? -result : result) as Dec;
}

export const add = (a: Dec, b: Dec) => (a + b) as Dec;
export const sub = (a: Dec, b: Dec) => (a - b) as Dec;
export const mul = (a: Dec, b: Dec) => divRound(a * b, FACTOR);
export const div = (a: Dec, b: Dec) => {
  if (b === BigInt(0)) throw new Error("Деление на ноль");
  return divRound(a * FACTOR, b);
};
export const max = (a: Dec, b: Dec) => (a > b ? a : b);
export const gt = (a: Dec, b: Dec) => a > b;
export const lte = (a: Dec, b: Dec) => a <= b;

/** Деление с округлением половины от нуля. */
function divRound(numerator: bigint, denominator: bigint): Dec {
  const negative = (numerator < BigInt(0)) !== (denominator < BigInt(0));
  const n = numerator < BigInt(0) ? -numerator : numerator;
  const d = denominator < BigInt(0) ? -denominator : denominator;
  const q = (n * BigInt(2) + d) / (d * BigInt(2));
  return (negative ? -q : q) as Dec;
}

/** Округление до `digits` знаков после запятой (половина — от нуля) и перевод в number. */
export function toNumber(value: Dec, digits = 2): number {
  const step = BigInt(10) ** BigInt(SCALE - digits);
  const rounded = divRound(value, step);
  const negative = rounded < BigInt(0);
  const abs = negative ? -rounded : rounded;
  const unit = BigInt(10) ** BigInt(digits);
  const text = `${abs / unit}${digits ? "." + (abs % unit).toString().padStart(digits, "0") : ""}`;
  return Number((negative ? "-" : "") + text);
}
