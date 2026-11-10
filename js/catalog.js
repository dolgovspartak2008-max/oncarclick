/* Страница каталога: возраст (вкладки), фильтры, поиск, сортировка, избранное */
(function () {
  const CARS = window.CARS, AGES = window.AGE_GROUPS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const grid = $('#cars'), form = $('#filters'), q = $('#q');
  let sort = 'pop';
  let age = new URLSearchParams(location.search).get('age');
  if (!AGES[age]) age = 'all';

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  const favs = new Set(JSON.parse(safeGet('favs2') || '[]'));
  const fmt = (n) => n.toLocaleString('ru-RU');

  // марки / модели
  const brandSel = $('#fBrand'), modelSel = $('#fModel');
  [...new Set(CARS.map(c => c.brand))].sort().forEach(b => brandSel.add(new Option(b, b)));
  function fillModels() {
    const b = brandSel.value;
    modelSel.length = 1;
    [...new Set(CARS.filter(c => !b || c.brand === b).map(c => c.model))].sort().forEach(m => modelSel.add(new Option(m, m)));
  }
  fillModels();
  brandSel.addEventListener('change', fillModels);

  function setAge(a, push) {
    age = a;
    $$('.tab').forEach(t => { const on = t.dataset.age === a; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on); });
    $('#catTitle').textContent = AGES[a].title;
    $('#catLead').textContent = AGES[a].lead;
    document.title = AGES[a].title + ' — OnCarClick';
    if (push) history.replaceState(null, '', a === 'all' ? 'catalog.html' : `catalog.html?age=${a}`);
    render();
  }

  function getFiltered() {
    const fd = new FormData(form);
    const countries = fd.getAll('country');
    const num = (k) => { const v = fd.get(k); return v === '' || v == null ? null : +v; };
    const s = (q.value || '').trim().toLowerCase();
    const list = CARS.map((c, i) => ({ ...c, i })).filter(c =>
      AGES[age].test(c) &&
      (!countries.length || countries.includes(c.country)) &&
      (!fd.get('brand') || c.brand === fd.get('brand')) &&
      (!fd.get('model') || c.model === fd.get('model')) &&
      (num('yearFrom') == null || c.year >= num('yearFrom')) &&
      (num('yearTo') == null || c.year <= num('yearTo')) &&
      (num('priceFrom') == null || c.price >= num('priceFrom')) &&
      (num('priceTo') == null || c.price <= num('priceTo')) &&
      (num('kmFrom') == null || c.km >= num('kmFrom')) &&
      (num('kmTo') == null || c.km <= num('kmTo')) &&
      (!s || `${c.brand} ${c.model} ${c.country}`.toLowerCase().includes(s))
    );
    const by = { pop: (a, b) => b.pop - a.pop, cheap: (a, b) => a.price - b.price, exp: (a, b) => b.price - a.price, new: (a, b) => b.year - a.year || a.km - b.km };
    return list.sort(by[sort]);
  }

  function render() {
    const list = getFiltered();
    $('#count').textContent = `Найдено ${list.length} ${plural(list.length, 'автомобиль', 'автомобиля', 'автомобилей')}`;
    $('#fShow').textContent = `Показать ${list.length} авто`;
    if (!list.length) { grid.innerHTML = '<p class="empty">По вашему запросу ничего не найдено.<br>Попробуйте изменить фильтры.</p>'; return; }
    grid.innerHTML = list.map((c, n) => `
      <article class="car" style="animation-delay:${Math.min(n, 8) * 40}ms">
        <div class="car__top">
          <span class="badge">${c.country}</span>
          <button class="fav${favs.has(c.i) ? ' is-on' : ''}" type="button" data-fav="${c.i}" aria-pressed="${favs.has(c.i)}" aria-label="В избранное"><svg class="icon"><use href="#i-heart"/></svg></button>
        </div>
        <div class="car__img">${carSvg(c, c.i)}</div>
        <h3 class="car__name">${c.brand} ${c.model}</h3>
        <p class="car__meta">${c.year} · ${fmt(c.km)} км</p>
        <p class="car__price">${fmt(c.price)} ₽</p>
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

  $$('.tab').forEach(t => t.addEventListener('click', () => setAge(t.dataset.age, true)));
  $$('.pill').forEach(p => p.addEventListener('click', () => {
    $$('.pill').forEach(x => x.classList.toggle('is-active', x === p));
    sort = p.dataset.sort; render();
  }));
  $$('.fgroup__btn').forEach(b => b.addEventListener('click', () => {
    const g = b.parentElement; g.classList.toggle('is-open');
    b.setAttribute('aria-expanded', g.classList.contains('is-open'));
  }));

  // Фильтры на телефоне — отдельный экран на весь дисплей
  const setSheet = (open) => {
    form.classList.toggle('is-open', open);
    document.body.classList.toggle('screen-open', open);
    if (open) form.scrollTop = 0;
  };
  $('#fOpen').addEventListener('click', () => setSheet(true));
  $('#fClose').addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setSheet(false); });

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', (e) => {
    e.preventDefault(); render(); setSheet(false);
    window.scrollTo({ top: grid.getBoundingClientRect().top + scrollY - 140, behavior: 'smooth' });
  });
  form.addEventListener('reset', () => setTimeout(() => { fillModels(); render(); }));
  q.addEventListener('input', render);

  setAge(age, false);
})();
