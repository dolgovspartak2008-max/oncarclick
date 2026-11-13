/**
 * Расходы ON Car Click на доставку и оформление — заменяют расходы Trust Encar
 * (его комиссию, фрахт, сбор Encar, брокера, стоянку и таможенный сбор).
 * Суммы задаёт компания; где указан диапазон, в цену идёт середина.
 * Чтобы поменять суммы — правьте только эту таблицу.
 */
export type ExpenseItem = { label: string; rub: number; range?: [number, number] };

/**
 * Машины младше 3 лет растаможиваются в Беларуси, поэтому путь длиннее:
 * Корея → Владивосток → Москва → Беларусь (растаможка) → Москва.
 */
export const EXPENSES_UNDER_3: ExpenseItem[] = [
  { label: "Расходы по Корее и доставка до Владивостока", rub: 80_000 },
  { label: "Доставка из Владивостока до Москвы", rub: 230_000 },
  { label: "Автовоз Москва → Беларусь → Москва", rub: 60_000 }
];

/** Памятка для клиента под расходами машин младше 3 лет. */
export const NOTE_UNDER_3 =
  "Почему такой путь: автомобили младше 3 лет растаможиваются не в России, а в Беларуси. " +
  "Поэтому машина идёт из Кореи во Владивосток, затем из Владивостока в Москву, " +
  "из Москвы — в Беларусь на растаможку и после оформления возвращается обратно в Москву.";

/** Машины младше 3 лет — по желанию клиента, в цену не входит. Сейчас таких нет. */
export const OPTIONAL_UNDER_3: ExpenseItem[] = [];

/**
 * Машины от 3 лет (3–5 и старше 5 — одинаково): расходы по Корее и доставка до Владивостока
 * плюс брокерское сопровождение. Дальше маршрут у каждого клиента свой и считается индивидуально.
 */
export const EXPENSES_3_PLUS: ExpenseItem[] = [
  { label: "Расходы по Корее и доставка до Владивостока", rub: 80_000 },
  { label: "Брокерское сопровождение", rub: 100_000 }
];

export type Expenses = {
  group: "under-3" | "3-plus";
  /** Входят в цену. */
  items: ExpenseItem[];
  totalRub: number;
  /** По желанию клиента — в цену не входят. */
  optionalItems: ExpenseItem[];
  /** Пояснение к расходам для клиента (почему такой маршрут) или null. */
  note: string | null;
  /** Примерная доставка до Москвы вне цены. Сейчас null. */
  moscowDeliveryRub: number | null;
};

export function expensesFor(young: boolean): Expenses {
  const items = young ? EXPENSES_UNDER_3 : EXPENSES_3_PLUS;
  return {
    group: young ? "under-3" : "3-plus",
    items,
    totalRub: items.reduce((sum, item) => sum + item.rub, 0),
    optionalItems: young ? OPTIONAL_UNDER_3 : [],
    note: young ? NOTE_UNDER_3 : null,
    moscowDeliveryRub: null
  };
}
