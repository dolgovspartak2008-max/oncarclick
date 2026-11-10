/* Главная: слайдер отзывов, FAQ */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

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

  // FAQ: открыт только один ответ за раз — меньше текста на экране
  const faqItems = $$('.faq__item');
  faqItems.forEach(d => d.addEventListener('toggle', () => {
    if (d.open) faqItems.forEach(o => { if (o !== d) o.open = false; });
  }));

  // «Оставить отзыв» — подсказка в форме
  $$('[data-review]').forEach(a => a.addEventListener('click', () => {
    const cm = $('#fComment');
    if (cm && !cm.value) cm.value = 'Хочу оставить отзыв: ';
  }));
})();
