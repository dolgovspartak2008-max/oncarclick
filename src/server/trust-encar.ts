import { unstable_cache } from "next/cache";
import type { CatalogFilters } from "@/domain/catalog";
import {
  buildTrustEncarSearchBody,
  normalizeTrustEncarRecords,
  parseTrustEncarBootstrap,
  parseTrustEncarGenerations,
  parseTrustEncarTrimsFacet,
  resolveYearRange,
  sameText,
  uniqueSorted,
  type CatalogCar,
  type TrustEncarBootstrap,
  type TrustEncarGeneration
} from "@/domain/trust-encar";

export const CATALOG_REVALIDATE_SECONDS = 86_400;
export const CATALOG_CACHE_TAG = "trust-encar-catalog";
/** Сколько страниц источника просматриваем максимум, когда фильтруем по комплектации. */
export const MAX_SCAN_PAGES = 15;

export type CatalogResult = {
  items: CatalogCar[];
  total: number;
  /** true — число найдено по части выдачи (для комплектаций в очень больших моделях). */
  approximate: boolean;
  makes: string[];
  models: string[];
  generations: TrustEncarGeneration[];
};

export type CountResult = { total: number; approximate: boolean };

export type OptionsResult = {
  makes: string[];
  models: string[];
  generations: TrustEncarGeneration[];
  trims: string[];
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type Context = {
  fetcher: Fetcher;
  bootstrap: TrustEncarBootstrap;
  makeId?: string;
  modelId?: string;
};

const JSON_POST = { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" };

function readModels(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const models = (value as { facets?: { models?: unknown } }).facets?.models;
  if (!Array.isArray(models)) return [];
  return models.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as { name?: unknown; label?: unknown };
    const name = String(raw.name || raw.label || "").trim();
    return name ? [name] : [];
  });
}

function post(ctx: Context, body: URLSearchParams) {
  return ctx.fetcher(ctx.bootstrap.ajaxUrl, { method: "POST", headers: JSON_POST, body, signal: AbortSignal.timeout(10_000) });
}

async function openContext(filters: Pick<CatalogFilters, "make" | "model">, fetcher: Fetcher): Promise<Context> {
  const pageResponse = await fetcher("https://trust-encar.ru/catalog/", {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
    signal: AbortSignal.timeout(10_000)
  } as RequestInit);
  if (!pageResponse.ok) throw new Error(`Trust Encar вернул ${pageResponse.status}`);
  const bootstrap = parseTrustEncarBootstrap(await pageResponse.text());
  const ctx: Context = { fetcher, bootstrap, makeId: bootstrap.makes.find((item) => sameText(item.name, filters.make))?.id };

  if (filters.model && filters.make) {
    const lookupResponse = await post(ctx, new URLSearchParams({
      action: "te_catalog_lookup_ids_db", nonce: bootstrap.nonce, marka: filters.make, model: filters.model
    }));
    if (!lookupResponse.ok) throw new Error(`Trust Encar не распознал модель: ${lookupResponse.status}`);
    const lookup = await lookupResponse.json() as { model_id?: unknown };
    ctx.modelId = String(lookup.model_id || "") || undefined;
  }
  return ctx;
}

async function loadFacets(ctx: Context): Promise<unknown> {
  if (!ctx.makeId) return null;
  const response = await post(ctx, new URLSearchParams({
    action: "ajax_facets_state_db", nonce: ctx.bootstrap.nonce, marka_id: ctx.makeId, ...(ctx.modelId ? { model_id: ctx.modelId } : {})
  }));
  return response.ok ? response.json() : null;
}

async function searchPage(ctx: Context, filters: CatalogFilters, upstreamPage: number): Promise<unknown[]> {
  const response = await post(ctx, buildTrustEncarSearchBody("search_db", filters, ctx.bootstrap, ctx.modelId, upstreamPage));
  if (!response.ok) throw new Error("Trust Encar временно не отдаёт каталог");
  const records: unknown = await response.json();
  if (!Array.isArray(records)) throw new Error("Trust Encar вернул некорректный каталог");
  return records;
}

async function countMatches(ctx: Context, filters: CatalogFilters): Promise<number> {
  const response = await post(ctx, buildTrustEncarSearchBody("ajax_catalog_count_db", filters, ctx.bootstrap, ctx.modelId));
  if (!response.ok) throw new Error("Trust Encar временно не отдаёт каталог");
  const count = await response.json() as { status?: unknown; total?: unknown };
  return count.status === "success" && Number.isFinite(Number(count.total)) ? Number(count.total) : ctx.bootstrap.total;
}

/** Просматривает выдачу постранично — нужно для фильтра по комплектации, которого нет у источника. */
async function scanRecords(ctx: Context, filters: CatalogFilters) {
  const [first, total] = await Promise.all([searchPage(ctx, filters, 0), countMatches(ctx, filters)]);
  const pageSize = Math.max(1, first.length);
  const pages = Math.min(MAX_SCAN_PAGES, Math.ceil(total / pageSize));
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
    searchPage(ctx, filters, index + 1).catch(() => [] as unknown[])));
  return { records: first.concat(...rest), complete: pages * pageSize >= total };
}

type Resolved = { ctx: Context; effective: CatalogFilters; models: string[]; generations: TrustEncarGeneration[]; trimsFacet: string[]; empty: boolean };

async function resolve(filters: CatalogFilters, fetcher: Fetcher): Promise<Resolved> {
  const ctx = await openContext(filters, fetcher);
  const facets = await loadFacets(ctx);
  const generations = ctx.modelId ? parseTrustEncarGenerations(facets) : [];
  const generation = filters.generation ? generations.find((item) => sameText(item.name, filters.generation)) : undefined;
  const range = resolveYearRange(filters, generation);
  return {
    ctx,
    effective: { ...filters, ...(range ?? {}) },
    models: readModels(facets),
    generations,
    trimsFacet: ctx.modelId ? parseTrustEncarTrimsFacet(facets) : [],
    empty: range === null
  };
}

export async function fetchLiveCatalog(filters: CatalogFilters, fetcher: Fetcher = fetch, now = new Date()): Promise<CatalogResult> {
  const { ctx, effective, models, generations, empty } = await resolve(filters, fetcher);
  const base = { makes: ctx.bootstrap.makes.map((item) => item.name), models, generations };
  if (empty) return { ...base, items: [], total: 0, approximate: false };

  if (filters.trim) {
    const { records, complete } = await scanRecords(ctx, effective);
    const matched = normalizeTrustEncarRecords(records, now).filter((car) => sameText(car.trim, filters.trim));
    const start = (filters.page - 1) * filters.limit;
    return { ...base, items: matched.slice(start, start + filters.limit), total: matched.length, approximate: !complete };
  }

  const [records, total] = await Promise.all([searchPage(ctx, effective, filters.page - 1), countMatches(ctx, effective)]);
  return { ...base, items: normalizeTrustEncarRecords(records, now).slice(0, filters.limit), total, approximate: false };
}

export async function fetchLiveCount(filters: CatalogFilters, fetcher: Fetcher = fetch): Promise<CountResult> {
  const { ctx, effective, empty } = await resolve(filters, fetcher);
  if (empty) return { total: 0, approximate: false };
  if (filters.trim) {
    const { records, complete } = await scanRecords(ctx, effective);
    const total = normalizeTrustEncarRecords(records).filter((car) => sameText(car.trim, filters.trim)).length;
    return { total, approximate: !complete };
  }
  return { total: await countMatches(ctx, effective), approximate: false };
}

export async function fetchLiveOptions(filters: CatalogFilters, fetcher: Fetcher = fetch): Promise<OptionsResult> {
  const { ctx, effective, models, generations, trimsFacet, empty } = await resolve(filters, fetcher);
  const result = { makes: ctx.bootstrap.makes.map((item) => item.name), models, generations, trims: trimsFacet };
  if (!ctx.modelId || trimsFacet.length || empty) return result;
  // Комплектации собираем из реальных машин выбранной модели (и поколения).
  const scope: CatalogFilters = { page: 1, limit: 24, sort: "newest", make: filters.make, model: filters.model,
    yearFrom: effective.yearFrom, yearTo: effective.yearTo };
  const { records } = await scanRecords(ctx, scope);
  return { ...result, trims: uniqueSorted(normalizeTrustEncarRecords(records).map((car) => car.trim)) };
}

const cacheOptions = { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] };
const cachedCatalog = unstable_cache(
  async (serialized: string) => fetchLiveCatalog(JSON.parse(serialized) as CatalogFilters),
  ["trust-encar-catalog-v2"], cacheOptions
);
const cachedCount = unstable_cache(
  async (serialized: string) => fetchLiveCount(JSON.parse(serialized) as CatalogFilters),
  ["trust-encar-count-v1"], cacheOptions
);
const cachedOptions = unstable_cache(
  async (serialized: string) => fetchLiveOptions(JSON.parse(serialized) as CatalogFilters),
  ["trust-encar-options-v1"], cacheOptions
);

export function getCatalog(filters: CatalogFilters) {
  return cachedCatalog(JSON.stringify(filters));
}

export function getCatalogCount(filters: CatalogFilters) {
  // Страница и сортировка на число машин не влияют — общий кеш для всех.
  return cachedCount(JSON.stringify({ ...filters, page: 1, limit: 24, sort: "newest" }));
}

export function getCatalogOptions(filters: Pick<CatalogFilters, "make" | "model" | "generation">) {
  return cachedOptions(JSON.stringify({ page: 1, limit: 24, sort: "newest", make: filters.make, model: filters.model, generation: filters.generation }));
}
