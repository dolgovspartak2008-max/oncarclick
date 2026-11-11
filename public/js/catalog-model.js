(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CatalogModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const sortMap = { pop: 'newest', new: 'newest', cheap: 'price-asc', exp: 'price-desc' };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function safePhoto(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' && url.hostname === 'trust-encar.ru' ? url.href : '';
    } catch (e) { return ''; }
  }

  function normalizeCar(raw) {
    const make = String(raw.make || '').trim();
    const model = String(raw.model || '').trim();
    return {
      id: String(raw.id || ''),
      name: [make, model].filter(Boolean).join(' '),
      trim: String(raw.trim || '').trim(),
      year: Number(raw.year) || 0,
      km: Number(raw.mileageKm) || 0,
      engine: Number(raw.engineCc) || null,
      fuel: String(raw.fuel || '').trim(),
      drive: String(raw.drive || '').trim(),
      generation: String(raw.generation || '').trim(),
      price: Number(raw.priceRub) || null,
      basePrice: Number(raw.priceBaseRub) || null,
      fee: raw.recyclingFeeRub == null ? null : Number(raw.recyclingFeeRub),
      // пошлина считается на сервере (src/domain/customs-duty.ts); здесь только отображение
      duty: raw.dutyRub == null ? null : Number(raw.dutyRub),
      dutyOfficial: raw.customs && raw.customs.officialDutyRub != null ? Number(raw.customs.officialDutyRub) : null,
      dutyAdjustment: raw.customs && raw.customs.commercialAdjustmentRub ? Number(raw.customs.commercialAdjustmentRub) : 0,
      dutyStatus: raw.customs ? String(raw.customs.calculationStatus || '') : '',
      // машина в Корее + расходы OnCarClick (src/domain/expenses.ts)
      koreaPrice: Number(raw.carPriceKoreaRub) || null,
      expenses: raw.expenses && Array.isArray(raw.expenses.items) ? raw.expenses.items.map(function (item) {
        return { label: String(item.label || ''), rub: Number(item.rub) || 0 };
      }) : null,
      optional: raw.expenses && Array.isArray(raw.expenses.optionalItems) ? raw.expenses.optionalItems.map(function (item) {
        return { label: String(item.label || ''), rub: Number(item.rub) || 0 };
      }) : [],
      moscow: raw.expenses && raw.expenses.moscowDeliveryRub ? Number(raw.expenses.moscowDeliveryRub) : null,
      photo: safePhoto(Array.isArray(raw.photos) ? raw.photos[0] : '')
    };
  }

  /** Подпись под ценой в карточке: что уже входит в цену (суммы — на странице машины). */
  function priceNote(car) {
    if (!car.price) return '';
    const included = [], pending = [];
    (car.duty && car.dutyStatus !== 'needs_review' ? included : pending).push('пошлину');
    (car.fee ? included : pending).push('утильсбор');
    return (included.length ? 'вкл. ' + included.join(' и ') : '') +
      (pending.length ? (included.length ? '; ' : '') + pending.join(' и ') + ' уточним при расчёте' : '');
  }

  function engineLabel(engineCc) {
    const value = Number(engineCc);
    return value > 0 ? (value / 1000).toFixed(1) + ' л' : 'Объём не указан';
  }

  const FILTER_KEYS = [
    ['brand', 'make'], ['model', 'model'], ['generation', 'generation'], ['trim', 'trim'],
    ['yearFrom', 'yearFrom'], ['yearTo', 'yearTo'], ['mileageTo', 'mileageTo'], ['engine', 'engine'],
    ['priceFrom', 'priceFrom'], ['priceTo', 'priceTo']
  ];

  function filterParams(filters) {
    const params = new URLSearchParams();
    FILTER_KEYS.forEach(function (pair) {
      const value = filters[pair[0]];
      if (value !== undefined && value !== null && value !== '') params.set(pair[1], String(value));
    });
    return params;
  }

  function buildCatalogUrl(filters, page) {
    const params = new URLSearchParams({ page: String(page || 1), limit: '24' });
    filterParams(filters).forEach(function (value, key) { params.set(key, value); });
    params.set('sort', sortMap[filters.sort] || 'newest');
    return '/api/catalog?' + params.toString();
  }

  function buildCountUrl(filters) {
    const params = filterParams(filters);
    params.set('count', '1');
    return '/api/catalog?' + params.toString();
  }

  function buildOptionsUrl(filters) {
    const params = new URLSearchParams();
    if (filters.brand) params.set('make', filters.brand);
    if (filters.model) params.set('model', filters.model);
    if (filters.generation) params.set('generation', filters.generation);
    return '/api/catalog/options?' + params.toString();
  }

  /** Фильтры из адресной строки (?make=…&yearFrom=…) — чтобы ссылкой можно было поделиться. */
  function filtersFromQuery(search) {
    const query = new URLSearchParams(search || '');
    const out = {};
    FILTER_KEYS.forEach(function (pair) {
      const value = query.get(pair[1]) || (pair[0] === 'brand' ? query.get('brand') : null);
      if (value) out[pair[0]] = value;
    });
    return out;
  }

  function yearLabel(from, to) {
    if (from && to) return from === to ? String(from) : from + ' – ' + to;
    if (from) return 'от ' + from;
    if (to) return 'до ' + to;
    return '';
  }

  function mileageLabel(km) {
    return km ? 'до ' + Number(km).toLocaleString('ru-RU') + ' км' : '';
  }

  /** «1,5 млн», «800 тыс.» — коротко для плитки фильтра. */
  function shortRub(value) {
    const n = Number(value);
    if (n >= 1000000) return String(Math.round(n / 100000) / 10).replace('.', ',') + ' млн';
    if (n >= 1000) return Math.round(n / 1000) + ' тыс.';
    return String(n);
  }

  function priceLabel(from, to) {
    if (from && to) return shortRub(from) + ' – ' + shortRub(to) + ' ₽';
    if (from) return 'от ' + shortRub(from) + ' ₽';
    if (to) return 'до ' + shortRub(to) + ' ₽';
    return '';
  }

  function plural(number, one, few, many) {
    const last = number % 10, lastTwo = number % 100;
    if (last === 1 && lastTwo !== 11) return one;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
    return many;
  }

  function engineBuckets(values) {
    return Array.from(new Set(values.map(Number).filter(function (value) { return value > 0; }).map(function (value) {
      return Math.round(value / 100) * 100;
    }))).sort(function (a, b) { return a - b; });
  }

  return { buildCatalogUrl, buildCountUrl, buildOptionsUrl, filtersFromQuery, filterParams, yearLabel, mileageLabel, engineBuckets, engineLabel, escapeHtml, normalizeCar, plural, priceNote, priceLabel, shortRub };
});
