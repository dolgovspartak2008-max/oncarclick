/* Страница каталога: три зависимых фильтра (марка → модель → объём), сортировка, избранное.
   Каждый список показывает только варианты, которые есть среди машин,
   подходящих под два других выбранных фильтра. */
(function () {
  const CARS = (window.CARS || []).map((c, i) => ({ ...c, i }));
  const $ = (s, r = document) => r.querySelector(s);
  const grid = $('#cars'), form = $('#filters');
  const sel = { brand: $('#fBrand'), model: $('#fModel'), engine: $('#fEngine') };
  const sortSel = $('#sort'), resetBtn = $('#fReset');

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  let favs;
  try { favs = new Set(JSON.parse(safeGet('favs2') || '[]')); } catch (e) { favs = new Set(); }
  const fmt = (n) => n.toLocaleString('ru-RU');
  const engineLabel = (e) => (+e ? (+e).toFixed(1) + ' л' : 'Электро');
  const val = () => ({ brand: sel.brand.value, model: sel.model.value, engine: sel.engine.value });

  // подходит ли машина под фильтры, кроме указанного (для построения списков)
  function match(c, v, skip) {
    return (skip === 'brand' || !v.brand || c.brand === v.brand) &&
           (skip === 'model' || !v.model || c.model === v.model) &&
           (skip === 'engine' || v.engine === '' || String(c.engine) === v.engine);
  }

  function fill(key, values, label) {
    const s = sel[key], cur = s.value;
    s.length = 1;
    values.forEach(v => s.add(new Option(label ? label(v) : v, v)));
    s.value = values.map(String).includes(cur) ? cur : '';
  }

  function syncOptions() {
    // до трёх проходов: смена одного списка может сбросить выбор в другом
    for (let k = 0; k < 3; k++) {
      const v = val();
      fill('brand', [...new Set(CARS.filter(c => match(c, v, 'brand')).map(c => c.brand))].sort());
      fill('model', [...new Set(CARS.filter(c => match(c, val(), 'model')).map(c => c.model))].sort());
      fill('engine', [...new Set(CARS.filter(c => match(c, val(), 'engine')).map(c => String(c.engine)))].sort((a, b) => a - b), engineLabel);
      const after = val();
      if (after.brand === v.brand && after.model === v.model && after.engine === v.engine) break;
    }
  }

  const SORTS = {
    pop: (a, b) => b.pop - a.pop,
    cheap: (a, b) => a.price - b.price,
    exp: (a, b) => b.price - a.price,
    new: (a, b) => b.year - a.year || a.km - b.km,
  };

  function render() {
    const v = val();
    const list = CARS.filter(c => match(c, v)).sort(SORTS[sortSel.value] || SORTS.pop);
    resetBtn.hidden = !(v.brand || v.model || v.engine);
    $('#count').textContent = `${list.length} ${plural(list.length, 'автомобиль', 'автомобиля', 'автомобилей')}`;
    if (!list.length) { grid.innerHTML = '<p class="empty">По выбранным параметрам ничего не найдено.</p>'; return; }
    grid.innerHTML = list.map(c => `
      <article class="car">
        <div class="car__img">${carSvg(c, c.i)}
          <span class="badge">${c.country}</span>
          <button class="fav${favs.has(c.i) ? ' is-on' : ''}" type="button" data-fav="${c.i}" aria-pressed="${favs.has(c.i)}" aria-label="В избранное"><svg class="icon"><use href="#i-heart"/></svg></button>
        </div>
        <div class="car__body">
          <h3 class="car__name">${c.brand} ${c.model}</h3>
          <p class="car__meta">${c.year} · ${fmt(c.km)} км · ${engineLabel(c.engine)}</p>
          <p class="car__price">${c.price ? fmt(c.price) + ' ₽' : 'Цена по запросу'}${c.price ? '<small>под ключ</small>' : ''}</p>
        </div>
        <a class="car__link" href="index.html#contacts" aria-label="Узнать про ${c.brand} ${c.model}" data-car="${c.brand} ${c.model}, ${c.year}"></a>
      </article>`).join('');
  }

  grid.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fav]');
    if (f) {
      e.preventDefault();
      const id = +f.dataset.fav;
      favs.has(id) ? favs.delete(id) : favs.add(id);
      f.classList.toggle('is-on', favs.has(id));
      f.setAttribute('aria-pressed', favs.has(id));
      safeSet('favs2', JSON.stringify([...favs]));
      window.toast && toast(favs.has(id) ? 'Добавлено в избранное' : 'Удалено из избранного');
      return;
    }
    const l = e.target.closest('[data-car]');
    if (l) safeSet('car', l.dataset.car);
  });

  form.addEventListener('change', () => { syncOptions(); render(); });
  form.addEventListener('reset', () => setTimeout(() => { syncOptions(); render(); }));
  sortSel.addEventListener('change', render);

  // фильтр из адреса: catalog.html?brand=Kia&model=K5
  const qs = new URLSearchParams(location.search);
  syncOptions();
  ['brand', 'model', 'engine'].forEach(k => { if (qs.get(k)) { sel[k].value = qs.get(k); syncOptions(); } });
  render();
})();
