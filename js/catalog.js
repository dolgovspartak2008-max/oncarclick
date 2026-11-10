/* Каталог: данные-заглушки, фильтры, поиск, сортировка, избранное */
(function () {
  const CARS = [
    { brand: 'BMW', model: '5 Series (G30)', country: 'Корея', year: 2020, km: 58000, price: 3890000, type: 'sedan', color: '#5d6168', pop: 10 },
    { brand: 'Toyota', model: 'RAV4', country: 'Япония', year: 2021, km: 42000, price: 2790000, type: 'suv', color: '#e9eaec', pop: 9 },
    { brand: 'Kia', model: 'Sorento', country: 'Корея', year: 2022, km: 36000, price: 3240000, type: 'suv', color: '#1b1d22', pop: 9 },
    { brand: 'Hyundai', model: 'Palisade', country: 'Корея', year: 2021, km: 47000, price: 3990000, type: 'suv', color: '#c9ccd1', pop: 8 },
    { brand: 'Honda', model: 'CR-V', country: 'Япония', year: 2020, km: 61000, price: 2590000, type: 'suv', color: '#9aa0a8', pop: 7 },
    { brand: 'Genesis', model: 'G80', country: 'Корея', year: 2021, km: 39000, price: 4150000, type: 'sedan', color: '#d5d7db', pop: 7 },
    { brand: 'Geely', model: 'Monjaro', country: 'Китай', year: 2023, km: 15000, price: 3650000, type: 'suv', color: '#2a2d33', pop: 8 },
    { brand: 'Chery', model: 'Tiggo 8 Pro', country: 'Китай', year: 2023, km: 12000, price: 2690000, type: 'suv', color: '#b8241e', pop: 6 },
    { brand: 'Lexus', model: 'RX 300', country: 'Япония', year: 2019, km: 72000, price: 4290000, type: 'suv', color: '#f0f0f2', pop: 6 },
    { brand: 'Kia', model: 'K5', country: 'Корея', year: 2021, km: 44000, price: 2350000, type: 'sedan', color: '#7b8088', pop: 6 },
    { brand: 'Toyota', model: 'Camry', country: 'Япония', year: 2020, km: 53000, price: 2890000, type: 'sedan', color: '#141518', pop: 8 },
    { brand: 'Haval', model: 'Jolion', country: 'Китай', year: 2023, km: 9000, price: 2050000, type: 'suv', color: '#d9dbe0', pop: 5 }
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const grid = $('#cars');
  const form = $('#filters');
  const q = $('#q');
  let sort = 'pop';
  const favs = new Set(JSON.parse(safeGet('favs') || '[]'));

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  const fmt = (n) => n.toLocaleString('ru-RU');
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return (m === 1 && h !== 11) ? a : (m >= 2 && m <= 4 && (h < 12 || h > 14)) ? b : c; };

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (k > 0 ? (255 - v) * k : v * k))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // Стилизованный силуэт авто (заглушка вместо фото)
  function carSvg(c, i) {
    const g = `g${i}`, hi = shade(c.color, .35), lo = shade(c.color, -.45);
    const body = c.type === 'suv'
      ? 'M18 112 C18 96 24 86 40 82 L78 74 C90 52 104 40 128 38 L236 38 C256 38 268 48 278 70 L298 78 C306 82 308 92 308 104 L308 116 C308 120 305 122 301 122 L24 122 C20 122 18 119 18 116 Z'
      : 'M18 112 C18 98 26 92 44 89 L92 84 C108 66 130 54 160 52 L212 52 C236 52 252 64 266 82 L292 88 C304 90 308 98 308 108 L308 116 C308 120 305 122 301 122 L24 122 C20 122 18 119 18 116 Z';
    const win1 = c.type === 'suv' ? 'M90 74 C100 56 112 47 130 46 L176 46 L176 74 Z' : 'M104 84 C118 68 134 60 158 59 L180 59 L180 84 Z';
    const win2 = c.type === 'suv' ? 'M182 46 L232 46 C248 46 258 54 266 72 L182 74 Z' : 'M186 59 L210 59 C228 59 242 68 254 83 L186 84 Z';
    const wy = 120;
    const wheel = (x) => `<circle cx="${x}" cy="${wy}" r="23" fill="#0b0c0f"/><circle cx="${x}" cy="${wy}" r="14" fill="#3a3d44"/><circle cx="${x}" cy="${wy}" r="5" fill="#16171b"/>`;
    return `<svg viewBox="0 0 326 150" aria-hidden="true">
      <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${c.color}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>
      <ellipse cx="163" cy="142" rx="150" ry="6" fill="rgba(0,0,0,.6)"/>
      <path d="${body}" fill="url(#${g})"/>
      <path d="${win1}" fill="#14161b" opacity=".92"/><path d="${win2}" fill="#14161b" opacity=".92"/>
      <path d="M30 100 L300 100" stroke="${lo}" stroke-width="1.2" opacity=".6"/>
      <path d="M22 96 l14 -3 l0 7 l-14 1z" fill="#fff" opacity=".85"/>
      <path d="M306 96 l-10 -2 l0 7 l10 1z" fill="#ff2b2b"/>
      ${wheel(78)}${wheel(252)}
    </svg>`;
  }

  // Опции марок/моделей
  const brandSel = $('#fBrand'), modelSel = $('#fModel');
  [...new Set(CARS.map(c => c.brand))].sort().forEach(b => brandSel.add(new Option(b, b)));
  function fillModels() {
    const b = brandSel.value;
    modelSel.length = 1;
    CARS.filter(c => !b || c.brand === b).map(c => c.model).sort().forEach(m => modelSel.add(new Option(m, m)));
  }
  fillModels();
  brandSel.addEventListener('change', () => { fillModels(); });

  function getFiltered() {
    const fd = new FormData(form);
    const countries = fd.getAll('country');
    const num = (k) => { const v = fd.get(k); return v === '' || v == null ? null : +v; };
    const s = (q.value || '').trim().toLowerCase();
    let list = CARS.map((c, i) => ({ ...c, i })).filter(c =>
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
        <a class="car__link" href="contacts.html#form" aria-label="Узнать про ${c.brand} ${c.model}" data-car="${c.brand} ${c.model}"></a>
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
      safeSet('favs', JSON.stringify([...favs]));
      window.toast && toast(favs.has(id) ? 'Добавлено в избранное' : 'Удалено из избранного');
      return;
    }
    const l = e.target.closest('[data-car]');
    if (l) safeSet('car', l.dataset.car);
  });

  // Сортировка
  $$('.pill').forEach(p => p.addEventListener('click', () => {
    $$('.pill').forEach(x => x.classList.toggle('is-active', x === p));
    sort = p.dataset.sort; render();
  }));

  // Аккордеоны
  $$('.fgroup__btn').forEach(b => b.addEventListener('click', () => {
    const g = b.parentElement; g.classList.toggle('is-open');
    b.setAttribute('aria-expanded', g.classList.contains('is-open'));
  }));

  // Мобильная шторка фильтров
  const ov = $('#fOverlay');
  const setSheet = (open) => { form.classList.toggle('is-open', open); ov.classList.toggle('is-open', open); document.body.classList.toggle('no-scroll', open); };
  $('#fOpen').addEventListener('click', () => setSheet(true));
  $('#fClose').addEventListener('click', () => setSheet(false));
  ov.addEventListener('click', () => setSheet(false));

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', (e) => { e.preventDefault(); render(); setSheet(false); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  form.addEventListener('reset', () => setTimeout(() => { fillModels(); render(); }));
  q.addEventListener('input', render);

  render();
})();
