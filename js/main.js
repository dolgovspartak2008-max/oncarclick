/* OnCarClick — общий скрипт: иконки, мобильное меню, тосты */
(function () {
  const ICONS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4.2A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    chevronR: '<path d="m9 6 6 6-6 6"/>',
    chevronL: '<path d="m15 6-6 6 6 6"/>',
    home: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h4.5v-5.5h3V20H18V9.5"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>',
    quote: '<path d="M10 7H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v1a3 3 0 0 1-3 3M20 7h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v1a3 3 0 0 1-3 3"/>',
    calc: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/>',
    truck: '<path d="M2 7h11v9H2zM13 10h4.5l3.5 3.5V16h-8z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/><path d="M0 9.5h3M0 12h4"/>',
    coins: '<ellipse cx="9" cy="6.5" rx="5.5" ry="2.5"/><path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/><path d="M3.5 10.5v4C3.5 15.9 6 17 9 17"/><ellipse cx="15" cy="14" rx="5.5" ry="2.5"/><path d="M9.5 14v3.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V14"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 16.5 9 5 9-5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14c2.4.2 4 1.7 4.5 4.5"/>',
    car: '<path d="M3 16v-3.5l2-5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5l2 5V16a1 1 0 0 1-1 1h-1.5M4 17a1 1 0 0 1-1-1M3.5 12.5h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M9.3 17h5.4"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-2 2.5-5 2.5"/>',
    receipt: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 10v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4M5 14v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    pin: '<path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12Z" fill="currentColor"/><circle cx="12" cy="10" r="2.6" fill="#08090c" stroke="none"/>',
    phone: '<path d="M5 3.5h3.5l1.6 4.2-2.2 1.5a11 11 0 0 0 6.9 6.9l1.5-2.2 4.2 1.6V19a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 3.2 5.5 1.8 1.8 0 0 1 5 3.5Z" fill="currentColor" stroke="none"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
    telegram: '<path d="M21.4 4.2 2.9 11.3c-1 .4-1 1.6 0 1.9l4.6 1.5 1.8 5.4c.2.6 1 .8 1.5.3l2.6-2.4 4.7 3.5c.6.4 1.4.1 1.6-.6L22.9 5.6c.2-1-.7-1.8-1.5-1.4Zm-3.6 3.6-8.4 7.6-.4 3.4-1.5-4.6 10.3-6.4Z" fill="currentColor" stroke="none"/>',
    whatsapp: '<path d="M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.6 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5Zm0 17.1a7.7 7.7 0 0 1-4-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A7.7 7.7 0 1 1 12 19.6Zm4.3-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.3 6.3 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.7 4.3 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3Z" fill="currentColor" stroke="none"/>',
    bolt: '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12l1-8Z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3Z"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5"/>',
    route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'
  };

  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' +
    Object.entries(ICONS).map(([id, p]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${p}</symbol>`).join('') +
    '</svg>';
  document.body.insertAdjacentHTML('afterbegin', sprite);

  // ---- Статичная точечная карта с маршрутами Корея / Япония / Китай → Россия (раздел «Как проходит сделка») ----
  // без анимаций и фильтров — рисуется один раз и не нагружает прокрутку
  // координаты в сетке карты: x = (долгота + 180) / 1.2, y = (80 − широта) / 1.2
  const P = {
    msk: [181.3, 20.2], vvo: [259.9, 30.75], bsn: [257.5, 37.4], tyo: [266.4, 36.9], pek: [247, 33.4], sha: [251.3, 40.7],
    ham: [158.3, 22], dxb: [196.1, 45.7], nsk: [219.1, 20.8], nbo: [180.7, 67.75]
  };
  // [откуда, куда, контрольная точка дуги x, y, задержка]
  const ROUTES = [
    ['bsn', 'vvo', 248, 27, 0],
    ['tyo', 'vvo', 273, 26, 1.6],
    ['sha', 'vvo', 266, 35, 3.1],
    ['pek', 'msk', 214, 15, .8],
    ['vvo', 'msk', 221, 0, 2.3],
    ['tyo', 'nsk', 248, 9, .4],
    ['sha', 'ham', 203, 47, 1.2],
    ['bsn', 'dxb', 226, 66, 3.6],
    ['sha', 'nbo', 222, 78, 2.8],
  ];
  const routes = ROUTES.map(([a, b, cx, cy, delay]) => {
    const d = `M${P[a][0]} ${P[a][1]}Q${cx} ${cy} ${P[b][0]} ${P[b][1]}`;
    return `<path class="geo__line" d="${d}"/>`;
  }).join('');
  const dot = (k, cls) => `<circle class="geo__core ${cls}" cx="${P[k][0]}" cy="${P[k][1]}" r=".9"/>`;
  const geoBg = `<div class="geo-bg__map">
    <picture><source media="(max-width: 767px)" srcset="assets/img/worldmap-dots-m.svg"><img src="assets/img/worldmap-dots.svg" alt="" decoding="async" loading="lazy"></picture>
    <svg viewBox="0 0 300 115" preserveAspectRatio="none">
      <g>${routes}</g>
      ${dot('bsn', 'is-src', 0)}${dot('tyo', 'is-src', .7)}${dot('pek', 'is-src', 1.4)}${dot('sha', 'is-src', 2.1)}${dot('vvo', 'is-dst', .4)}${dot('msk', 'is-dst', 1.1)}${dot('ham', 'is-dst', 1.8)}${dot('dxb', 'is-dst', .2)}${dot('nsk', 'is-dst', 2.4)}${dot('nbo', 'is-dst', 1.5)}
    </svg></div>`;
  document.querySelectorAll('.deal-map').forEach(el => { el.innerHTML = geoBg; });

  // ---- Медленная плавная прокрутка к разделам ----
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const headerH = () => (document.querySelector('.header') || { offsetHeight: 0 }).offsetHeight;
  let scrollAnim = 0;
  window.smoothTo = function (target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const to = el.id === 'home' || el.id === 'top' ? 0 : Math.max(0, el.getBoundingClientRect().top + scrollY - headerH());
    const from = scrollY, dist = to - from;
    if (reduce || Math.abs(dist) < 2) { window.scrollTo(0, to); return; }
    const dur = Math.min(1600, Math.max(700, Math.abs(dist) * 0.45));
    const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const t0 = performance.now(); const id = ++scrollAnim;
    const step = (t) => {
      if (id !== scrollAnim) return;
      const p = Math.min(1, (t - t0) / dur);
      window.scrollTo(0, from + dist * ease(p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  // любое колесо/касание прерывает анимацию
  ['wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { scrollAnim++; }, { passive: true }));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.closest('.mnav')) return;
    const href = a.getAttribute('href');
    const t = href === '#top' ? document.body : document.querySelector(href);
    if (!t) return;
    e.preventDefault();
    window.smoothTo(href === '#top' ? '#home' : t);
    if (href !== '#top') history.replaceState(null, '', href);
  });

  // Мобильное меню — отдельный экран на весь дисплей (сайт под ним скрывается)
  const mnav = document.querySelector('.mnav');
  const openBtn = document.querySelector('.burger');
  const closeBtn = document.querySelector('.mnav__close');
  let savedY = 0;
  const setMenu = (open, keepPos) => {
    if (!mnav || mnav.classList.contains('is-open') === open) return;
    if (open) savedY = window.scrollY;
    mnav.classList.toggle('is-open', open);
    document.body.classList.toggle('screen-open', open);
    openBtn && openBtn.setAttribute('aria-expanded', String(open));
    if (!open && !keepPos) window.scrollTo({ top: savedY, behavior: 'instant' });
  };
  openBtn && openBtn.addEventListener('click', () => setMenu(true));
  closeBtn && closeBtn.addEventListener('click', () => setMenu(false));
  mnav && mnav.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) {
      // переход внутри страницы: закрываем меню и сразу показываем раздел
      e.preventDefault();
      setMenu(false, true);
      const t = document.querySelector(href);
      if (t) { setTimeout(() => window.smoothTo(t), 60); history.replaceState(null, '', href); }
    } else if (!href.includes('://') && !href.startsWith('tel:')) {
      setMenu(false);
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Тост
  let toastEl, toastT;
  window.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-show'), 2400);
  };

  // Подсветка пункта меню текущего раздела и кнопка «наверх» — через IntersectionObserver,
  // без обработчика scroll и без замеров layout на каждом кадре
  const sections = [...document.querySelectorAll('.section[id]')];
  const navLinks = [...document.querySelectorAll('.nav a, .mnav__links a')];
  const totop = document.querySelector('.totop');
  const setActive = (id) => navLinks.forEach(a => {
    const on = a.getAttribute('href') === '#' + id;
    a.classList.toggle('is-active', on);
    on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current');
  });
  if ('IntersectionObserver' in window) {
    if (sections.length > 1) {
      const sio = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
        { rootMargin: '-35% 0px -60% 0px' });
      sections.forEach(s => sio.observe(s));
    }
    if (totop) {
      const mark = document.createElement('div');
      mark.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80vh;pointer-events:none;visibility:hidden';
      mark.setAttribute('aria-hidden', 'true');
      document.body.prepend(mark);
      new IntersectionObserver(([e]) => totop.classList.toggle('is-show', !e.isIntersecting)).observe(mark);
    }
  }

  // ---- Плавное появление блоков при прокрутке ----
  if (!reduce && 'IntersectionObserver' in window) {
    const sel = ['.page.section .page-title', '.page.section .page-lead', '.stat', '.section-title', '.why__item',
      '.cat-teaser', '.step', '.deal-cta', '.faq', '.rev-sum', '.slider', '.clist', '.form', '.socials'].join(',');
    const els = [...document.querySelectorAll(sel)].filter(el => !el.closest('.mnav, .catpage'));
    const rio = new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => {
      const sib = [...el.parentElement.children].filter(x => els.includes(x));
      el.style.transitionDelay = Math.min(sib.indexOf(el), 4) * 70 + 'ms';
      el.classList.add('reveal');
      rio.observe(el);
    });
  }

  // Анимация цифр, когда блок попадает на экран
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const run = (el) => {
      const end = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now(), d = 1200;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / d), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
        el.textContent = v.toLocaleString('ru-RU') + suf;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.6 });
    counters.forEach(el => io.observe(el));
  }

  // Форматирование
  window.fmtRub = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
})();
