/* Главная: выбор возраста в каталоге, слайдер отзывов */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---- Каталог: счётчики и раскрывающийся выбор ----
  const cars = window.CARS || [];
  $$('[data-total-count]').forEach(el => el.textContent = cars.length);
  $$('[data-age-count]').forEach(el => {
    const n = cars.filter(AGE_GROUPS[el.dataset.ageCount].test).length;
    el.textContent = `${n} ${plural(n, 'авто', 'авто', 'авто')}`;
  });

  const btn = $('#catOpen'), chooser = $('#ageChooser');
  function setChooser(open, scroll) {
    chooser.classList.toggle('is-open', open);
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open && scroll) {
      setTimeout(() => {
        const r = chooser.getBoundingClientRect();
        if (r.bottom > innerHeight) window.scrollBy({ top: Math.min(r.bottom - innerHeight + 16, r.top - 80), behavior: 'smooth' });
      }, 320);
    }
  }
  window.openChooser = () => setChooser(true, false);
  btn && btn.addEventListener('click', () => setChooser(!chooser.classList.contains('is-open'), true));

  // «Подобрать авто» — сразу открываем выбор
  $$('[data-open-catalog]').forEach(a => a.addEventListener('click', () => setChooser(true, false)));
  if (location.hash === '#catalog') setChooser(true, false);

  // ---- Отзывы: слайдер ----
  const track = $('#revTrack'), dots = $('#revDots');
  if (track) {
    const cards = $$('.review', track);
    dots.innerHTML = cards.map((_, i) => `<button type="button" aria-label="Отзыв ${i + 1}"></button>`).join('');
    const dotBtns = $$('button', dots);
    const step = () => cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 12);
    const current = () => Math.round(track.scrollLeft / step());
    const paint = () => { const c = Math.min(current(), cards.length - 1); dotBtns.forEach((d, i) => d.classList.toggle('is-active', i === c)); };
    dotBtns.forEach((d, i) => d.addEventListener('click', () => track.scrollTo({ left: i * step(), behavior: 'smooth' })));
    $$('.slider__btn').forEach(b => b.addEventListener('click', () => track.scrollBy({ left: step() * +b.dataset.dir, behavior: 'smooth' })));
    track.addEventListener('scroll', () => requestAnimationFrame(paint), { passive: true });
    paint();
  }

  // «Оставить отзыв» — подсказка в форме
  $$('[data-review]').forEach(a => a.addEventListener('click', () => {
    const cm = $('#fComment');
    if (cm && !cm.value) cm.value = 'Хочу оставить отзыв: ';
  }));
})();
