/* OnCarClick — вступительная анимация главного экрана:
   из темноты подъезжает машина, моргают фары, проявляется порт и встаёт текст.
   Итоговый кадр полностью совпадает с обычной главной — слой с машиной в конце убирается. */
(function () {
  const d = document.documentElement;
  if (!d.classList.contains('intro')) return;

  const media = document.querySelector('.hero__media');
  const pic = media && media.querySelector('picture');
  let car = null, fx = null, started = false, finished = false;

  function cleanup() {
    if (car) car.remove();
    if (fx) fx.remove();
    car = fx = null;
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

  // слой с машиной: та же картинка, вырезанная по контуру маской
  car = document.createElement('div');
  car.className = 'hero__car';
  car.setAttribute('aria-hidden', 'true');
  const clone = pic.cloneNode(true);
  const carImg = clone.querySelector('img');
  carImg.alt = '';
  carImg.removeAttribute('fetchpriority');
  car.appendChild(clone);
  pic.after(car);

  // фары и блик
  fx = document.createElement('div');
  fx.className = 'hero__fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.innerHTML = '<span class="hero__lamp hero__lamp--l"></span><span class="hero__lamp hero__lamp--r"></span><span class="hero__flare"></span>';
  car.after(fx);

  addEventListener('scroll', onScroll, { passive: true });

  const loaded = (img) => new Promise((res) => {
    if (img.complete && img.naturalWidth) return res();
    img.addEventListener('load', res, { once: true });
    img.addEventListener('error', res, { once: true });
  }).then(() => (img.decode ? img.decode().catch(() => {}) : null));

  const mask = new Image();
  mask.src = 'assets/img/hero-car-mask.png';

  // если картинка грузится слишком долго — просто показываем обычную главную
  const giveUp = setTimeout(() => { if (!started) finish(); }, 3200);

  Promise.all([loaded(pic.querySelector('img')), loaded(carImg), loaded(mask)]).then(() => {
    if (finished) return;
    started = true;
    clearTimeout(giveUp);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      d.classList.add('intro-go');
      setTimeout(finish, 4400);
    }));
  });
})();
