import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, test, vi } from "vitest";

// Run the actual browser script with only the DOM surface needed by catalogue loading.
function catalog() {
  const elements = new Map<string, ReturnType<typeof element>>();
  function element() {
    return { value: "newest", textContent: "", innerHTML: "", hidden: false, disabled: false,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener: vi.fn(), querySelector: select, querySelectorAll: () => [],
      closest: () => ({ classList: { toggle() {} } }) };
  }
  function select(key: string) {
    if (!elements.has(key)) elements.set(key, element());
    return elements.get(key)!;
  }
  const requests: { url: string; resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
  const fetch = vi.fn((url: string) => new Promise<Response>((resolve, reject) => requests.push({ url, resolve, reject })));
  const context = vm.createContext({
    window: { Favs: { refresh() {} }, addEventListener() {} },
    document: { querySelector: select, querySelectorAll: () => [], addEventListener() {} },
    location: { search: "", pathname: "/catalog.html" }, history: {},
    localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null },
    fetch, AbortController, setTimeout, clearTimeout, URLSearchParams, console
  });
  vm.runInContext(readFileSync("public/js/catalog-model.js", "utf8"), context);
  vm.runInContext(readFileSync("public/js/catalog.js", "utf8"), context);
  const changeSort = (value: string) => {
    const sort = select("#sort");
    sort.value = value;
    const handler = sort.addEventListener.mock.calls.find(([event]) => event === "change")![1];
    handler();
  };
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const result = (total: number, hasMore = false) => Response.json({ items: [], total, hasMore, makes: [] });
  return { requests, changeSort, settle, result, select };
}

describe("catalogue request ordering", () => {
  test("latest selection wins even when an older request finishes last", async () => {
    const c = catalog();
    c.changeSort("price-asc");
    expect(c.requests).toHaveLength(2);
    c.requests[1].resolve(c.result(2));
    await c.settle();
    c.requests[0].resolve(c.result(100));
    await c.settle();
    expect(c.select("#count").textContent).toContain("2 ");
    expect(c.select("#count").textContent).not.toContain("100");
  });

  test("a failed replacement clears the previous count and load-more button", async () => {
    const c = catalog();
    c.requests[0].resolve(c.result(100, true));
    await c.settle();
    c.changeSort("price-asc");
    c.requests[1].resolve(new Response("unavailable", { status: 502 }));
    await c.settle();
    expect(c.select("#count").textContent).toBe("");
    expect(c.select("#loadMore").hidden).toBe(true);
  });
});
