export type CatalogSort = "price-asc" | "price-desc" | "newest" | "mileage";

export type CatalogFilters = {
  page: number;
  limit: number;
  sort: CatalogSort;
  make?: string;
  model?: string;
  generation?: string;
  trim?: string;
  yearFrom?: number;
  yearTo?: number;
  mileageTo?: number;
  engineCc?: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

export const MIN_YEAR = 1990;
export const MILEAGE_STEP_KM = 10_000;
export const MAX_MILEAGE_KM = 300_000;

const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const boundedInteger = (value: string | string[] | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(scalar(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
};
const optionalInteger = (value: string | string[] | undefined, min: number, max: number) => {
  const raw = scalar(value);
  if (raw === undefined || raw.trim() === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : undefined;
};
const cleanText = (value: string | string[] | undefined) => scalar(value)?.trim().slice(0, 120) || undefined;

export function parseCatalogParams(params: SearchParams, now = new Date()): CatalogFilters {
  const rawSort = scalar(params.sort);
  const sort: CatalogSort = ["price-asc", "price-desc", "newest", "mileage"].includes(rawSort ?? "")
    ? rawSort as CatalogSort
    : "newest";
  const rawEngine = Number(scalar(params.engine));
  const maxYear = now.getFullYear() + 1;
  let yearFrom = optionalInteger(params.yearFrom, MIN_YEAR, maxYear);
  let yearTo = optionalInteger(params.yearTo, MIN_YEAR, maxYear);
  if (yearFrom && yearTo && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
  const mileage = optionalInteger(params.mileageTo, MILEAGE_STEP_KM, MAX_MILEAGE_KM);

  return {
    page: boundedInteger(params.page, 1, 1, 5_000),
    limit: boundedInteger(params.limit, 24, 1, 24),
    sort,
    make: cleanText(params.make),
    model: cleanText(params.model),
    generation: cleanText(params.generation),
    trim: cleanText(params.trim),
    yearFrom,
    yearTo,
    mileageTo: mileage ? Math.ceil(mileage / MILEAGE_STEP_KM) * MILEAGE_STEP_KM : undefined,
    engineCc: Number.isFinite(rawEngine) && rawEngine > 0 ? Math.floor(rawEngine) : undefined
  };
}
