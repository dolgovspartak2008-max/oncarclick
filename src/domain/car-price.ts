/**
 * Итоговая цена машины. Единственная формула на сайте:
 *   priceRub = priceBaseRub + recyclingFeeRub + dutyRub
 * где
 *   priceBaseRub    — машина в Корее (carPriceKoreaRub) + расходы ON Car Click по возрасту (src/domain/expenses.ts);
 *                     расходы Trust Encar (комиссия, фрахт, брокер, стоянка, таможенный сбор) в цену не входят.
 *                     Если цены машины в Корее нет — запасной вариант: цена источника без его пошлины и утильсбора;
 *   recyclingFeeRub — утильсбор по таблице ON Car Click (src/domain/recycling-fee.ts), не меняется;
 *   dutyRub         — пошлина для клиента (customs.customerDutyRub): официальная, а для машин младше 3 лет — 60 % от неё.
 * Пошлина и утильсбор источника из цены вычитаются, поэтому ни то, ни другое не начисляется дважды.
 */
import type { CatalogSort } from "./catalog";
import { expensesFor, type Expenses } from "./expenses";
import { ageAt, calculateCustomsDuty, sumRub, type CustomsDuty, type EngineKind, type OfficialRates, type ProductionBasis } from "./customs-duty";

export type PricingFields = {
  productionYear: number | null;
  productionMonth: number | null;
  productionBasis: ProductionBasis | null;
  engineKind: EngineKind;
  priceKrw: number;
  engineCc: number | null;
  /** Цена машины в Корее, ₽ (по курсу источника или нашему курсу из бота). */
  carPriceKoreaRub: number | null;
  /** Расходы ON Car Click; null — возраст неизвестен, используются расходы источника. */
  expenses: Expenses | null;
  /** Запасная база: цена источника без его пошлины и утильсбора. */
  sourceBaseRub: number | null;
  priceBaseRub: number | null;
  recyclingFeeRub: number | null;
  /** Пошлина, рассчитанная источником (Trust Encar). Используется, только если свою посчитать нельзя. */
  sourceDutyRub: number | null;
  /** Пошлина, учтённая в priceRub. */
  dutyRub: number | null;
  /** "calculated" — наш расчёт; "source" — расчёт источника, машина требует уточнения. */
  dutySource: "calculated" | "source" | null;
  customs: CustomsDuty | null;
  priceRub: number | null;
};

/** Цена без нашего расчёта пошлины (пока нет курсов): берём пошлину источника, чтобы цена не была занижена. */
export function provisionalPrice<T extends PricingFields>(car: T): T {
  const dutyRub = car.sourceDutyRub;
  return {
    ...car,
    dutyRub,
    dutySource: dutyRub == null ? null : "source",
    priceRub: car.priceBaseRub ? sumRub([car.priceBaseRub, car.recyclingFeeRub, dutyRub]) : null
  };
}

/** База цены: машина в Корее + наши расходы по возрасту; без цены в Корее или года — база источника. */
export function withExpenses<T extends PricingFields>(car: T, now = new Date()): T {
  const age = ageAt(car.productionYear, car.productionMonth, now);
  if (!car.carPriceKoreaRub || !age) return { ...car, expenses: null, priceBaseRub: car.sourceBaseRub };
  const expenses = expensesFor(age.youngDiscount);
  return { ...car, expenses, priceBaseRub: car.carPriceKoreaRub + expenses.totalRub };
}

/** Считает расходы и пошлину по характеристикам машины и собирает итоговую цену. */
export function priceWithCustoms<T extends PricingFields>(input: T, rates: OfficialRates | null, now = new Date()): T {
  const car = withExpenses(input, now);
  const customs = calculateCustomsDuty({
    priceKrw: car.priceKrw || null,
    engineCc: car.engineCc,
    engineKind: car.engineKind,
    productionYear: car.productionYear,
    productionMonth: car.productionMonth,
    productionBasis: car.productionBasis
  }, rates, now);
  if (customs.customerDutyRub == null) {
    // Не выдумываем пошлину и не ставим ноль: остаётся расчёт источника, машина помечена «требует уточнения».
    return { ...provisionalPrice(car), customs };
  }
  return {
    ...car,
    customs,
    dutyRub: customs.customerDutyRub,
    dutySource: "calculated",
    priceRub: car.priceBaseRub ? sumRub([car.priceBaseRub, car.recyclingFeeRub, customs.customerDutyRub]) : null
  };
}

/**
 * Источник сортирует по своей цене, а наша итоговая отличается (пошлина −40 % для машин до 3 лет),
 * поэтому внутри страницы досортировываем по итоговой цене.
 */
export function sortByFinalPrice<T extends { priceRub: number | null }>(items: T[], sort: CatalogSort) {
  if (sort !== "price-asc" && sort !== "price-desc") return items;
  const sign = sort === "price-asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.priceRub == null || b.priceRub == null) return a.priceRub == null ? (b.priceRub == null ? 0 : 1) : -1;
    return sign * (a.priceRub - b.priceRub);
  });
}
