import { load } from "cheerio";
import { describe, expect, test } from "vitest";
import { parseInspectionPage, zoneOf } from "./encar-inspection";

// Разметка повторяет страницу trust-encar.ru/auto/{id}/ (ноябрь 2026), сокращена до нужных блоков.
const section = (title: string, inner: string) =>
  `<div class="product-descr sost"><h3><button>${title}</button></h3><div class="table__info">${inner}</div></div>`;
const row = (label: string, value: string, tone = "good") =>
  `<tr><th class="table__title" scope="row"><p>${label}</p></th><td><span class="txt_state txt_state--${tone}">${value}</span></td></tr>`;
const status = (cls: string, letter: string, label: string, code: string) =>
  `<span class="inspection-body__status inspection-body__status--${cls}"><span class="inspection-body__badge inspection-body__badge--${cls}">${letter}</span><span>${label}<small>Код ${code}</small></span></span>`;
const part = (name: string, code: string, statuses: string) =>
  `<li class="inspection-body__part"><div class="inspection-body__part-name"><strong>${name}</strong><small>Код детали: ${code}</small></div><div class="inspection-body__statuses">${statuses}</div></li>`;
const group = (cls: string, title: string, parts: string) =>
  `<section class="inspection-body__group inspection-body__group--${cls}"><header class="inspection-body__group-head"><div><h4>${title}</h4><p>…</p></div><span>1</span></header><ul class="inspection-body__parts">${parts}</ul></section>`;

const history = section("Данные проверки и истории автомобиля", `<table class="inspection-table"><tbody>
  <tr><td class="table__title"></td><th class="table__title" scope="col"><p>Оценка</p></th></tr>
  ${row("Пробег на момент инспекции", "158 463 км", "neutral")}
  ${row("Состояние VIN / номерной маркировки", "Хорошо")}
  ${row("Отзывные кампании", "Есть: не выполнена", "bad")}
  ${row("Автомобиль отмечен как диагностированный Encar", "Отсутствует", "x")}
  ${row("Записи о залоге / обременении", "Отсутствует", "x")}
</tbody></table>`) + section("Отметки об авариях, ремонтах и затоплении", `<table class="inspection-table"><tbody>
  ${row("Отметка о серьёзной аварии", "Есть", "bad")}
  ${row("Отметка о простом ремонте", "Есть", "warning")}
  ${row("Признаки затопления", "Отсутствует")}
  ${row("Записи о полной гибели из-за затопления", "Отсутствует", "x")}
</tbody></table>`) + section("Детализация страховых случаев и ремонтов", `<div class="accident-table-wrap"><table class="accident-table"><tbody>
  <tr><th class="table__title" scope="col"><p>Дата события</p></th><th>Тип</th><th>Запчасти</th><th>Работы</th><th>Окрас</th><th>Итого</th><th>Выплата</th></tr>
  <tr><td>08.05.2025</td><td>Повреждение этого автомобиля</td><td>315 000 ₩ (19 814 ₽)</td><td>189 680 ₩ (11 931 ₽)</td><td>324 209 ₩ (20 393 ₽)</td><td>828 889 ₩ (52 137 ₽)</td><td>900 000 ₩ (56 610 ₽)</td></tr>
</tbody></table></div>`);

const checks = section("Техническая проверка", `<table class="inspection-table"><tbody>
  <tr><th>Раздел</th><th>Параметр</th><th>Оценка</th></tr>
  <tr><th class="table__title" scope="row"><p>Двигатель</p></th><td>Утечка масла — клапанная крышка</td><td><span class="txt_state txt_state--good">Отсутствует</span></td></tr>
  <tr><th class="table__title" scope="row"><p>Коробка передач</p></th><td>Утечка масла</td><td><span class="txt_state txt_state--warning">Незначительная</span></td></tr>
</tbody></table>`);

const meta = `<dl class="inspection-body__meta">
  <div><dt>Номер отчёта</dt><dd>2632407538</dd></div><div><dt>Номер предложения</dt><dd>59954</dd></div>
  <div><dt>Дата выдачи</dt><dd>02.11.2026</dd></div><div><dt>Продавец</dt><dd>상사</dd></div>
</dl><details class="inspection-body__comment"><summary>Комментарий</summary><p lang="ko">좌)프론트휀더 조정</p></details>`;

const damaged = history + checks + section("Схема состояния кузова", `<div class="inspection-body-accordion"><div class="wrapper"><div class="inspection-body">
  <div class="inspection-body__summary inspection-body__summary--accident"><strong>В отчёте отмечены сведения об аварии</strong></div>
  <div class="image-wrapper inspection-body__scheme-wrap"><div class="inspection-body__scheme"></div></div>
  <div class="inspection-body__groups">
    ${group("outer", "Съёмные внешние панели",
      part("Задняя дверь (левая)", "P033", status("repair", "Р", "Кузовной ремонт / сварка", "W")) +
      part("Переднее крыло (правое)", "P022", status("replacement", "З", "Замена", "X")) +
      part("Капот", "P011", status("replacement", "З", "Замена", "X") + status("corrosion", "К", "Коррозия", "C")))}
    ${group("outer-fixed", "Несъёмные внешние панели", part("Заднее крыло (слева)", "P061", status("repair", "Р", "Кузовной ремонт / сварка", "W")))}
    ${group("frame", "Основной каркас — группа A", part("Передняя панель", "P091", status("repair", "Р", "Кузовной ремонт / сварка", "W")))}
  </div>${meta}</div></div></div>`);

describe("технический лист Encar со страницы Trust Encar", () => {
  test("переносит все отмеченные детали, коды и несколько отметок на одной детали", () => {
    const { inspection } = parseInspectionPage(load(damaged));
    expect(inspection?.format).toBe("structured");
    expect(inspection?.parts.map((p) => [p.code, p.zone, p.statuses.map((s) => s.code).join("+")])).toEqual([
      ["P033", "door-rl", "W"],
      ["P022", "fender-r", "X"],
      ["P011", "hood", "X+C"],
      ["P061", "quarter-l", "W"],
      ["P091", "front-panel", "W"]
    ]);
    expect(inspection?.parts[2].statuses[1]).toEqual({ code: "C", label: "Коррозия", kind: "corrosion" });
    expect(inspection?.parts[4].group).toBe("frame");
    expect(inspection?.accident).toBe(true);
    expect(inspection?.simpleRepair).toBe(true);
  });

  test("сведения отчёта: пробег, дата, номер, комментарий и проверка узлов", () => {
    const { inspection } = parseInspectionPage(load(damaged));
    expect(inspection?.mileageKm).toBe(158_463);
    expect(inspection?.issuedAt).toBe("02.11.2026");
    expect(inspection?.meta).toEqual([{ label: "Номер отчёта", value: "2632407538" }, { label: "Дата выдачи", value: "02.11.2026" }]);
    expect(inspection?.comment).toBe("좌)프론트휀더 조정");
    expect(inspection?.checks).toEqual([
      { section: "Двигатель", label: "Утечка масла — клапанная крышка", value: "Отсутствует", tone: "good" },
      { section: "Коробка передач", label: "Утечка масла", value: "Незначительная", tone: "warning" }
    ]);
  });

  test("не смешивает осмотр со страховой историей и историей объявления", () => {
    const { inspection, history } = parseInspectionPage(load(damaged));
    expect(inspection?.flags.map((r) => r.label)).toEqual([
      "Состояние VIN / номерной маркировки", "Отзывные кампании", "Отметка о серьёзной аварии", "Отметка о простом ремонте", "Признаки затопления"
    ]);
    expect(history.rows.map((r) => r.label)).toEqual([
      "Автомобиль отмечен как диагностированный Encar", "Записи о залоге / обременении", "Записи о полной гибели из-за затопления"
    ]);
    expect(history.insuranceCases).toEqual([{ date: "08.05.2025", type: "Повреждение этого автомобиля",
      partsKrw: 315_000, laborKrw: 189_680, paintKrw: 324_209, totalKrw: 828_889, payoutKrw: 900_000 }]);
  });

  test("отчёт без отметок — структурированный и пустой, а не «нет данных»", () => {
    const html = section("Схема состояния кузова", `<div class="inspection-body">
      <div class="inspection-body__summary inspection-body__summary--normal"><strong>Ремонт кузовных элементов не отмечен</strong></div>
      <div class="image-wrapper inspection-body__scheme-wrap"><div class="inspection-body__scheme"></div></div>${meta}</div>`);
    const { inspection } = parseInspectionPage(load(html));
    expect(inspection).toMatchObject({ format: "structured", parts: [] });
  });

  test("только скан отчёта — без выдуманной схемы, со ссылками на страницы оригинала", () => {
    const html = section("Схема состояния кузова", `<div class="inspection-body">
      <div class="inspection-body__summary inspection-body__summary--document"><strong>Доступен скан отчёта осмотра</strong></div>
      <section class="inspection-body__documents"><h4>Сканы</h4><div class="inspection-body__gallery">
        <a href="https://trust-encar.ru/images/carsdata/cars/inspection/1.jpg" class="inspection-body__document"><figure><img alt=""><figcaption>Детальное состояние автомобиля</figcaption></figure></a>
        <a href="https://evil.example/2.jpg" class="inspection-body__document"><figure><figcaption>чужой адрес</figcaption></figure></a>
      </div></section></div>`);
    const { inspection } = parseInspectionPage(load(html));
    expect(inspection?.format).toBe("document");
    expect(inspection?.parts).toEqual([]);
    expect(inspection?.documents).toEqual([{ url: "https://trust-encar.ru/images/carsdata/cars/inspection/1.jpg", caption: "Детальное состояние автомобиля" }]);
  });

  test("нет отчёта осмотра — inspection = null, история остаётся", () => {
    const { inspection, history } = parseInspectionPage(load(history_only()));
    expect(inspection).toBeNull();
    expect(history.insuranceCases).toHaveLength(1);
  });
});

function history_only() { return history; }

describe("расположение детали на схеме", () => {
  test.each([
    ["P011", "Капот", "hood"],
    ["P021", "Переднее крыло (левое)", "fender-l"],
    ["P032", "Передняя дверь (правая)", "door-fr"],
    ["P062", "Заднее крыло (правое)", "quarter-r"],
    ["P051", "Опора радиатора (болтовые детали)", "radiator"],
    ["P181", "Задняя панель", "rear-panel"],
    ["P141", "Стойка A (левая)", "pillar-a-l"]
  ])("%s %s → %s", (code, name, zone) => {
    expect(zoneOf(code, name)).toBe(zone);
  });

  test("не угадывает сторону и не верит коду, если название с ним не сходится", () => {
    expect(zoneOf("P021", "Переднее крыло")).toBeNull();
    expect(zoneOf("P031", "Дверь (левая)")).toBeNull();
    expect(zoneOf("P011", "Переднее крыло (левое)")).toBeNull();
    expect(zoneOf(null, "Капот")).toBeNull();
  });
});
