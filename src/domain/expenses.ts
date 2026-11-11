/**
 * Расходы ON Car Click на доставку и оформление — заменяют расходы Trust Encar
 * (его комиссию, фрахт, сбор Encar, брокера, стоянку и таможенный сбор).
 * Суммы задаёт компания; где указан диапазон, в цену идёт середина.
 * Чтобы поменять суммы — правьте только эту таблицу.
 */
export type ExpenseItem = { label: string; rub: number; range?: [number, number] };

const mid = (from: number, to: number): ExpenseItem["rub"] => Math.round((from + to) / 2);

/** Машины младше 3 лет (схема с транзитными номерами и поездкой в Минск). */
export const EXPENSES_UNDER_3: ExpenseItem[] = [
  { label: "Расходы по Корее и доставка до Владивостока", rub: 80_000 },
  { label: "Транзитные номера", rub: mid(120_000, 160_000), range: [120_000, 160_000] },
  { label: "Поездка в Минск и обратно", rub: 60_000 }
];

/** Машины от 3 лет (3–5 и старше 5 — одинаково). */
export const EXPENSES_3_PLUS: ExpenseItem[] = [
  { label: "Расходы по Корее и доставка до Владивостока", rub: 80_000 },
  { label: "Услуги брокера, сопровождение", rub: 100_000 }
];

/** Доставка до Москвы для машин младше 3 лет — в цену не входит, показывается отдельно. */
export const MOSCOW_DELIVERY_UNDER_3: [number, number] = [180_000, 260_000];

export type Expenses = {
  group: "under-3" | "3-plus";
  items: ExpenseItem[];
  totalRub: number;
  /** Не входит в цену. null — для этой группы не применяется. */
  moscowDeliveryRange: [number, number] | null;
};

export function expensesFor(young: boolean): Expenses {
  const items = young ? EXPENSES_UNDER_3 : EXPENSES_3_PLUS;
  return {
    group: young ? "under-3" : "3-plus",
    items,
    totalRub: items.reduce((sum, item) => sum + item.rub, 0),
    moscowDeliveryRange: young ? MOSCOW_DELIVERY_UNDER_3 : null
  };
}
