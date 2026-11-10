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
      price: Number(raw.priceRub) || null,
      photo: safePhoto(Array.isArray(raw.photos) ? raw.photos[0] : '')
    };
  }

  function engineLabel(engineCc) {
    const value = Number(engineCc);
    return value > 0 ? (value / 1000).toFixed(1) + ' л' : 'Объём не указан';
  }

  function buildCatalogUrl(filters, page) {
    const params = new URLSearchParams({ page: String(page || 1), limit: '24' });
    if (filters.brand) params.set('make', filters.brand);
    if (filters.model) params.set('model', filters.model);
    if (filters.engine) params.set('engine', filters.engine);
    params.set('sort', sortMap[filters.sort] || 'newest');
    return '/api/catalog?' + params.toString();
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

  return { buildCatalogUrl, engineBuckets, engineLabel, escapeHtml, normalizeCar, plural };
});
