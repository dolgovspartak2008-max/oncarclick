import { describe, expect, test } from "vitest";
import { applyKrwRate, parseTrustEncarRate } from "./rate";
import type { CatalogCar } from "@/domain/trust-encar";

describe("курс воны", () => {
  test("достаёт курс источника со страницы машины", () => {
    const html = "<li><div>Стоимость авто в Корее</div>30 300 000 ₩ (1 965 864 ₽)</li>";
    expect(parseTrustEncarRate(html.replace("</div>", ":</div>"))).toBeCloseTo(64.88, 1);
  });

  test("переносит разницу курсов на цену машины, утильсбор и пошлину не трогает", () => {
    const car = { priceKrw: 30_000_000, priceBaseRub: 3_000_000, recyclingFeeRub: 900_000, dutyRub: 500_000, priceRub: 4_400_000 } as CatalogCar;
    const priced = applyKrwRate(car, 66, 65);
    expect(priced.priceBaseRub).toBe(3_030_000);
    expect(priced.recyclingFeeRub).toBe(900_000);
    expect(priced.dutyRub).toBe(500_000);
    expect(applyKrwRate(car, null, 65)).toBe(car);
  });
});
