/* Страница автомобиля: галерея, цена с утильсбором, характеристики и опции. */
(function () {
  const Model = window.CatalogModel;
  const Favs = window.Favs;
  const $ = (id) => document.getElementById(id);
  const esc = Model.escapeHtml;
  const fmt = (number) => Number(number).toLocaleString('ru-RU');
  const id = (new URLSearchParams(location.search).get('id') || '').trim();
  const PREVIEW_KEY = 'oncarclick-car-preview';

  const track = $('galTrack'), thumbs = $('galThumbs'), counter = $('galCount');
  const favBtn = $('carFav'), status = $('carStatus');
  const lightbox = $('lightbox'), lbTrack = $('lbTrack'), lbCount = $('lbCount');
  let car = null, photos = [], current = 0;

  // «Назад» возвращает в каталог с теми же фильтрами, если пришли оттуда
  const back = $('carBack');
  try { if (document.referrer && new URL(document.referrer).pathname.endsWith('/catalog.html')) back.href = document.referrer; } catch (e) {}
  if (/favorites\.html/.test(document.referrer)) { back.href = 'favorites.html'; back.lastChild.textContent = 'В избранное'; }

  /* ---------- Галерея ---------- */
  function renderGallery(list) {
    photos = list.length ? list : ['assets/img/catalog-car.webp'];
    track.innerHTML = photos.map(function (src, i) {
      return '<figure class="gal__slide"><img src="' + esc(src) + '" alt="' + esc(car ? car.name : '') + ', фото ' + (i + 1) + '"' +
        (i > 1 ? ' loading="lazy"' : ' fetchpriority="' + (i ? 'auto' : 'high') + '"') + ' decoding="async" data-zoom="' + i + '"></figure>';
    }).join('');
    thumbs.innerHTML = photos.length > 1 ? photos.map(function (src, i) {
      return '<button class="gal__thumb' + (i === 0 ? ' is-on' : '') + '" type="button" data-go="' + i + '" aria-label="Фото ' + (i + 1) + '"><img src="' + esc(src) + '" alt="" loading="lazy" decoding="async"></button>';
    }).join('') : '';
    $('gal').classList.toggle('is-single', photos.length < 2);
    paintCounter(0);
  }

  function paintCounter(index) {
    current = index;
    counter.textContent = photos.length > 1 ? (index + 1) + ' / ' + photos.length : '';
    thumbs.querySelectorAll('.gal__thumb').forEach(function (thumb, i) {
      const on = i === index;
      thumb.classList.toggle('is-on', on);
      if (on) thumb.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
  }

  function goTo(index, smooth) {
    const target = Math.max(0, Math.min(photos.length - 1, index));
    track.scrollTo({ left: target * track.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
  }

  let scrollTimer;
  track.addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { paintCounter(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))); }, 60);
  }, { passive: true });
  document.querySelectorAll('.gal__nav').forEach(function (btn) {
    btn.addEventListener('click', function () { goTo(current + Number(btn.dataset.dir)); });
  });
  thumbs.addEventListener('click', function (event) {
    const thumb = event.target.closest('[data-go]');
    if (thumb) goTo(Number(thumb.dataset.go));
  });
  track.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight') goTo(current + 1);
    if (event.key === 'ArrowLeft') goTo(current - 1);
  });

  /* ---------- Полноэкранный просмотр ---------- */
  function openLightbox(index) {
    lbTrack.innerHTML = photos.map(function (src, i) {
      return '<figure class="lightbox__slide"><img src="' + esc(src) + '" alt="Фото ' + (i + 1) + '" decoding="async"' + (Math.abs(i - index) > 1 ? ' loading="lazy"' : '') + '></figure>';
    }).join('');
    lightbox.hidden = false;
    document.body.classList.add('sheet-open');
    requestAnimationFrame(function () {
      lightbox.classList.add('is-open');
      lbTrack.scrollTo({ left: index * lbTrack.clientWidth, behavior: 'auto' });
      lbCount.textContent = (index + 1) + ' / ' + photos.length;
    });
    $('lbClose').focus({ preventScroll: true });
  }
  function closeLightbox() {
    if (lightbox.hidden) return;
    const index = Math.round(lbTrack.scrollLeft / Math.max(1, lbTrack.clientWidth));
    lightbox.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    setTimeout(function () { lightbox.hidden = true; lbTrack.innerHTML = ''; }, 200);
    goTo(index, false);
  }
  let lbTimer;
  lbTrack.addEventListener('scroll', function () {
    clearTimeout(lbTimer);
    lbTimer = setTimeout(function () { lbCount.textContent = (Math.round(lbTrack.scrollLeft / Math.max(1, lbTrack.clientWidth)) + 1) + ' / ' + photos.length; }, 60);
  }, { passive: true });
  track.addEventListener('click', function (event) {
    const img = event.target.closest('[data-zoom]');
    if (img) openLightbox(Number(img.dataset.zoom));
  });
  $('lbClose').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', function (event) {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      lbTrack.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * lbTrack.clientWidth, behavior: 'smooth' });
    }
  });

  /* ---------- Данные ---------- */
  const chip = (icon, text) => text ? '<li><svg class="icon" aria-hidden="true"><use href="#i-' + icon + '"/></svg>' + esc(text) + '</li>' : '';

  function renderMain(data) {
    car = Model.normalizeCar(data);
    document.title = car.name + (car.year ? ' ' + car.year : '') + ' — OnCarClick';
    $('carTitle').textContent = car.name;
    $('carSub').textContent = [car.trim, car.generation].filter(Boolean).join(' · ');
    $('carLot').textContent = car.id ? 'Лот ' + car.id : '';
    $('carChips').innerHTML = [
      chip('star', car.year ? car.year + ' г.' : ''),
      chip('route', car.km ? fmt(car.km) + ' км' : ''),
      chip('bolt', car.engine ? Model.engineLabel(car.engine) + (data.powerHp ? ' · ' + data.powerHp + ' л.с.' : '') : ''),
      chip('car', car.fuel)
    ].join('');

    const box = $('priceBox');
    box.hidden = !car.price;
    if (car.price) {
      $('priceTotal').textContent = fmt(car.price) + ' ₽';
      $('priceLines').innerHTML =
        (car.basePrice ? '<div><dt>Автомобиль с доставкой и таможней</dt><dd>' + fmt(car.basePrice) + ' ₽</dd></div>' : '') +
        '<div><dt>Утилизационный сбор</dt><dd>' + (car.fee ? fmt(car.fee) + ' ₽' : 'уточним при расчёте') + '</dd></div>';
    }
    paintFav();
  }

  function renderDetails(data) {
    const main = [
      ['Год выпуска', data.year ? String(data.year) + (data.month ? ' (' + String(data.month).padStart(2, '0') + ')' : '') : ''],
      ['Пробег', data.mileageKm ? fmt(data.mileageKm) + ' км' : ''],
      ['Двигатель', data.engineCc ? fmt(data.engineCc) + ' см³' : ''],
      ['Мощность', data.powerHp ? data.powerHp + ' л.с.' : ''],
      ['Топливо', data.fuel], ['Коробка', data.transmission], ['Привод', data.drive], ['Кузов', data.bodyType],
      ['Цвет кузова', data.exteriorColor], ['Цвет салона', data.interiorColor], ['Поколение', data.generation],
      ['Комплектация', data.trim], ['Дата регистрации', data.details && data.details.registration],
      ['ДТП по страховой', data.details && data.details.accidentCount != null ? (data.details.accidentCount ? data.details.accidentCount + ' случ.' : 'нет') : '']
    ].filter(function (row) { return row[1]; });
    // Значения со страницы источника — на русском, ими заменяем английские из каталога
    const synonyms = { 'кпп': 'коробка', 'тип топлива': 'топливо', 'объём двигателя': 'двигатель', 'объем двигателя': 'двигатель',
      'год': 'год выпуска', 'дата регистрации в корее': 'дата регистрации' };
    const keep = { 'двигатель': true, 'пробег': true, 'год выпуска': true, 'мощность': true };
    const index = new Map(main.map(function (row, i) { return [row[0].toLowerCase(), i]; }));
    (data.specs || []).forEach(function (row) {
      const key = synonyms[row.label.toLowerCase()] || row.label.toLowerCase();
      if (index.has(key)) { if (!keep[key]) main[index.get(key)][1] = row.value; return; }
      index.set(key, main.length);
      main.push([row.label, row.value]);
    });
    $('specsCard').hidden = !main.length;
    $('specs').innerHTML = main.map(function (row) { return '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd></div>'; }).join('');

    const insurance = /^0\s*\/\s*0\b/.test(data.insurance || '') ? 'Страховых случаев и выплат не зафиксировано.' : data.insurance;
    $('insuranceCard').hidden = !insurance;
    $('insurance').textContent = insurance || '';

    const groups = data.optionGroups || [];
    $('optionsCard').hidden = !groups.length;
    $('optGroups').innerHTML = groups.map(function (group, i) {
      return '<details class="optgroup"' + (i === 0 ? ' open' : '') + '><summary>' + esc(group.title) + '<span>' + group.items.length + '</span><svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg></summary>' +
        '<ul>' + group.items.map(function (item) { return '<li><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>' + esc(item) + '</li>'; }).join('') + '</ul></details>';
    }).join('');
  }

  $('carAsk').addEventListener('click', function () {
    if (car) { try { localStorage.setItem('car', car.name + ', ' + (car.year || '') + ' (лот ' + car.id + ')'); } catch (e) {} }
  });

  /* ---------- Избранное и «поделиться» ---------- */
  function paintFav() {
    const on = car && Favs.has(car.id);
    favBtn.classList.toggle('is-on', Boolean(on));
    favBtn.setAttribute('aria-pressed', String(Boolean(on)));
    favBtn.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное');
  }
  favBtn.addEventListener('click', function () {
    if (!car) return;
    const on = Favs.toggle(car);
    paintFav();
    if (on) { favBtn.classList.remove('is-pop'); void favBtn.offsetWidth; favBtn.classList.add('is-pop'); }
    if (window.toast) toast(on ? 'Добавлено в избранное' : 'Удалено из избранного');
  });
  $('carShare').addEventListener('click', function () {
    const data = { title: car ? car.name : 'OnCarClick', url: location.href };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { if (window.toast) toast('Ссылка скопирована'); });
  });

  /* ---------- Загрузка ---------- */
  function fail(message) {
    $('carTitle').textContent = message;
    status.textContent = '';
    $('gal').hidden = true;
    document.querySelector('.carview__actions').innerHTML = '<a class="btn btn--red btn--block" href="catalog.html">Вернуться в каталог</a>';
  }

  if (!/^\d{4,12}$/.test(id)) { fail('Автомобиль не найден'); return; }

  // Мгновенный показ по данным из карточки каталога, пока грузится полная версия
  let preview = null;
  try { preview = JSON.parse(sessionStorage.getItem(PREVIEW_KEY) || 'null'); } catch (e) {}
  if (!preview || String(preview.id) !== id) preview = Favs.list().find(function (item) { return item.id === id; }) || null;
  if (preview) {
    const raw = preview.make ? preview : { id: preview.id, make: preview.name, model: '', trim: preview.trim, generation: preview.generation, year: preview.year,
      mileageKm: preview.km, engineCc: preview.engine, fuel: preview.fuel, priceRub: preview.price, priceBaseRub: preview.basePrice,
      recyclingFeeRub: preview.fee, photos: preview.photo ? [preview.photo] : [] };
    renderMain(raw);
    renderGallery(Array.isArray(raw.photos) ? raw.photos : []);
  }
  status.textContent = 'Загружаем все фотографии и характеристики…';

  fetch('/api/car?id=' + encodeURIComponent(id), { headers: { Accept: 'application/json' } }).then(function (response) {
    return response.json().then(function (data) { return { ok: response.ok, status: response.status, data: data }; });
  }).then(function (result) {
    if (!result.ok) {
      if (preview) { status.textContent = result.data.message || 'Не удалось загрузить подробности.'; return; }
      fail(result.data.message || 'Автомобиль не найден');
      return;
    }
    const data = result.data;
    renderMain(data);
    const keep = current;
    renderGallery((data.photos || []).filter(function (src) { return /^https:\/\/trust-encar\.ru\//.test(src); }));
    if (keep) goTo(keep, false);
    renderDetails(data);
    Favs.refresh([car]);
    status.textContent = '';
  }).catch(function () {
    status.textContent = 'Нет связи с сервером. Попробуйте обновить страницу.';
    if (!preview) fail('Не удалось загрузить автомобиль');
  });
})();
