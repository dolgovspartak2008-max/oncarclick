/* Живой каталог Trust Encar: фильтры, пагинация, избранное и локальная страховочная копия. */
(function () {
  const Model = window.CatalogModel;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const grid = $('#cars'), form = $('#filters'), count = $('#count');
  const status = $('#catalogStatus'), loadMore = $('#loadMore');
  const sel = { brand: $('#fBrand'), model: $('#fModel'), engine: $('#fEngine') };
  const sortSel = $('#sort'), resetBtn = $('#fReset');
  const CACHE_KEY = 'oncarclick-catalog-cache-v1';
  let cars = [], page = 1, total = 0, hasMore = false, loading = false;
  let lastBrand = '';

  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  let favs;
  try { favs = new Set(JSON.parse(safeGet('favs2') || '[]').map(String)); } catch (e) { favs = new Set(); }
  const fmt = (number) => Number(number).toLocaleString('ru-RU');
  const filters = () => ({ brand: sel.brand.value, model: sel.model.value, engine: sel.engine.value, sort: sortSel.value });

  function fillSelect(select, values, emptyLabel) {
    const current = select.value;
    const unique = Array.from(new Set(values.filter(Boolean))).sort(function (a, b) { return String(a).localeCompare(String(b), 'ru', { numeric: true }); });
    select.replaceChildren(new Option(emptyLabel, ''));
    unique.forEach(function (value) { select.add(new Option(String(value), String(value))); });
    if (unique.map(String).includes(current)) select.value = current;
  }

  function updateFilters(data, append) {
    if (!append) {
      fillSelect(sel.brand, data.makes || [], 'Все марки');
      if (sel.brand.value) fillSelect(sel.model, data.models || [], 'Все модели');
      else fillSelect(sel.model, [], 'Все модели');
    }
    const engines = Model.engineBuckets(cars.map(function (car) { return car.engine; }));
    const current = sel.engine.value;
    sel.engine.replaceChildren(new Option('Любой', ''));
    engines.forEach(function (engine) {
      sel.engine.add(new Option(Model.engineLabel(engine), String(engine)));
    });
    if (Array.from(sel.engine.options).some(function (option) { return option.value === current; })) sel.engine.value = current;
    resetBtn.hidden = !(sel.brand.value || sel.model.value || sel.engine.value);
    lastBrand = sel.brand.value;
  }

  function cardMarkup(car) {
    const name = Model.escapeHtml(car.name);
    const trim = car.trim ? ' · ' + Model.escapeHtml(car.trim) : '';
    const photo = car.photo || 'assets/img/catalog-car.webp';
    const pressed = favs.has(car.id);
    return `
      <article class="car">
        <div class="car__img">
          <img class="car__photo" src="${Model.escapeHtml(photo)}" alt="${name}" loading="lazy" decoding="async">
          <span class="badge">Корея</span>
          <button class="fav${pressed ? ' is-on' : ''}" type="button" data-fav="${Model.escapeHtml(car.id)}" aria-pressed="${pressed}" aria-label="В избранное"><svg class="icon"><use href="#i-heart"/></svg></button>
        </div>
        <div class="car__body">
          <h3 class="car__name">${name}</h3>
          <p class="car__meta">${car.year || 'Год не указан'} · ${fmt(car.km)} км · ${Model.engineLabel(car.engine)}${trim}</p>
          <p class="car__price">${car.price ? fmt(car.price) + ' ₽<small>до Владивостока</small>' : 'Цена по запросу'}</p>
        </div>
        <a class="car__link" href="index.html#contacts" aria-label="Узнать про ${name}" data-car="${name}, ${car.year || ''}"></a>
      </article>`;
  }

  function render() {
    count.textContent = total ? `${fmt(total)} ${Model.plural(total, 'автомобиль', 'автомобиля', 'автомобилей')}` : '';
    grid.innerHTML = cars.length ? cars.map(cardMarkup).join('') : '<p class="empty">По выбранным параметрам ничего не найдено.</p>';
    loadMore.hidden = !hasMore;
  }

  function readCache(url) {
    try {
      const cached = JSON.parse(safeGet(CACHE_KEY) || 'null');
      return cached && cached.url === url ? cached.data : null;
    } catch (e) { return null; }
  }

  async function load(append) {
    if (loading) return;
    loading = true;
    const targetPage = append ? page + 1 : 1;
    const url = Model.buildCatalogUrl(filters(), targetPage);
    status.textContent = append ? 'Загружаем ещё автомобили…' : 'Обновляем каталог…';
    loadMore.disabled = true;
    if (!append) grid.classList.add('is-loading');
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Источник временно недоступен');
      const data = await response.json();
      safeSet(CACHE_KEY, JSON.stringify({ url: url, data: data, savedAt: Date.now() }));
      const nextCars = (data.items || []).map(Model.normalizeCar).filter(function (car) { return car.id && car.name; });
      cars = append ? cars.concat(nextCars) : nextCars;
      page = targetPage;
      total = Number(data.total) || cars.length;
      hasMore = Boolean(data.hasMore);
      updateFilters(data, append);
      status.textContent = 'Каталог обновляется автоматически один раз в сутки.';
      render();
    } catch (error) {
      const cached = !append && readCache(url);
      if (cached) {
        cars = (cached.items || []).map(Model.normalizeCar).filter(function (car) { return car.id && car.name; });
        total = Number(cached.total) || cars.length;
        hasMore = Boolean(cached.hasMore);
        updateFilters(cached, false);
        status.textContent = 'Источник временно недоступен — показана последняя сохранённая версия.';
        render();
      } else {
        status.textContent = 'Не удалось загрузить каталог. Попробуйте обновить страницу чуть позже.';
        if (!append) grid.innerHTML = '<p class="empty">Каталог временно недоступен.</p>';
      }
    } finally {
      loading = false;
      loadMore.disabled = false;
      grid.classList.remove('is-loading');
    }
  }

  grid.addEventListener('click', function (event) {
    const favorite = event.target.closest('[data-fav]');
    if (favorite) {
      event.preventDefault();
      const id = String(favorite.dataset.fav);
      favs.has(id) ? favs.delete(id) : favs.add(id);
      favorite.classList.toggle('is-on', favs.has(id));
      favorite.setAttribute('aria-pressed', String(favs.has(id)));
      safeSet('favs2', JSON.stringify(Array.from(favs)));
      if (window.toast) toast(favs.has(id) ? 'Добавлено в избранное' : 'Удалено из избранного');
      return;
    }
    const link = event.target.closest('[data-car]');
    if (link) safeSet('car', link.dataset.car);
  });

  form.addEventListener('change', function (event) {
    if (event.target === sel.brand && sel.brand.value !== lastBrand) sel.model.value = '';
    load(false);
  });
  form.addEventListener('reset', function () { setTimeout(function () { load(false); }); });
  sortSel.addEventListener('change', function () { load(false); });
  loadMore.addEventListener('click', function () { load(true); });

  const query = new URLSearchParams(location.search);
  ['brand', 'model', 'engine'].forEach(function (key) {
    const value = query.get(key);
    if (value) sel[key].add(new Option(value, value, true, true));
  });
  load(false);
})();
