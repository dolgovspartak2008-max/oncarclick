/* Избранные автомобили: хранятся в браузере посетителя (localStorage), без регистрации.
   Сохраняем снимок карточки целиком, чтобы страница «Избранное» открывалась мгновенно
   и показывала машину, даже если её уже нет в текущей выдаче каталога. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Favs = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  const KEY = 'oncarclick-favorites-v1';
  const LEGACY_KEY = 'favs2';
  const listeners = [];

  function storage() { try { return root.localStorage || null; } catch (e) { return null; } }
  function read() {
    const s = storage();
    try {
      const list = JSON.parse((s && s.getItem(KEY)) || '[]');
      return Array.isArray(list) ? list.filter(function (car) { return car && car.id; }) : [];
    } catch (e) { return []; }
  }
  function write(list) {
    const s = storage();
    try { if (s) s.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    listeners.forEach(function (fn) { try { fn(list); } catch (e) {} });
    paintCounters(list.length);
  }

  // Старый формат хранил только id — такие машины «дозаполняются», когда попадаются в каталоге.
  function legacyIds() {
    const s = storage();
    try { return new Set(JSON.parse((s && s.getItem(LEGACY_KEY)) || '[]').map(String)); } catch (e) { return new Set(); }
  }

  const SNAPSHOT_FIELDS = ['id', 'name', 'trim', 'generation', 'year', 'km', 'engine', 'fuel', 'price', 'basePrice', 'fee', 'photo'];
  function snapshot(car) {
    const out = { addedAt: Date.now() };
    SNAPSHOT_FIELDS.forEach(function (key) { if (car[key] !== undefined) out[key] = car[key]; });
    out.id = String(out.id);
    return out;
  }

  function list() { return read().sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); }); }
  function has(id) { id = String(id); return read().some(function (car) { return car.id === id; }) || legacyIds().has(id); }
  function add(car) {
    const items = read().filter(function (item) { return item.id !== String(car.id); });
    items.push(snapshot(car));
    write(items);
  }
  function remove(id) {
    id = String(id);
    const legacy = legacyIds();
    if (legacy.delete(id)) { const s = storage(); try { s && s.setItem(LEGACY_KEY, JSON.stringify(Array.from(legacy))); } catch (e) {} }
    write(read().filter(function (car) { return car.id !== id; }));
  }
  /** Переключает сердечко. Возвращает true, если машина теперь в избранном. */
  function toggle(car) {
    if (has(car.id)) { remove(car.id); return false; }
    add(car); return true;
  }
  /** Обновляет сохранённые снимки свежими данными каталога (цена, фото). */
  function refresh(cars) {
    const byId = new Map(cars.map(function (car) { return [String(car.id), car]; }));
    const legacy = legacyIds();
    let changed = false;
    const items = read().map(function (item) {
      const fresh = byId.get(item.id);
      if (!fresh) return item;
      changed = true;
      return Object.assign(snapshot(fresh), { addedAt: item.addedAt });
    });
    legacy.forEach(function (id) {
      if (byId.has(id) && !items.some(function (item) { return item.id === id; })) { items.push(snapshot(byId.get(id))); changed = true; }
    });
    if (changed) write(items);
  }
  function count() { return read().length; }
  function onChange(fn) { listeners.push(fn); }

  function paintCounters(n) {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-fav-count]').forEach(function (el) {
      el.textContent = n > 99 ? '99+' : String(n);
      el.hidden = !n;
    });
  }
  if (typeof document !== 'undefined') {
    const start = function () { paintCounters(count()); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    // Синхронизация между вкладками
    if (root.addEventListener) root.addEventListener('storage', function (event) { if (event.key === KEY) paintCounters(count()); });
  }

  return { list, has, add, remove, toggle, refresh, count, onChange, KEY };
});
