/* OnCarClick — вступительная анимация главного экрана.
   Пустой ночной асфальт → машина подъезжает от горизонта, тормозит, моргает фарами →
   проявляются флаги, порт и текст. Конечный кадр = обычная главная:
   временные слои (асфальт без машины, машина) в конце удаляются. */
(function () {
  const d = document.documentElement;
  if (!d.classList.contains('intro')) return;

  const DURATION = 5400; // мс — до конца последней анимации
  const media = document.querySelector('.hero__media');
  const pic = media && media.querySelector('picture');
  let road = null, car = null, started = false, finished = false;

  function cleanup() {
    if (road) road.remove();
    if (car) car.remove();
    road = car = null;
  }
  function finish() {
    if (finished) return;
    finished = true;
    d.classList.remove('intro', 'intro-go');
    cleanup();
    removeEventListener('scroll', onScroll);
  }
  function onScroll() { if (scrollY > 30) finish(); }

  if (!pic || scrollY > 30) { finish(); return; }

  const sizes = pic.querySelector('img').getAttribute('sizes') || '100vw';

  // 1) пустой асфальт без машины и флагов
  road = document.createElement('div');
  road.className = 'hero__road';
  road.setAttribute('aria-hidden', 'true');
  road.innerHTML =
    '<picture><source type="image/webp" srcset="assets/img/hero-road-800.webp 800w, assets/img/hero-road-1200.webp 1200w, assets/img/hero-road-1672.webp 1672w" sizes="' + sizes + '">' +
    '<img src="assets/img/hero-road-1200.jpg" srcset="assets/img/hero-road-800.jpg 800w, assets/img/hero-road-1200.jpg 1200w, assets/img/hero-road-1672.jpg 1672w" sizes="' + sizes + '" alt="" decoding="async"></picture>';

  // 2) машина: тень и отсвет под ней + сама машина (вырезана маской) + фары — всё едет вместе
  car = document.createElement('div');
  car.className = 'hero__car';
  car.setAttribute('aria-hidden', 'true');
  car.innerHTML = '<div class="hero__body"><span class="hero__glow"></span><span class="hero__shadow"></span><div class="hero__carimg"></div>' +
    '<div class="hero__fx"><span class="hero__lamp hero__lamp--l"></span><span class="hero__lamp hero__lamp--r"></span><span class="hero__flare"></span></div></div>';
  const clone = pic.cloneNode(true);
  const carImg = clone.querySelector('img');
  carImg.alt = '';
  carImg.removeAttribute('fetchpriority');
  car.querySelector('.hero__carimg').appendChild(clone);

  pic.after(road, car);
  addEventListener('scroll', onScroll, { passive: true });

  const loaded = (img) => new Promise((res) => {
    if (img.complete && img.naturalWidth) return res();
    img.addEventListener('load', res, { once: true });
    img.addEventListener('error', res, { once: true });
  }).then(() => (img.decode ? img.decode().catch(() => {}) : null));

  const mask = new Image();
  mask.src = 'assets/img/hero-car-mask.png';

  // если картинки грузятся слишком долго — просто показываем обычную главную
  const giveUp = setTimeout(() => { if (!started) finish(); }, 3200);

  Promise.all([loaded(pic.querySelector('img')), loaded(carImg), loaded(road.querySelector('img')), loaded(mask)]).then(() => {
    if (finished) return;
    started = true;
    clearTimeout(giveUp);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      d.classList.add('intro-go');
      setTimeout(finish, DURATION);
    }));
  });
})();
