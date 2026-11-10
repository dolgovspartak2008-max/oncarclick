export type CatalogSort = "price-asc" | "price-desc" | "newest" | "mileage";

export type CatalogFilters = {
  page: number;
  limit: number;
  sort: CatalogSort;
  make?: string;
  model?: string;
  engineCc?: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const boundedInteger = (value: string | string[] | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(scalar(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
};
const cleanText = (value: string | string[] | undefined) => scalar(value)?.trim().slice(0, 80) || undefined;

export function parseCatalogParams(params: SearchParams): CatalogFilters {
  const rawSort = scalar(params.sort);
  const sort: CatalogSort = ["price-asc", "price-desc", "newest", "mileage"].includes(rawSort ?? "")
    ? rawSort as CatalogSort
    : "newest";
  const rawEngine = Number(scalar(params.engine));

  return {
    page: boundedInteger(params.page, 1, 1, 5_000),
    limit: boundedInteger(params.limit, 24, 1, 24),
    sort,
    make: cleanText(params.make),
    model: cleanText(params.model),
    engineCc: Number.isFinite(rawEngine) && rawEngine > 0 ? Math.floor(rawEngine) : undefined
  };
}
