/* Страница «Избранное»: машины, отмеченные сердечком в каталоге. */
(function () {
  const Model = window.CatalogModel;
  const Favs = window.Favs;
  const grid = document.getElementById('favCars');
  const toolbar = document.getElementById('favToolbar');
  const countEl = document.getElementById('favCount');
  const clearBtn = document.getElementById('favClear');
  const fmt = (number) => Number(number).toLocaleString('ru-RU');

  function cardMarkup(car) {
    const name = Model.escapeHtml(car.name);
    const extra = car.trim ? ' · ' + Model.escapeHtml(car.trim) : '';
    const photo = car.photo || 'assets/img/catalog-car.webp';
    const fee = car.fee ? 'вкл. утильсбор ' + fmt(car.fee) + ' ₽' : (car.price ? 'утильсбор уточним при расчёте' : '');
    return `
      <article class="car">
        <div class="car__img">
          <img class="car__photo" src="${Model.escapeHtml(photo)}" alt="${name}" loading="lazy" decoding="async">
          <span class="badge">Корея</span>
          <button class="fav is-on" type="button" data-fav="${Model.escapeHtml(car.id)}" aria-pressed="true" aria-label="Убрать из избранного"><svg class="icon"><use href="#i-heart"/></svg></button>
        </div>
        <div class="car__body">
          <h3 class="car__name">${name}</h3>
          <p class="car__meta">${car.year || 'Год не указан'} · ${fmt(car.km || 0)} км · ${Model.engineLabel(car.engine)}${extra}</p>
          <p class="car__price">${car.price ? fmt(car.price) + ' ₽<small>до Владивостока</small>' : 'Цена по запросу'}</p>
          ${fee ? `<p class="car__fee">${fee}</p>` : ''}
        </div>
        <a class="car__link" href="car.html?id=${encodeURIComponent(car.id)}" aria-label="Подробнее: ${name}" data-open="${Model.escapeHtml(car.id)}"></a>
      </article>`;
  }

  function render() {
    const cars = Favs.list();
    toolbar.hidden = !cars.length;
    countEl.textContent = cars.length ? `${cars.length} ${Model.plural(cars.length, 'автомобиль', 'автомобиля', 'автомобилей')}` : '';
    grid.innerHTML = cars.length ? cars.map(cardMarkup).join('') : `
      <div class="fav-empty empty">
        <svg class="icon" aria-hidden="true"><use href="#i-heart"/></svg>
        <p>Здесь пока пусто. Нажмите на сердечко у понравившейся машины в каталоге — она появится в этом списке.</p>
        <a class="btn btn--red" href="catalog.html">Перейти в каталог</a>
      </div>`;
  }

  grid.addEventListener('click', function (event) {
    const favorite = event.target.closest('[data-fav]');
    if (favorite) {
      event.preventDefault();
      Favs.remove(favorite.dataset.fav);
      render();
      if (window.toast) toast('Удалено из избранного');
      return;
    }
    const link = event.target.closest('[data-open]');
    if (link) { try { sessionStorage.removeItem('oncarclick-car-preview'); } catch (e) {} }
  });

  clearBtn.addEventListener('click', function () {
    Favs.list().forEach(function (car) { Favs.remove(car.id); });
    render();
  });

  window.addEventListener('storage', function (event) { if (event.key === Favs.KEY) render(); });
  render();
})();
