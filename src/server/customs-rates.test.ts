import { describe, expect, test } from "vitest";
import { moscowDate, parseCbrJson, parseCbrXml, parseTrustEncarOfficialRates } from "./customs-rates";

describe("официальные курсы ЦБ", () => {
  test("XML ЦБ: курс воны нормализуется из «за 1 000 ₩»", () => {
    const xml = '<ValCurs Date="12.11.2026" name="Foreign Currency Market">' +
      '<Valute ID="R01239"><NumCode>978</NumCode><CharCode>EUR</CharCode><Nominal>1</Nominal><Name>Euro</Name><Value>92,6968</Value></Valute>' +
      '<Valute ID="R01815"><NumCode>410</NumCode><CharCode>KRW</CharCode><Nominal>1000</Nominal><Name>Won</Name><Value>61,5363</Value></Valute></ValCurs>';
    expect(parseCbrXml(xml)).toEqual({ eurRub: 92.6968, krwRubPer1000: 61.5363, rateDate: "2026-11-12", source: "cbr.ru" });
  });

  test("зеркало cbr-xml-daily.ru", () => {
    expect(parseCbrJson({ Date: "2026-11-12T11:30:00+03:00", Valute: { EUR: { Nominal: 1, Value: 92.6968 }, KRW: { Nominal: 1000, Value: 61.5363 } } }))
      .toMatchObject({ eurRub: 92.6968, krwRubPer1000: 61.5363, rateDate: "2026-11-12" });
  });

  test("курсы ЦБ со страницы Trust Encar", () => {
    const html = "<p>Расчетные курсы на 11.11.2026</p><p>Курс воны по ЦБ 1 000 ₩ = 60,94 ₽</p><p>Курс евро по ЦБ 1 € = 92,39 ₽</p>";
    expect(parseTrustEncarOfficialRates(html)).toMatchObject({ eurRub: 92.39, krwRubPer1000: 60.94, rateDate: "2026-11-11" });
  });

  test("неполные или нелепые данные отбрасываются", () => {
    expect(parseCbrXml("<ValCurs Date=\"12.11.2026\"></ValCurs>")).toBeNull();
    expect(parseCbrJson({ Date: "2026-11-12", Valute: { EUR: { Nominal: 1, Value: 0.5 }, KRW: { Nominal: 1000, Value: 61 } } })).toBeNull();
  });

  test("дата по Москве", () => {
    expect(moscowDate(new Date("2026-11-11T22:30:00Z"))).toMatchObject({ iso: "2026-11-12", cbr: "12/11/2026" });
  });
});
