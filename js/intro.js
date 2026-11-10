/* OnCarClick — вступительная анимация главного экрана.
   Пустой ночной асфальт → машина подъезжает по перспективе (колёса катятся, а не скользят:
   угол поворота = пройденный путь / радиус колеса), тормозит с «клевком» носа на подвеске,
   останавливается → зажигаются фары → проявляются порт и флаги → появляется текст.
   Вся сцена собрана в координатах исходной картинки 1672×941 и масштабируется под экран.
   Последний кадр совпадает с обычной главной (в ней фары уже горят), временные слои удаляются. */
(function () {
  const d = document.documentElement;
  if (!d.classList.contains('intro')) return;

  const media = document.querySelector('.hero__media');
  const pic = media && media.querySelector('picture');
  let stage = null, glow = null, started = false, finished = false, raf = 0, ro = null;

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    d.classList.remove('intro', 'intro-go', 'intro-text', 'intro-flagsgo');
    if (stage) stage.remove();
    if (glow) glow.remove();
    if (ro) ro.disconnect();
    stage = glow = null;
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', fit);
  }
  function onScroll() { if (scrollY > 30) finish(); }
  if (!pic || scrollY > 30) { finish(); return; }

  /* ---------- сцена (координаты исходника 1672×941) ---------- */
  const SW = 1672, SH = 941;
  const DIR = 'assets/img/intro/';
  // положение слоёв, вырезанных из исходной картинки
  const L = {
    body:   { x: 764,  y: 400, w: 848,  h: 400 },
    wheels: { x: 1398, y: 501, w: 214,  h: 299 },
    under:  { x: 762,  y: 628, w: 859,  h: 313 },
    lights: { x: 219,  y: 280, w: 1453, h: 661 },
    rimF:   { x: 1396, y: 569, w: 79,   h: 210 },
    rimR:   { x: 1569, y: 523, w: 40,   h: 162 }
  };
  const FRAMES = 24;                 // кадров вращения диска на 72° (5 спиц)
  const VP = [1780, 573];            // точка схода: сюда «уходит» правый борт машины
  const PIVOT = [1590, 700];         // ось задних колёс — вокруг неё кузов клюёт носом

  const sizes = pic.querySelector('img').getAttribute('sizes') || '100vw';
  const roadPicture = (cls) =>
    '<picture class="' + cls + '"><source type="image/webp" srcset="assets/img/hero-road-800.webp 800w, assets/img/hero-road-1200.webp 1200w, assets/img/hero-road-1672.webp 1672w" sizes="' + sizes + '">' +
    '<img src="assets/img/hero-road-1200.jpg" srcset="assets/img/hero-road-800.jpg 800w, assets/img/hero-road-1200.jpg 1200w, assets/img/hero-road-1672.jpg 1672w" sizes="' + sizes + '" alt="" decoding="async"></picture>';
  const box = (b) => 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;';
  const rim = (cls, b, blur) =>
    '<div class="intro-rim ' + cls + '" style="' + box(b) + 'background-image:url(' + DIR + (cls.indexOf('f') > -1 ? 'rim-f' : 'rim-r') + '.webp);background-size:' + b.w * (FRAMES + 1) + 'px ' + b.h + 'px;' +
    (blur ? 'background-position:' + (-FRAMES * b.w) + 'px 0;opacity:0;' : '') + '"></div>';

  stage = document.createElement('div');
  stage.className = 'intro-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML =
    roadPicture('intro-road') +
    '<div class="intro-flags">' + roadPicture('') + '</div>' +
    '<div class="intro-car">' +
      '<img class="intro-under" src="' + DIR + 'under.webp" style="' + box(L.under) + '" alt="">' +
      '<img class="intro-wheels" src="' + DIR + 'wheels.webp" style="' + box(L.wheels) + '" alt="">' +
      rim('rf', L.rimF) + rim('rf rf-b', L.rimF, true) +
      rim('rr', L.rimR) + rim('rr rr-b', L.rimR, true) +
      '<img class="intro-body" src="' + DIR + 'body.webp" style="' + box(L.body) + 'transform-origin:' + (PIVOT[0] - L.body.x) + 'px ' + (PIVOT[1] - L.body.y) + 'px" alt="">' +
    '</div>' +
    '<div class="intro-black"></div>';
  // свет фар — отдельным слоем прямо в .hero__media: режим screen должен смешиваться с настоящей картинкой,
  // а внутри полупрозрачной группы он бы «изолировался» и дал чёрный прямоугольник
  const glowEl = document.createElement('div');
  glowEl.className = 'intro-stage intro-stage--glow';
  glowEl.setAttribute('aria-hidden', 'true');
  glowEl.innerHTML = '<img class="intro-lights" src="' + DIR + 'lights.webp" style="' + box(L.lights) + '" alt="">';
  pic.after(stage, glowEl);
  glow = glowEl;

  const $ = (s) => stage.querySelector(s);
  const road = $('.intro-road'), flags = $('.intro-flags'), car = $('.intro-car'), under = $('.intro-under');
  const body = $('.intro-body'), lights = glowEl.querySelector('.intro-lights'), black = $('.intro-black');
  const rf = $('.rf:not(.rf-b)'), rfb = $('.rf-b'), rr = $('.rr:not(.rr-b)'), rrb = $('.rr-b');

  function fit() {
    const t = 'scale(' + media.clientWidth / SW + ')';
    if (stage) stage.style.transform = t;
    if (glow) glow.style.transform = t;
  }
  fit();
  addEventListener('resize', fit);
  if ('ResizeObserver' in window) { ro = new ResizeObserver(fit); ro.observe(media); }
  addEventListener('scroll', onScroll, { passive: true });

  /* ---------- физика ---------- */
  const T0 = 300;          // мс — начало движения
  const T_CRUISE = 0.9;    // с — едет накатом
  const T_DRIVE = 3.0;     // с — всего до полной остановки
  const Z0 = 5;            // старт в 5 раз дальше конечной точки (масштаб 0.2)
  const ZF = 7.5;          // м — расстояние от камеры до машины в конце
  const DIST = (Z0 - 1) * ZF;                       // м — проезжает 30 м
  const V0 = DIST / (T_CRUISE + (T_DRIVE - T_CRUISE) / 2);   // ≈55 км/ч
  const DECEL = V0 / (T_DRIVE - T_CRUISE);          // м/с² — плавное торможение
  const STEP = 2 * Math.PI / 5;                     // период рисунка диска
  const WHEEL_R = 0.34;                              // м
  // полный угол — кратен шагу спиц, чтобы колесо встало ровно как на фото
  const THETA = Math.round(DIST / WHEEL_R / STEP) * STEP;

  function drive(t) {                    // t, с от начала движения → путь (0..1), скорость, замедление
    if (t <= 0) return { s: 0, v: V0, a: 0 };
    if (t < T_CRUISE) return { s: V0 * t / DIST, v: V0, a: 0 };
    if (t < T_DRIVE) {
      const tb = t - T_CRUISE;
      return { s: (V0 * T_CRUISE + V0 * tb - DECEL * tb * tb / 2) / DIST, v: V0 - DECEL * tb, a: DECEL };
    }
    return { s: 1, v: 0, a: 0 };
  }

  // подвеска: пружина с затуханием, которую раскачивает торможение
  let pitch = 0, pitchV = 0, lastT = 0;
  const W_SUSP = 2 * Math.PI * 1.5, ZETA = 0.32, DIVE = 0.05;   // ° на 1 м/с²

  const T_STOP = T0 + T_DRIVE * 1000;
  const T_LIGHTS = T_STOP + 450;         // фары
  const T_SCENE = T_LIGHTS + 750;        // порт, отражения
  const T_FLAGS = T_SCENE + 250;         // флаги
  const T_TEXT = T_FLAGS + 500;          // текст
  const T_END = T_TEXT + 2100;

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ease = (x) => x * x * (3 - 2 * x);

  // фары: моргнули → погасли → зажглись, как при запуске
  function lamp(ms) {
    if (ms < 0) return 0;
    if (ms < 70) return .75;
    if (ms < 160) return .06;
    if (ms < 230) return .95;
    if (ms < 300) return .4;
    return .55 + .45 * ease(clamp((ms - 300) / 380, 0, 1));
  }

  let t0 = 0, flagsOn = false, textOn = false;
  function frame(now) {
    if (finished) return;
    if (!t0) { t0 = now; lastT = now; }
    const ms = now - t0;

    // проявление из черноты
    black.style.opacity = 1 - ease(clamp(ms / 650, 0, 1));

    // движение
    const st = drive((ms - T0) / 1000);
    const z = 1 + (Z0 - 1) * (1 - st.s), k = 1 / z;
    car.style.transform = 'scale(' + k + ')';

    // колёса: угол = путь / радиус
    const th = THETA * st.s;
    const omega = st.v / WHEEL_R;         // рад/с
    const fi = Math.floor(((th % STEP) / STEP) * FRAMES) % FRAMES;
    rf.style.backgroundPosition = (-fi * L.rimF.w) + 'px 0';
    rr.style.backgroundPosition = (-fi * L.rimR.w) + 'px 0';
    const blur = clamp((omega - 7) / 13, 0, 1);   // на скорости спицы смазываются, как на камере
    rfb.style.opacity = rrb.style.opacity = blur;
    rf.style.opacity = rr.style.opacity = 1 - blur * .85;

    // подвеска (интегрируем мелкими шагами, чтобы не зависеть от частоты кадров)
    let dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240); dt -= h;
      const target = DIVE * drive((ms - T0) / 1000).a;
      const acc = -W_SUSP * W_SUSP * (pitch - target) - 2 * ZETA * W_SUSP * pitchV;
      pitchV += acc * h; pitch += pitchV * h;
    }
    const rumble = st.v > 0 ? Math.sin(ms * .047) * .35 + Math.sin(ms * .093) * .2 : 0;
    body.style.transform = 'translate3d(0,' + (pitch * 2.2 + rumble * (st.v / V0)).toFixed(2) + 'px,0) rotate(' + (-pitch).toFixed(3) + 'deg)';

    // издалека машина выплывает из темноты
    const fadeIn = clamp((k - .2) / .2, 0, 1);

    // фары
    const lv = lamp(ms - T_LIGHTS);

    // переход в обычную главную: машина, асфальт и свет растворяются в настоящую картинку
    const x = ease(clamp((ms - T_SCENE) / 1100, 0, 1));
    road.style.opacity = 1 - x;
    car.style.opacity = fadeIn * (1 - x);
    lights.style.opacity = lv * (1 - x);
    under.style.opacity = 1;

    if (!flagsOn && ms >= T_FLAGS) { flagsOn = true; d.classList.add('intro-flagsgo'); }
    if (!textOn && ms >= T_TEXT) { textOn = true; d.classList.add('intro-text'); }
    if (ms >= T_END) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  /* ---------- старт, когда всё загрузилось ---------- */
  const loaded = (img) => new Promise((res) => {
    if (img.complete && img.naturalWidth) return res();
    img.addEventListener('load', res, { once: true });
    img.addEventListener('error', res, { once: true });
  }).then(() => (img.decode ? img.decode().catch(() => {}) : null));
  const bg = (src) => { const i = new Image(); i.src = src; return i; };

  // если картинки грузятся слишком долго — просто показываем обычную главную
  const giveUp = setTimeout(() => { if (!started) finish(); }, 3200);

  Promise.all([
    loaded(pic.querySelector('img')), loaded(road.querySelector('img')), loaded(flags.querySelector('img')),
    loaded(body), loaded($('.intro-wheels')), loaded(under), loaded(lights),
    loaded(bg(DIR + 'rim-f.webp')), loaded(bg(DIR + 'rim-r.webp'))
  ]).then(() => {
    if (finished) return;
    started = true;
    clearTimeout(giveUp);
    requestAnimationFrame(() => {
      d.classList.add('intro-go');
      raf = requestAnimationFrame(frame);
    });
  });
})();
