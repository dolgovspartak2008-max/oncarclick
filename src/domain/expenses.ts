/**
 * Расходы ON Car Click на доставку и оформление — заменяют расходы Trust Encar
 * (его комиссию, фрахт, сбор Encar, брокера, стоянку и таможенный сбор).
 * Суммы задаёт компания; где указан диапазон, в цену идёт середина.
 * Чтобы поменять суммы — правьте только эту таблицу.
 */
export type ExpenseItem = { label: string; rub: number; range?: [number, number] };

const mid = (from: number, to: number): ExpenseItem["rub"] => Math.round((from + to) / 2);

/** Машины младше 3 лет — входит в цену. */
export const EXPENSES_UNDER_3: ExpenseItem[] = [
  { label: "Расходы по Корее и доставка до Владивостока", rub: 80_000 },
  { label: "Транзитные расходы", rub: mid(120_000, 160_000), range: [120_000, 160_000] },
  { label: "Доставка до Москвы", rub: 60_000 }
];

/** Машины младше 3 лет — по желанию клиента, в цену не входит. Сейчас таких нет. */
export const OPTIONAL_UNDER_3: ExpenseItem[] = [];

/** Машины от 3 лет (3–5 и старше 5 — одинаково). */
export const EXPENSES_3_PLUS: ExpenseItem[] = [
  { label: "Расходы по Корее и доставка до Владивостока", rub: 80_000 },
  { label: "Услуги брокера, сопровождение", rub: 100_000 },
  { label: "Доставка до Москвы", rub: 230_000 }
];

export type Expenses = {
  group: "under-3" | "3-plus";
  /** Входят в цену. */
  items: ExpenseItem[];
  totalRub: number;
  /** По желанию клиента — в цену не входят. */
  optionalItems: ExpenseItem[];
  /** Примерная доставка до Москвы вне цены. Сейчас null: доставка до Москвы входит в цену для всех машин. */
  moscowDeliveryRub: number | null;
};

export function expensesFor(young: boolean): Expenses {
  const items = young ? EXPENSES_UNDER_3 : EXPENSES_3_PLUS;
  return {
    group: young ? "under-3" : "3-plus",
    items,
    totalRub: items.reduce((sum, item) => sum + item.rub, 0),
    optionalItems: young ? OPTIONAL_UNDER_3 : [],
    moscowDeliveryRub: null
  };
}
