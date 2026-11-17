import type { CheerioAPI } from "cheerio";

/**
 * Технический лист автомобиля — отчёт о техническом осмотре Encar (성능·상태점검기록부).
 *
 * Источник — страница машины trust-encar.ru/auto/{id}/, которую сайт и так загружает для карточки
 * (фото, характеристики). Trust Encar публикует там данные отчёта INSPECTION с Encar в структурированном виде:
 * код детали Encar (P011…), её название и коды отметок (X, W, C, A, U, T). Ничего не дорисовываем:
 * отмечено только то, что есть в отчёте. Нет отчёта — нет технического листа.
 *
 * Страховая история — отдельный источник (база страховых случаев), поэтому она лежит в CarHistory,
 * а не в CarInspection.
 */

export type StatusKind = "replacement" | "repair" | "cut-weld" | "corrosion" | "scratch" | "dent" | "damage" | "paint" | "other";

export type InspectionStatus = {
  /** Код отметки как в отчёте Encar: X, W, C, A, U, T… */
  code: string;
  /** Пояснение на русском. */
  label: string;
  kind: StatusKind;
};

export type PartGroup = "outer" | "outer-fixed" | "frame" | "other";

export type InspectionPart = {
  /** Код детали Encar (P011 и т. д.), если указан. */
  code: string | null;
  name: string;
  group: PartGroup;
  /** Заголовок группы из отчёта: «Съёмные внешние панели», «Основной каркас — группа A»… */
  groupTitle: string;
  /** Элемент схемы кузова (public/js/car-inspection.js) или null, если место детали однозначно не определить. */
  zone: string | null;
  statuses: InspectionStatus[];
};

export type Tone = "good" | "bad" | "warning" | "neutral";
export type InspectionRow = { section: string | null; label: string; value: string; tone: Tone };

export type CarInspection = {
  /**
   * structured — есть структурированная схема кузова (в т. ч. без единой отметки);
   * document — Encar хранит только сканы бумажного отчёта, схемы нет.
   */
  format: "structured" | "document";
  /** Отчёт отмечает аварию (사고) / простой ремонт (단순수리). null — в отчёте нет такой строки. */
  accident: boolean | null;
  simpleRepair: boolean | null;
  /** Только детали с отметками. Остальные элементы отчёта — без отметок. */
  parts: InspectionPart[];
  /** Номер отчёта, дата выдачи, срок действия, организация… */
  meta: Array<{ label: string; value: string }>;
  /** Пробег на момент осмотра, км. */
  mileageKm: number | null;
  issuedAt: string | null;
  /** Отметки отчёта: VIN, тюнинг, отзывные кампании, затопление… */
  flags: InspectionRow[];
  /** Техническая проверка узлов: двигатель, коробка, утечки жидкостей, тормоза, электрика… */
  checks: InspectionRow[];
  /** Сканы оригинального отчёта (для format = document). */
  documents: Array<{ url: string; caption: string }>;
};

export type InsuranceCase = {
  date: string;
  type: string;
  partsKrw: number | null;
  laborKrw: number | null;
  paintKrw: number | null;
  totalKrw: number | null;
  payoutKrw: number | null;
};

/** История автомобиля из базы Encar и страховых компаний — отдельно от технического осмотра. */
export type CarHistory = {
  rows: InspectionRow[];
  insuranceCases: InsuranceCase[];
};

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

/**
 * Обозначения Encar (성능점검): X 교환 — замена, W 판금/용접 — рихтовка / сварка, C 부식 — коррозия,
 * A 흠집 — царапина, U 요철 — неровность (вмятина), T 손상 — повреждение.
 */
export const STATUS_LABELS: Record<string, { label: string; kind: StatusKind }> = {
  X: { label: "Замена", kind: "replacement" },
  W: { label: "Ремонт: рихтовка / сварка", kind: "repair" },
  WC: { label: "Сварка / резка", kind: "cut-weld" },
  C: { label: "Коррозия", kind: "corrosion" },
  A: { label: "Царапина", kind: "scratch" },
  U: { label: "Неровность / вмятина", kind: "dent" },
  T: { label: "Повреждение", kind: "damage" }
};

const KIND_BY_CLASS: Record<string, StatusKind> = {
  replacement: "replacement", repair: "repair", "cut-weld": "cut-weld", corrosion: "corrosion",
  scratch: "scratch", dent: "dent", damage: "damage", paint: "paint"
};

function statusOf(code: string, sourceLabel: string, className: string): InspectionStatus {
  const known = STATUS_LABELS[code];
  const byClass = KIND_BY_CLASS[className.match(/inspection-body__status--([a-z-]+)/)?.[1] ?? ""];
  // Покраску определяем только по прямой отметке источника — не по косвенным признакам.
  const paint = /окрас|покрас|도색/i.test(sourceLabel);
  const kind: StatusKind = known?.kind ?? (paint ? "paint" : byClass ?? "other");
  return { code, label: known?.label ?? (sourceLabel || code), kind };
}

/* ---------- Расположение деталей на схеме ---------- */

/**
 * Номер пункта в бланке осмотра → элемент кузова. Код детали Encar: P + номер пункта (2 цифры) + позиция.
 * 01 капот, 02 переднее крыло, 03 дверь, 04 крышка багажника, 05 рамка радиатора, 06 заднее крыло,
 * 07 крыша, 08 порог, 09 передняя панель, 10 поперечина, 11 брызговик, 12 лонжерон, 13 колёсная арка,
 * 14 стойка, 15 моторный щит, 16 панель пола, 17 пол багажника, 18 задняя панель, 19 полка багажника.
 */
const FAMILY_BY_ITEM: Record<string, string> = {
  "01": "hood", "02": "fender", "03": "door", "04": "trunk", "05": "radiator", "06": "quarter",
  "07": "roof", "08": "sill", "09": "front-panel", "10": "cross-member", "11": "inside-panel",
  "12": "side-member", "13": "wheel-house", "14": "pillar", "15": "dash", "16": "floor",
  "17": "trunk-floor", "18": "rear-panel", "19": "package-tray"
};

/** Название детали должно подтверждать номер пункта — иначе деталь не ставим на схему (только в список). */
const FAMILY_NAME: Record<string, RegExp> = {
  hood: /капот/i,
  fender: /крыл/i,
  door: /двер/i,
  trunk: /багаж|задн(?:яя|ей) двер|пятая дверь/i,
  radiator: /радиатор/i,
  quarter: /крыл|боковин/i,
  roof: /крыш(?!к)/i,
  sill: /порог/i,
  "front-panel": /передн\S* панел|панель передн|телевизор/i,
  "cross-member": /поперечин|кросс/i,
  "inside-panel": /внутрен|брызговик|чашк/i,
  "side-member": /лонжерон/i,
  "wheel-house": /арк|колёс|колес/i,
  pillar: /стойк/i,
  dash: /щит|перегородк/i,
  floor: /(?:^|[^а-яё])пола?(?![а-яё])|днищ/i,
  "trunk-floor": /пол\S* багаж|багажн\S* пол/i,
  "rear-panel": /задн\S* панел|панель задн/i,
  "package-tray": /полк/i
};

const NEEDS_SIDE = new Set(["fender", "quarter", "sill", "inside-panel", "side-member", "door", "wheel-house", "pillar"]);
const NEEDS_POSITION = new Set(["door", "wheel-house"]);

export function zoneOf(code: string | null, name: string): string | null {
  const item = code?.match(/^P(\d{2})\d$/i)?.[1];
  const family = item ? FAMILY_BY_ITEM[item] : undefined;
  if (!family || !FAMILY_NAME[family].test(name)) return null;

  const left = /лев|слева/i.test(name);
  const right = /прав|справа/i.test(name);
  const side = left === right ? null : left ? "l" : "r";
  const front = /передн/i.test(name);
  const rear = /задн/i.test(name);
  const position = front === rear ? null : front ? "f" : "r";

  if (NEEDS_SIDE.has(family) && !side) return null;
  if (NEEDS_POSITION.has(family) && !position) return null;
  if (family === "pillar") {
    const letter = name.match(/(?:^|[\s(«"-])([ABCАВС])(?=$|[\s)»",-])/)?.[1]
      ?.replace("А", "A").replace("В", "B").replace("С", "C").toLowerCase();
    return letter ? `pillar-${letter}-${side}` : null;
  }
  if (family === "door" || family === "wheel-house") return `${family}-${position}${side}`;
  if (NEEDS_SIDE.has(family)) return `${family}-${side}`;
  return family;
}

/* ---------- Таблицы «оценка / статус» ---------- */

const toneOf = (className: string | undefined): Tone => {
  const tone = className?.match(/txt_state--(good|bad|warning|neutral)/)?.[1];
  return (tone as Tone | undefined) ?? "neutral";
};

function readRows($: CheerioAPI, block: NonNullable<ReturnType<typeof sectionByTitle>>): InspectionRow[] {
  const rows: InspectionRow[] = [];
  let section: string | null = null;
  block.find("tr").each((_, element) => {
    const cells = $(element).children("th, td").toArray();
    const state = $(element).find(".txt_state").first();
    if (!state.length) return; // строка заголовков
    const texts = cells.map((cell) => clean($(cell).text()));
    let label = "";
    if (cells.length >= 3) { section = texts[0] || section; label = texts[1]; }
    else label = texts[0];
    const value = clean(state.text());
    if (label && value) rows.push({ section: cells.length >= 3 || section ? section : null, label, value, tone: toneOf(state.attr("class")) });
  });
  return rows;
}

/**
 * Строки, которые берутся из самого отчёта осмотра. Остальные строки тех же таблиц Trust Encar
 * (аресты, залоги, угон, полная гибель, коммерческое использование, «диагностика Encar») —
 * из истории автомобиля и объявления, их показываем отдельно.
 */
const INSPECTION_FLAG = /инспекц|осмотр|vin|маркировк|тюнинг|изменени|отзывн|особ\S* истори|серьёзн\S* авари|прост\S* ремонт|затоплени|одометр|пробег/i;
const NOT_INSPECTION = /гибел|диагностирован|прямая проверка|доступен отчёт/i;

const krwOf = (value: string) => {
  const match = value.match(/([\d\s]+)\s*₩/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

function readInsuranceCases($: CheerioAPI): InsuranceCase[] {
  return $(".accident-table tr").toArray().flatMap((row) => {
    const cells = $(row).children("td").toArray().map((cell) => clean($(cell).text()));
    if (cells.length < 7 || !/^\d{2}\.\d{2}\.\d{4}$/.test(cells[0])) return [];
    return [{
      date: cells[0], type: cells[1],
      partsKrw: krwOf(cells[2]), laborKrw: krwOf(cells[3]), paintKrw: krwOf(cells[4]),
      totalKrw: krwOf(cells[5]), payoutKrw: krwOf(cells[6])
    }];
  });
}

function sectionByTitle($: CheerioAPI, pattern: RegExp) {
  const found = $(".product-descr").toArray().find((element) => pattern.test(clean($(element).find("h3").first().text())));
  return found ? $(found) : null;
}

const safeDocument = (value: string | undefined) => {
  try {
    const url = new URL(String(value ?? ""), "https://trust-encar.ru");
    if (url.protocol === "https:" && url.hostname === "trust-encar.ru" && /\.(?:jpe?g|png|webp)$/i.test(url.pathname)) return url.toString();
  } catch {}
  return "";
};

const dateOf = (value: string | undefined) => (value && /^\d{2}\.\d{2}\.\d{4}$/.test(value) ? value : null);

/** Отчёт осмотра и история со страницы Trust Encar. Возвращает inspection = null, если отчёта нет. */
export function parseInspectionPage($: CheerioAPI): { inspection: CarInspection | null; history: CarHistory } {
  const rowsOf = (pattern: RegExp) => {
    const found = sectionByTitle($, pattern);
    return found ? readRows($, found) : [];
  };
  const summaryRows = [...rowsOf(/данные проверки/i), ...rowsOf(/отметки об авари/i)];
  const flags = summaryRows.filter((row) => INSPECTION_FLAG.test(row.label) && !NOT_INSPECTION.test(row.label));
  const historyRows = summaryRows.filter((row) => !flags.includes(row));
  const history: CarHistory = { rows: historyRows, insuranceCases: readInsuranceCases($) };

  const body = $(".inspection-body").first();
  const summary = body.find(".inspection-body__summary").first();
  if (!body.length || !summary.length) return { inspection: null, history };

  const parts: InspectionPart[] = [];
  body.find(".inspection-body__group").each((_, groupElement) => {
    const group = $(groupElement);
    const kind = (group.attr("class") ?? "").match(/inspection-body__group--([a-z-]+)/)?.[1] ?? "";
    const groupKey: PartGroup = kind === "outer" ? "outer" : kind === "outer-fixed" ? "outer-fixed" : /frame/.test(kind) ? "frame" : "other";
    const groupTitle = clean(group.find("h4").first().text());
    group.find(".inspection-body__part").each((__, partElement) => {
      const part = $(partElement);
      const name = clean(part.find(".inspection-body__part-name strong").first().text());
      const code = clean(part.find(".inspection-body__part-name small").first().text()).match(/\bP\d{3}\b/i)?.[0]?.toUpperCase() ?? null;
      const statuses = part.find(".inspection-body__status").toArray().flatMap((statusElement) => {
        const status = $(statusElement);
        const statusCode = clean(status.find("small").last().text()).replace(/^код\s*/i, "").toUpperCase();
        const labelNode = status.children("span").last().clone();
        labelNode.find("small").remove();
        const sourceLabel = clean(labelNode.text());
        return statusCode ? [statusOf(statusCode, sourceLabel, status.attr("class") ?? "")] : [];
      });
      if (!name || !statuses.length) return;
      parts.push({ code, name, group: groupKey, groupTitle, zone: zoneOf(code, name), statuses });
    });
  });

  const meta = body.find(".inspection-body__meta > div").toArray().flatMap((element) => {
    const label = clean($(element).find("dt").first().text());
    const value = clean($(element).find("dd").first().text());
    // Номер предложения, продавец и организация-инспектор покупателю не нужны.
    return label && value && !/предложени|продав|организаци|инспектор/i.test(label) ? [{ label, value }] : [];
  });
  const metaValue = (pattern: RegExp) => meta.find((item) => pattern.test(item.label))?.value;

  const mileageRow = flags.find((row) => /пробег/i.test(row.label));
  const mileage = Number((mileageRow?.value ?? "").replace(/[^\d]/g, ""));
  const flagValue = (pattern: RegExp) => {
    const row = flags.find((item) => pattern.test(item.label));
    if (!row) return null;
    return /^(есть|да)(?![а-яё])/i.test(row.value) ? true : /^(нет|отсутств)/i.test(row.value) ? false : null;
  };

  const documents = body.find(".inspection-body__documents a").toArray().flatMap((element) => {
    const url = safeDocument($(element).attr("href"));
    return url ? [{ url, caption: clean($(element).find("figcaption").text()) || "Страница отчёта" }] : [];
  });
  const structured = !/summary--document/.test(summary.attr("class") ?? "");

  return {
    inspection: {
      format: structured ? "structured" : "document",
      accident: flagValue(/серьёзн\S* авари/i),
      simpleRepair: flagValue(/прост\S* ремонт/i),
      parts,
      meta,
      mileageKm: Number.isFinite(mileage) && mileage > 0 ? mileage : null,
      // «Дата регистрации отчёта» — дата публикации в объявлении, а не дата осмотра: её не подставляем.
      issuedAt: dateOf(metaValue(/дата выдачи/i)),
      flags: flags.filter((row) => !/пробег/i.test(row.label)),
      checks: rowsOf(/техническая проверка/i),
      documents
    },
    history
  };
}
