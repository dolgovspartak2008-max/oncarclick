/* Живой каталог Trust Encar: подбор по параметрам с живым счётчиком, пагинация,
   избранное и локальная страховочная копия. */
(function () {
  const Model = window.CatalogModel;
  const Favs = window.Favs;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const grid = $('#cars'), form = $('#filters'), count = $('#count');
  const status = $('#catalogStatus'), loadMore = $('#loadMore');
  const sortSel = $('#sort'), resetBtn = $('#fReset'), showBtn = $('#fShow'), showText = $('#fShowText');
  const sheet = $('#sheet'), sheetTitle = $('#sheetTitle'), sheetBody = $('#sheetBody');
  const sheetOk = $('#sheetOk'), sheetClear = $('#sheetClear');
  const CACHE_KEY = 'oncarclick-catalog-cache-v2';
  const NOW_YEAR = new Date().getFullYear();
  const MIN_YEAR = 1990, MILEAGE_STEP = 10000, MILEAGE_MAX = 300000;
  const FIELDS = ['brand', 'model', 'generation', 'trim', 'yearFrom', 'yearTo', 'mileageTo'];
  const CHILDREN = { brand: ['model', 'generation', 'trim'], model: ['generation', 'trim'], generation: ['trim'] };

  let cars = [], page = 1, total = 0, hasMore = false, loading = false;
  let applied = Object.assign(emptyFilters(), Model.filtersFromQuery(location.search));
  let draft = Object.assign({}, applied);
  let makes = [];
  const optionsCache = new Map();
  const rawItems = new Map();

  function emptyFilters() { const out = {}; FIELDS.forEach(function (key) { out[key] = ''; }); return out; }
  function safeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function safeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  const fmt = (number) => Number(number).toLocaleString('ru-RU');
  const carsWord = (n) => Model.plural(n, 'автомобиль', 'автомобиля', 'автомобилей');
  const autoWord = (n) => fmt(n) + ' авто';
  const withSort = (filters) => Object.assign({}, filters, { sort: sortSel.value });
  const sameFilters = (a, b) => FIELDS.every(function (key) { return String(a[key] || '') === String(b[key] || ''); });

  /* ---------- Счётчик «сколько машин найдётся» ---------- */
  const countCache = new Map();
  function fetchCount(filters, signal) {
    const url = Model.buildCountUrl(filters);
    if (countCache.has(url)) return Promise.resolve(countCache.get(url));
    return fetch(url, { headers: { Accept: 'application/json' }, signal: signal }).then(function (response) {
      if (!response.ok) throw new Error('count');
      return response.json();
    }).then(function (data) {
      const result = { total: Number(data.total) || 0, approximate: Boolean(data.approximate) };
      countCache.set(url, result);
      return result;
    });
  }
  function countLabel(result) { return (result.approximate ? 'около ' : '') + autoWord(result.total); }

  function liveCounter(button, label, getFilters) {
    let timer, controller;
    return function update() {
      clearTimeout(timer);
      if (controller) controller.abort();
      button.classList.add('is-counting');
      timer = setTimeout(function () {
        controller = new AbortController();
        fetchCount(getFilters(), controller.signal).then(function (result) {
          label(result);
          button.classList.remove('is-counting');
        }).catch(function (error) {
          if (error.name === 'AbortError') return;
          button.classList.remove('is-counting');
          label(null);
        });
      }, 220);
    };
  }

  const updateShowCount = liveCounter(showBtn, function (result) {
    showText.textContent = result ? 'Показать ' + countLabel(result) : 'Показать автомобили';
    showBtn.disabled = Boolean(result && result.total === 0);
  }, function () { return draft; });

  /* ---------- Варианты для списков (модели, поколения, комплектации) ---------- */
  function loadOptions(filters) {
    const url = Model.buildOptionsUrl(filters);
    if (!optionsCache.has(url)) {
      optionsCache.set(url, fetch(url, { headers: { Accept: 'application/json' } }).then(function (response) {
        if (!response.ok) throw new Error('options');
        return response.json();
      }).catch(function (error) { optionsCache.delete(url); throw error; }));
    }
    return optionsCache.get(url);
  }

  function optionsFor(field) {
    if (field === 'brand') {
      return makes.length ? Promise.resolve(makes.map(function (name) { return { value: name, label: name }; }))
        : loadOptions({}).then(function (data) { makes = data.makes || []; return optionsFor('brand'); });
    }
    if (field === 'model') {
      return loadOptions({ brand: draft.brand }).then(function (data) {
        return (data.models || []).map(function (name) { return { value: name, label: name }; });
      });
    }
    if (field === 'generation') {
      return loadOptions({ brand: draft.brand, model: draft.model }).then(function (data) {
        return (data.generations || []).map(function (g) {
          return { value: g.name, label: g.name, hint: g.minYear + ' – ' + (g.maxYear >= NOW_YEAR ? 'н.в.' : g.maxYear) };
        });
      });
    }
    return loadOptions({ brand: draft.brand, model: draft.model, generation: draft.generation }).then(function (data) {
      return (data.trims || []).map(function (name) { return { value: name, label: name }; });
    });
  }

  /* ---------- Плитки фильтров ---------- */
  const EMPTY = { brand: 'Любая', model: 'Любая', generation: 'Любое', trim: 'Любая', year: 'Любой', mileage: 'Любой' };
  function paintTiles() {
    const values = {
      brand: draft.brand, model: draft.model, generation: draft.generation, trim: draft.trim,
      year: Model.yearLabel(draft.yearFrom, draft.yearTo), mileage: Model.mileageLabel(draft.mileageTo)
    };
    Object.keys(values).forEach(function (key) {
      const el = $('[data-value="' + key + '"]', form);
      el.textContent = values[key] || EMPTY[key];
      el.closest('.ftile').classList.toggle('is-set', Boolean(values[key]));
    });
    $('[data-sheet="model"]', form).disabled = !draft.brand;
    $('[data-sheet="generation"]', form).disabled = !draft.model;
    $('[data-sheet="trim"]', form).disabled = !draft.model;
    resetBtn.hidden = !FIELDS.some(function (key) { return draft[key]; });
    showBtn.classList.toggle('is-dirty', !sameFilters(draft, applied));
  }

  function setDraft(changes) {
    Object.keys(changes).forEach(function (key) {
      if (String(draft[key] || '') !== String(changes[key] || '') && CHILDREN[key]) {
        CHILDREN[key].forEach(function (child) { draft[child] = ''; });
      }
      draft[key] = changes[key];
    });
    paintTiles();
    updateShowCount();
  }

  /* ---------- Нижняя шторка выбора ---------- */
  let sheetState = null, lastFocus = null;
  const TITLES = { brand: 'Марка', model: 'Модель', generation: 'Поколение', trim: 'Комплектация', year: 'Год выпуска', mileage: 'Пробег' };

  const updateSheetCount = liveCounter(sheetOk, function (result) {
    sheetOk.textContent = result ? 'Применить · ' + countLabel(result) : 'Применить';
  }, function () { return Object.assign({}, draft, sheetState ? sheetState.pending : {}); });

  function openSheet(field) {
    lastFocus = document.activeElement;
    sheetState = { field: field, pending: {} };
    sheetTitle.textContent = TITLES[field];
    sheetBody.replaceChildren();
    sheet.dataset.kind = field === 'year' || field === 'mileage' ? field : 'list';
    sheet.hidden = false;
    window.lockPage(true);
    requestAnimationFrame(function () { sheet.classList.add('is-open'); });
    if (field === 'year') renderYear();
    else if (field === 'mileage') renderMileage();
    else renderList(field);
  }

  function closeSheet() {
    if (!sheetState) return;
    sheetState = null;
    sheet.classList.remove('is-open');
    window.lockPage(false);
    setTimeout(function () { if (!sheetState) sheet.hidden = true; }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function renderList(field) {
    sheetOk.parentElement.hidden = true;
    sheetBody.innerHTML = '<p class="sheet__note">Загружаем варианты…</p>';
    optionsFor(field).then(function (options) {
      if (!sheetState || sheetState.field !== field) return;
      const current = draft[field];
      const searchable = options.length > 10;
      sheetBody.innerHTML =
        (searchable ? '<label class="sheet__search"><svg class="icon" aria-hidden="true"><use href="#i-search"/></svg><input type="search" placeholder="Поиск" autocomplete="off" enterkeyhint="search"></label>' : '') +
        '<ul class="olist" role="listbox" aria-label="' + Model.escapeHtml(TITLES[field]) + '">' +
        '<li><button class="opt' + (current ? '' : ' is-on') + '" type="button" data-opt="">' + EMPTY[field] + '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></button></li>' +
        options.map(function (option) {
          return '<li><button class="opt' + (option.value === current ? ' is-on' : '') + '" type="button" data-opt="' + Model.escapeHtml(option.value) + '">' +
            '<span>' + Model.escapeHtml(option.label) + (option.hint ? '<small>' + Model.escapeHtml(option.hint) + '</small>' : '') + '</span>' +
            '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></button></li>';
        }).join('') + '</ul>' +
        (options.length ? '' : '<p class="sheet__note">Для этой модели источник не указал варианты.</p>');
      const input = $('input', sheetBody);
      if (input) {
        input.addEventListener('input', function () {
          const q = input.value.trim().toLowerCase();
          $$('.opt', sheetBody).forEach(function (btn) {
            btn.parentElement.hidden = Boolean(q) && btn.dataset.opt !== '' && !btn.textContent.toLowerCase().includes(q);
          });
        });
      }
      const on = $('.opt.is-on', sheetBody);
      if (on) on.scrollIntoView({ block: 'center' });
    }).catch(function () {
      if (sheetState && sheetState.field === field) sheetBody.innerHTML = '<p class="sheet__note">Не удалось загрузить список. Попробуйте ещё раз.</p>';
    });
  }

  sheetBody.addEventListener('click', function (event) {
    const chip = event.target.closest('[data-km]');
    if (chip && sheetState && sheetState.chip) { sheetState.chip(chip.dataset.km); return; }
    const option = event.target.closest('[data-opt]');
    if (!option || !sheetState) return;
    const change = {}; change[sheetState.field] = option.dataset.opt;
    setDraft(change);
    closeSheet();
  });

  /* Колёсики «от» и «до» для года */
  function wheelMarkup(name, values, selected) {
    return '<div class="wheel" data-wheel="' + name + '"><div class="wheel__track" tabindex="0" role="listbox" aria-label="' + (name === 'from' ? 'Год от' : 'Год до') + '">' +
      values.map(function (v) { return '<div class="wheel__item' + (v ? '' : ' wheel__item--any') + (String(v) === String(selected) ? ' is-on' : '') + '" data-v="' + v + '">' + (v || 'Любой') + '</div>'; }).join('') +
      '</div></div>';
  }

  function renderYear() {
    sheetOk.parentElement.hidden = false;
    const years = [''];
    for (let y = NOW_YEAR + 1; y >= MIN_YEAR; y -= 1) years.push(y);
    sheetState.pending = { yearFrom: draft.yearFrom || '', yearTo: draft.yearTo || '' };
    sheetBody.innerHTML =
      '<div class="years"><div class="years__head"><span>От</span><span>До</span></div>' +
      '<div class="years__wheels">' + wheelMarkup('from', years, sheetState.pending.yearFrom) + '<span class="years__dash">–</span>' + wheelMarkup('to', years, sheetState.pending.yearTo) +
      '<div class="years__band" aria-hidden="true"></div></div></div>';
    const wheels = { from: $('[data-wheel="from"] .wheel__track', sheetBody), to: $('[data-wheel="to"] .wheel__track', sheetBody) };
    const itemH = () => $('.wheel__item', sheetBody).offsetHeight || 44;
    function scrollToValue(track, value, smooth) {
      const items = $$('.wheel__item', track);
      const index = Math.max(0, items.findIndex(function (item) { return item.dataset.v === String(value || ''); }));
      track.scrollTo({ top: index * itemH(), behavior: smooth ? 'smooth' : 'auto' });
    }
    function settle(name) {
      const track = wheels[name];
      const items = $$('.wheel__item', track);
      const index = Math.min(items.length - 1, Math.max(0, Math.round(track.scrollTop / itemH())));
      items.forEach(function (item, i) { item.classList.toggle('is-on', i === index); });
      const value = items[index].dataset.v;
      sheetState.pending[name === 'from' ? 'yearFrom' : 'yearTo'] = value;
      // «от» не может быть больше «до» — подтягиваем второе колесо
      const p = sheetState.pending;
      if (p.yearFrom && p.yearTo && Number(p.yearFrom) > Number(p.yearTo)) {
        const other = name === 'from' ? 'to' : 'from';
        p[other === 'from' ? 'yearFrom' : 'yearTo'] = value;
        scrollToValue(wheels[other], value, true);
      }
      updateSheetCount();
    }
    Object.keys(wheels).forEach(function (name) {
      const track = wheels[name];
      let timer;
      track.addEventListener('scroll', function () { clearTimeout(timer); timer = setTimeout(function () { settle(name); }, 110); }, { passive: true });
      track.addEventListener('click', function (event) {
        const item = event.target.closest('.wheel__item');
        if (item) scrollToValue(track, item.dataset.v, true);
      });
      track.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        track.scrollBy({ top: (event.key === 'ArrowDown' ? 1 : -1) * itemH(), behavior: 'smooth' });
      });
    });
    requestAnimationFrame(function () {
      scrollToValue(wheels.from, sheetState.pending.yearFrom, false);
      scrollToValue(wheels.to, sheetState.pending.yearTo, false);
    });
    updateSheetCount();
  }

  /* Ползунок пробега с шагом 10 000 км */
  function renderMileage() {
    sheetOk.parentElement.hidden = false;
    const start = Number(draft.mileageTo) || MILEAGE_MAX + MILEAGE_STEP;
    sheetState.pending = { mileageTo: draft.mileageTo || '' };
    sheetBody.innerHTML =
      '<div class="range">' +
      '<output class="range__value" id="mileageOut"></output>' +
      '<input class="range__input" type="range" min="' + MILEAGE_STEP + '" max="' + (MILEAGE_MAX + MILEAGE_STEP) + '" step="' + MILEAGE_STEP + '" value="' + start + '" aria-label="Пробег до">' +
      '<div class="range__scale"><span>10 000</span><span>150 000</span><span>Любой</span></div>' +
      '<div class="range__chips">' + [30000, 50000, 80000, 100000, 150000].map(function (km) {
        return '<button class="chip" type="button" data-km="' + km + '">до ' + fmt(km) + '</button>';
      }).join('') + '</div></div>';
    const input = $('.range__input', sheetBody), out = $('#mileageOut');
    function paint() {
      const value = Number(input.value);
      const any = value > MILEAGE_MAX;
      out.textContent = any ? 'Любой пробег' : 'до ' + fmt(value) + ' км';
      input.style.setProperty('--fill', ((value - MILEAGE_STEP) / MILEAGE_MAX * 100) + '%');
      sheetState.pending.mileageTo = any ? '' : String(value);
      $$('.chip', sheetBody).forEach(function (chip) { chip.classList.toggle('is-on', Number(chip.dataset.km) === value); });
    }
    input.addEventListener('input', function () { paint(); updateSheetCount(); });
    sheetState.chip = function (km) { input.value = km; paint(); updateSheetCount(); };
    paint();
    updateSheetCount();
  }

  sheetOk.addEventListener('click', function () {
    if (sheetState) setDraft(sheetState.pending);
    closeSheet();
  });
  sheetClear.addEventListener('click', function () {
    if (!sheetState) return;
    const field = sheetState.field;
    const change = field === 'year' ? { yearFrom: '', yearTo: '' } : field === 'mileage' ? { mileageTo: '' } : (function () { const c = {}; c[field] = ''; return c; })();
    setDraft(change);
    closeSheet();
  });
  sheet.addEventListener('click', function (event) { if (event.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeSheet(); });

  form.addEventListener('click', function (event) {
    const tile = event.target.closest('[data-sheet]');
    if (tile && !tile.disabled) openSheet(tile.dataset.sheet);
  });

  /* ---------- Применение фильтров и загрузка ---------- */
  function syncUrl() {
    const params = Model.filterParams(applied);
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? '?' + query : ''));
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    applied = Object.assign({}, draft);
    syncUrl();
    paintTiles();
    load(false).then(function () {
      const target = $('.catalog__toolbar');
      if (target && window.matchMedia('(max-width: 767px)').matches) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  resetBtn.addEventListener('click', function () {
    draft = emptyFilters();
    applied = emptyFilters();
    syncUrl();
    paintTiles();
    updateShowCount();
    load(false);
  });

  /* ---------- Карточки ---------- */
  function cardMarkup(car) {
    const name = Model.escapeHtml(car.name);
    const extra = car.trim ? ' · ' + Model.escapeHtml(car.trim) : '';
    const photo = car.photo || 'assets/img/catalog-car.webp';
    const pressed = Favs.has(car.id);
    const fee = car.fee ? 'вкл. утильсбор ' + fmt(car.fee) + ' ₽' : (car.price ? 'утильсбор уточним при расчёте' : '');
    return `
      <article class="car">
        <div class="car__img">
          <img class="car__photo" src="${Model.escapeHtml(photo)}" alt="${name}" loading="lazy" decoding="async">
          <span class="badge">Корея</span>
          <button class="fav${pressed ? ' is-on' : ''}" type="button" data-fav="${Model.escapeHtml(car.id)}" aria-pressed="${pressed}" aria-label="${pressed ? 'Убрать из избранного' : 'В избранное'}"><svg class="icon"><use href="#i-heart"/></svg></button>
        </div>
        <div class="car__body">
          <h3 class="car__name">${name}</h3>
          <p class="car__meta">${car.year || 'Год не указан'} · ${fmt(car.km)} км · ${Model.engineLabel(car.engine)}${extra}</p>
          <p class="car__price">${car.price ? fmt(car.price) + ' ₽<small>до Владивостока</small>' : 'Цена по запросу'}</p>
          ${fee ? `<p class="car__fee">${fee}</p>` : ''}
        </div>
        <a class="car__link" href="car.html?id=${encodeURIComponent(car.id)}" aria-label="Подробнее: ${name}" data-open="${Model.escapeHtml(car.id)}"></a>
      </article>`;
  }

  function render(approximate) {
    count.textContent = total ? `${approximate ? 'Около ' : ''}${fmt(total)} ${carsWord(total)}` : '';
    grid.innerHTML = cars.length ? cars.map(cardMarkup).join('') : '<p class="empty">По выбранным параметрам ничего не найдено. Попробуйте расширить год или пробег.</p>';
    loadMore.hidden = !hasMore;
  }

  function readCache(url) {
    try {
      const cached = JSON.parse(safeGet(CACHE_KEY) || 'null');
      return cached && cached.url === url ? cached.data : null;
    } catch (e) { return null; }
  }

  function accept(data, append) {
    (data.items || []).forEach(function (item) { rawItems.set(String(item.id), item); });
    const nextCars = (data.items || []).map(Model.normalizeCar).filter(function (car) { return car.id && car.name; });
    cars = append ? cars.concat(nextCars) : nextCars;
    total = Number(data.total) || cars.length;
    hasMore = Boolean(data.hasMore);
    if (data.makes && data.makes.length) makes = data.makes;
    Favs.refresh(nextCars);
    render(Boolean(data.approximate));
    if (!append && sameFilters(draft, applied)) {
      showText.textContent = 'Показать ' + (data.approximate ? 'около ' : '') + autoWord(total);
      showBtn.disabled = total === 0;
    }
  }

  async function load(append) {
    if (loading) return;
    loading = true;
    const targetPage = append ? page + 1 : 1;
    const url = Model.buildCatalogUrl(withSort(applied), targetPage);
    status.textContent = append ? 'Загружаем ещё автомобили…' : 'Обновляем каталог…';
    loadMore.disabled = true;
    if (!append) grid.classList.add('is-loading');
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Источник временно недоступен');
      const data = await response.json();
      safeSet(CACHE_KEY, JSON.stringify({ url: url, data: data, savedAt: Date.now() }));
      page = targetPage;
      accept(data, append);
      status.textContent = 'Каталог обновляется автоматически один раз в сутки. Цены — с утильсбором.';
    } catch (error) {
      const cached = !append && readCache(url);
      if (cached) {
        page = 1;
        accept(cached, false);
        status.textContent = 'Источник временно недоступен — показана последняя сохранённая версия.';
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
      const car = cars.find(function (item) { return item.id === String(favorite.dataset.fav); });
      if (!car) return;
      const on = Favs.toggle(car);
      favorite.classList.toggle('is-on', on);
      favorite.setAttribute('aria-pressed', String(on));
      favorite.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное');
      if (on) { favorite.classList.remove('is-pop'); void favorite.offsetWidth; favorite.classList.add('is-pop'); }
      if (window.toast) toast(on ? 'Добавлено в избранное' : 'Удалено из избранного');
      return;
    }
    const link = event.target.closest('[data-open]');
    if (link) {
      const raw = rawItems.get(String(link.dataset.open));
      try { if (raw) sessionStorage.setItem('oncarclick-car-preview', JSON.stringify(raw)); } catch (e) {}
    }
  });

  sortSel.addEventListener('change', function () { load(false); });
  loadMore.addEventListener('click', function () { load(true); });

  paintTiles();
  load(false);
})();
