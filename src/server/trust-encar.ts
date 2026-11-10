import { unstable_cache } from "next/cache";
import type { CatalogFilters } from "@/domain/catalog";
import { buildTrustEncarSearchBody, normalizeTrustEncarRecords, parseTrustEncarBootstrap, type CatalogCar } from "@/domain/trust-encar";

export const CATALOG_REVALIDATE_SECONDS = 86_400;
export const CATALOG_CACHE_TAG = "trust-encar-catalog";

type CatalogResult = {
  items: CatalogCar[];
  total: number;
  makes: string[];
  models: string[];
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

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

export async function fetchLiveCatalog(filters: CatalogFilters, fetcher: Fetcher = fetch): Promise<CatalogResult> {
  const pageResponse = await fetcher("https://trust-encar.ru/catalog/", {
    next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
    signal: AbortSignal.timeout(10_000)
  } as RequestInit);
  if (!pageResponse.ok) throw new Error(`Trust Encar вернул ${pageResponse.status}`);
  const bootstrap = parseTrustEncarBootstrap(await pageResponse.text());
  const make = bootstrap.makes.find((item) => item.name.toLowerCase() === filters.make?.toLowerCase());

  let modelId: string | undefined;
  if (filters.model && filters.make) {
    const lookupResponse = await fetcher(bootstrap.ajaxUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: new URLSearchParams({ action: "te_catalog_lookup_ids_db", nonce: bootstrap.nonce, marka: filters.make, model: filters.model }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!lookupResponse.ok) throw new Error(`Trust Encar не распознал модель: ${lookupResponse.status}`);
    const lookup = await lookupResponse.json() as { model_id?: unknown };
    modelId = String(lookup.model_id || "") || undefined;
  }

  const request = (action: "search_db" | "ajax_catalog_count_db") => fetcher(bootstrap.ajaxUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: buildTrustEncarSearchBody(action, filters, bootstrap, modelId),
    signal: AbortSignal.timeout(10_000)
  });
  const modelsRequest = make ? fetcher(bootstrap.ajaxUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams({ action: "ajax_facets_state_db", nonce: bootstrap.nonce, marka_id: make.id, ...(modelId ? { model_id: modelId } : {}) }),
    signal: AbortSignal.timeout(10_000)
  }) : null;

  const [recordsResponse, countResponse, modelsResponse] = await Promise.all([
    request("search_db"),
    request("ajax_catalog_count_db"),
    modelsRequest
  ]);
  if (!recordsResponse.ok || !countResponse.ok) throw new Error("Trust Encar временно не отдаёт каталог");
  const [records, count, facets] = await Promise.all([
    recordsResponse.json(),
    countResponse.json() as Promise<{ status?: unknown; total?: unknown }>,
    modelsResponse?.ok ? modelsResponse.json() : null
  ]);
  if (!Array.isArray(records)) throw new Error("Trust Encar вернул некорректный каталог");
  const total = count.status === "success" && Number.isFinite(Number(count.total)) ? Number(count.total) : bootstrap.total;

  return {
    items: normalizeTrustEncarRecords(records).slice(0, filters.limit),
    total,
    makes: bootstrap.makes.map((item) => item.name),
    models: readModels(facets)
  };
}

const cachedCatalog = unstable_cache(
  async (serializedFilters: string) => fetchLiveCatalog(JSON.parse(serializedFilters) as CatalogFilters),
  ["trust-encar-catalog-v1"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] }
);

export function getCatalog(filters: CatalogFilters) {
  return cachedCatalog(JSON.stringify(filters));
}
