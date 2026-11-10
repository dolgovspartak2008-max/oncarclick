/* Главная: слайдер отзывов, FAQ */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---- Отзывы: настоящие отзывы из Telegram-бота заменяют карточки-примеры ----
  const track = $('#revTrack'), dots = $('#revDots');
  const escHtml = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const star = '<svg class="icon icon--fill" aria-hidden="true"><use href="#i-star"/></svg>';
  function reviewCard(r) {
    const date = r.date ? new Date(r.date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : '';
    const meta = [r.city, date].filter(Boolean).map(escHtml).join(' · ');
    const rating = Math.max(1, Math.min(5, Number(r.rating) || 5));
    return `<article class="card review">
        <div class="review__photo">${r.photo ? `<img src="${escHtml(r.photo)}" alt="${escHtml(r.car || 'Автомобиль клиента')}" loading="lazy" decoding="async">` : '<span><svg class="icon" aria-hidden="true"><use href="#i-car"/></svg>OnCarClick</span>'}</div>
        <div class="review__head">
          <span class="review__ava review__ava--letter">${escHtml(String(r.name || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="review__who"><b>${escHtml(r.name)}</b><span>${meta}</span></span>
        </div>
        <div class="review__stars" aria-label="Оценка ${rating} из 5">${star.repeat(rating)}</div>
        <p class="review__text">${escHtml(r.text)}</p>
        ${r.car || r.country ? `<div class="review__car"><svg class="icon" aria-hidden="true"><use href="#i-car"/></svg><span>${escHtml(r.car || '')}</span>${r.country ? `<span class="badge">${escHtml(r.country)}</span>` : ''}</div>` : ''}
      </article>`;
  }
  function initSlider() {
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
  if (track) {
    fetch('/api/reviews', { headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : { reviews: [] })
      .then((data) => { if (data.reviews && data.reviews.length) track.innerHTML = data.reviews.map(reviewCard).join(''); })
      .catch(() => {})
      .finally(initSlider);
  }

  // FAQ: открыт только один ответ за раз — меньше текста на экране
  // FAQ свёрнут: по кнопке раскрывается весь список вопросов
  const faqBtn = $('.faq-toggle'), faqWrap = $('#faqList');
  if (faqBtn && faqWrap) faqBtn.addEventListener('click', () => {
    const open = faqBtn.getAttribute('aria-expanded') !== 'true';
    faqBtn.setAttribute('aria-expanded', String(open));
    faqWrap.classList.toggle('is-open', open);
    faqBtn.querySelector('b').textContent = open ? 'Скрыть вопросы' : 'Показать все вопросы';
    if (!open) $$('.faq__item').forEach(d => { d.open = false; });
  });
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
