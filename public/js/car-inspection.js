/* Технический лист автомобиля: схема кузова по отчёту осмотра Encar (성능점검) и сведения отчёта.
   Данные — только из ответа /api/car (поле inspection). Ничего не дорисовываем: элемент без отметок
   в отчёте показан нейтральным, неизвестное место детали на схеме не ставим (деталь остаётся в списке). */
(function () {
  const esc = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  };
  const fmt = function (n) { return Number(n).toLocaleString('ru-RU'); };

  /* Обозначения Encar. Порядок — по серьёзности: им определяется цвет элемента с несколькими отметками. */
  const KINDS = [
    { kind: 'replacement', code: 'X', label: 'Замена', hint: 'Элемент заменён на другой.' },
    { kind: 'repair', code: 'W', label: 'Ремонт: рихтовка / сварка', hint: 'Листовой ремонт или сварочные работы (판금/용접).' },
    { kind: 'cut-weld', code: 'WC', label: 'Сварка / резка', hint: '' },
    { kind: 'damage', code: 'T', label: 'Повреждение', hint: 'Повреждение элемента (손상).' },
    { kind: 'dent', code: 'U', label: 'Неровность / вмятина', hint: 'Неровность поверхности, вмятина (요철).' },
    { kind: 'corrosion', code: 'C', label: 'Коррозия', hint: 'Следы коррозии (부식).' },
    { kind: 'scratch', code: 'A', label: 'Царапина', hint: 'Царапина (흠집).' },
    { kind: 'paint', code: '', label: 'Окраска', hint: '' },
    { kind: 'other', code: '', label: 'Другая отметка', hint: '' }
  ];
  const RANK = {}; KINDS.forEach(function (item, i) { RANK[item.kind] = i; });

  /* Схема: вид сверху, перед автомобиля вверху. Левая сторона автомобиля — слева на схеме. */
  const R = function (x, y, w, h, r) { return { x: x, y: y, w: w, h: h, r: r == null ? 6 : r }; };
  const OUTER = [
    { id: 'bumper-f', name: 'Передний бампер', shape: R(46, 12, 108, 18, 9), off: true },
    { id: 'radiator', name: 'Рамка радиатора (болтовое крепление)', shape: R(58, 32, 84, 9, 3) },
    { id: 'hood', name: 'Капот', shape: { d: 'M58 44 H142 L148 120 H52 Z' } },
    { id: 'fender-l', name: 'Переднее крыло (левое)', shape: { d: 'M34 42 Q36 34 46 32 L54 32 L49 124 H32 Z' } },
    { id: 'fender-r', name: 'Переднее крыло (правое)', shape: { d: 'M166 42 Q164 34 154 32 L146 32 L151 124 H168 Z' } },
    { id: 'glass-f', name: '', shape: { d: 'M54 124 H146 L140 160 H60 Z' }, glass: true },
    { id: 'roof', name: 'Крыша', shape: R(62, 163, 76, 104, 6) },
    { id: 'glass-r', name: '', shape: { d: 'M60 270 H140 L146 296 H54 Z' }, glass: true },
    { id: 'door-fl', name: 'Передняя дверь (левая)', shape: R(32, 127, 25, 74, 4) },
    { id: 'door-rl', name: 'Задняя дверь (левая)', shape: R(32, 204, 25, 70, 4) },
    { id: 'door-fr', name: 'Передняя дверь (правая)', shape: R(143, 127, 25, 74, 4) },
    { id: 'door-rr', name: 'Задняя дверь (правая)', shape: R(143, 204, 25, 70, 4) },
    { id: 'sill-l', name: 'Порог (левый)', shape: R(22, 127, 8, 147, 3) },
    { id: 'sill-r', name: 'Порог (правый)', shape: R(170, 127, 8, 147, 3) },
    { id: 'quarter-l', name: 'Заднее крыло (левое)', shape: { d: 'M32 277 H51 L54 360 Q42 360 36 352 Q32 346 32 338 Z' } },
    { id: 'quarter-r', name: 'Заднее крыло (правое)', shape: { d: 'M168 277 H149 L146 360 Q158 360 164 352 Q168 346 168 338 Z' } },
    { id: 'trunk', name: 'Крышка багажника / задняя дверь', shape: R(56, 299, 88, 61, 6) },
    { id: 'bumper-r', name: 'Задний бампер', shape: R(46, 364, 108, 18, 9), off: true }
  ];
  const FRAME = [
    { id: 'cross-member', name: 'Передняя поперечина', shape: R(48, 14, 104, 12, 4) },
    { id: 'front-panel', name: 'Передняя панель', shape: R(54, 29, 92, 12, 4) },
    { id: 'side-member-l', name: 'Лонжерон (левый)', shape: R(46, 44, 12, 98, 4) },
    { id: 'side-member-r', name: 'Лонжерон (правый)', shape: R(142, 44, 12, 98, 4) },
    { id: 'inside-panel-l', name: 'Брызговик / внутренняя панель (левая)', shape: R(61, 48, 16, 88, 4) },
    { id: 'inside-panel-r', name: 'Брызговик / внутренняя панель (правая)', shape: R(123, 48, 16, 88, 4) },
    { id: 'wheel-house-fl', name: 'Передняя колёсная арка (левая)', shape: R(24, 62, 19, 52, 8) },
    { id: 'wheel-house-fr', name: 'Передняя колёсная арка (правая)', shape: R(157, 62, 19, 52, 8) },
    { id: 'dash', name: 'Моторный щит', shape: R(58, 145, 84, 11, 4) },
    { id: 'pillar-a-l', name: 'Стойка A (левая)', shape: R(36, 150, 12, 22, 3) },
    { id: 'pillar-a-r', name: 'Стойка A (правая)', shape: R(152, 150, 12, 22, 3) },
    { id: 'pillar-b-l', name: 'Стойка B (левая)', shape: R(36, 206, 12, 22, 3) },
    { id: 'pillar-b-r', name: 'Стойка B (правая)', shape: R(152, 206, 12, 22, 3) },
    { id: 'pillar-c-l', name: 'Стойка C (левая)', shape: R(36, 262, 12, 22, 3) },
    { id: 'pillar-c-r', name: 'Стойка C (правая)', shape: R(152, 262, 12, 22, 3) },
    { id: 'floor', name: 'Панель пола', shape: R(58, 160, 84, 120, 6) },
    { id: 'wheel-house-rl', name: 'Задняя колёсная арка (левая)', shape: R(24, 292, 19, 52, 8) },
    { id: 'wheel-house-rr', name: 'Задняя колёсная арка (правая)', shape: R(157, 292, 19, 52, 8) },
    { id: 'package-tray', name: 'Полка багажника', shape: R(58, 284, 84, 11, 4) },
    { id: 'trunk-floor', name: 'Пол багажника', shape: R(58, 299, 84, 52, 6) },
    { id: 'rear-panel', name: 'Задняя панель', shape: R(48, 356, 104, 14, 4) }
  ];

  const outline = '<path class="tscheme__body" d="M100 6 C142 6 170 14 172 44 L176 120 L176 290 L172 352 C170 380 142 390 100 390 C58 390 30 380 28 352 L24 290 L24 120 L28 44 C30 14 58 6 100 6 Z"/>';

  function shapeSvg(shape) {
    if (shape.d) return '<path d="' + shape.d + '"/>';
    return '<rect x="' + shape.x + '" y="' + shape.y + '" width="' + shape.w + '" height="' + shape.h + '" rx="' + shape.r + '"/>';
  }
  function centerOf(shape) {
    if (!shape.d) return [shape.x + shape.w / 2, shape.y + shape.h / 2];
    const nums = shape.d.match(/-?\d+(\.\d+)?/g).map(Number);
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i + 1 < nums.length; i += 2) { sx += nums[i]; sy += nums[i + 1]; n++; }
    return [sx / n, sy / n];
  }

  function worst(statuses) {
    return statuses.reduce(function (best, s) { return RANK[s.kind] < RANK[best] ? s.kind : best; }, 'other');
  }

  function schemeSvg(zones, byZone, title) {
    const items = zones.map(function (zone) {
      if (zone.glass) return '<g class="tz tz--glass" aria-hidden="true">' + shapeSvg(zone.shape) + '</g>';
      const marks = byZone[zone.id] || [];
      const statuses = [].concat.apply([], marks.map(function (part) { return part.statuses; }));
      const kind = statuses.length ? worst(statuses) : '';
      const codes = Array.from(new Set(statuses.map(function (s) { return s.code; })));
      const label = zone.name + (zone.off ? ' — не входит в осмотр' : statuses.length ? ' — ' + statuses.map(function (s) { return s.label; }).join(', ') : ' — отметок нет');
      const c = centerOf(zone.shape);
      const badge = codes.length
        ? '<text class="tz__code" x="' + c[0].toFixed(1) + '" y="' + (c[1] + 3.5).toFixed(1) + '">' + esc(codes.join('·')) + '</text>' : '';
      return '<g class="tz' + (zone.off ? ' tz--off' : '') + (kind ? ' tz--marked tz--' + kind : '') + '" data-zone="' + zone.id + '" role="button" tabindex="0" aria-label="' + esc(label) + '">' +
        shapeSvg(zone.shape) + badge + '</g>';
    }).join('');
    return '<figure class="tscheme"><svg viewBox="0 0 200 396" role="group" aria-label="' + esc(title) + '">' + outline + items +
      '</svg><figcaption>' + esc(title) + '<small>вид сверху, перед — вверху</small></figcaption></figure>';
  }

  function statusChips(statuses) {
    return statuses.map(function (s) {
      return '<span class="tstatus tstatus--' + s.kind + '"><b>' + esc(s.code) + '</b>' + esc(s.label) + '</span>';
    }).join('');
  }

  function rowsHtml(rows) {
    return '<dl class="tsheet__rows">' + rows.map(function (row) {
      return '<div><dt>' + esc(row.label) + '</dt><dd class="tone--' + esc(row.tone) + '">' + esc(row.value) + '</dd></div>';
    }).join('') + '</dl>';
  }

  function checksHtml(checks) {
    const sections = [];
    const map = {};
    checks.forEach(function (row) {
      const key = row.section || 'Прочее';
      if (!map[key]) { map[key] = []; sections.push(key); }
      map[key].push(row);
    });
    return sections.map(function (key) {
      const rows = map[key];
      const issues = rows.filter(function (row) { return row.tone === 'bad' || row.tone === 'warning'; }).length;
      return '<details class="optgroup tsheet__check"' + (issues ? ' open' : '') + '><summary>' + esc(key) +
        '<span class="' + (issues ? 'tone--warning' : '') + '">' + (issues ? 'замечаний: ' + issues : 'без замечаний') + '</span>' +
        '<svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg></summary>' + rowsHtml(rows) + '</details>';
    }).join('');
  }

  const SOURCE = 'Технический осмотр Encar (성능점검)';

  function render(root, data) {
    const ins = data && data.inspection;
    if (!ins) {
      root.innerHTML = '<p class="dcard__text">Информация о техническом состоянии отсутствует.</p>' +
        (data && data.inspectionChecked === false ? '<p class="tsheet__note">Источник временно не ответил — попробуйте обновить страницу позже.</p>' : '');
      return;
    }

    const parts = ins.parts || [];
    const byZone = {};
    parts.forEach(function (part) { if (part.zone) (byZone[part.zone] = byZone[part.zone] || []).push(part); });

    const head = [];
    if (ins.issuedAt) head.push(['Дата осмотра', ins.issuedAt]);
    if (ins.mileageKm) head.push(['Пробег при осмотре', fmt(ins.mileageKm) + ' км']);
    (ins.meta || []).forEach(function (m) { if (!/дата выдачи/i.test(m.label)) head.push([m.label, m.value]); });

    let summary;
    if (ins.format === 'document') summary = { tone: 'neutral', text: 'Отчёт осмотра есть только в виде скана — схема по нему не строится. Смотрите страницы оригинала ниже.' };
    else if (!parts.length) summary = { tone: 'good', text: 'В отчёте осмотра нет отметок о замене, ремонте или повреждениях кузовных элементов.' };
    else {
      const replaced = parts.filter(function (p) { return p.statuses.some(function (s) { return s.kind === 'replacement'; }); }).length;
      const frame = parts.filter(function (p) { return p.group === 'frame'; }).length;
      summary = { tone: frame || ins.accident ? 'bad' : 'warning', text: 'Элементов с отметками: ' + parts.length +
        (replaced ? ', из них заменено: ' + replaced : '') + (frame ? '. Есть отметки на силовых элементах кузова' : '') + '.' };
    }

    let html = '<p class="tsheet__source">Источник: ' + SOURCE + '</p>' +
      '<p class="tsheet__summary tone--' + summary.tone + '">' + esc(summary.text) + '</p>';

    if (ins.format === 'structured') {
      html += '<div class="tsheet__schemes">' + schemeSvg(OUTER, byZone, 'Кузов — внешние панели') + schemeSvg(FRAME, byZone, 'Силовые элементы кузова') + '</div>' +
        '<div class="tsheet__info" id="tsheetInfo" aria-live="polite"><p class="tsheet__hint">Нажмите на элемент схемы, чтобы увидеть отметки осмотра.</p></div>' +
        '<ul class="tsheet__legend" aria-label="Обозначения">' + KINDS.filter(function (k) { return k.code; }).map(function (k) {
          return '<li><span class="tstatus tstatus--' + k.kind + '"><b>' + k.code + '</b></span>' + esc(k.label) + '</li>';
        }).join('') + '<li><span class="tlegend-off"></span>Не входит в осмотр (неметаллические и съёмные детали)</li></ul>';
    }

    if (parts.length) {
      const groups = [];
      const byGroup = {};
      parts.forEach(function (p) { const key = p.groupTitle || 'Прочие элементы'; if (!byGroup[key]) { byGroup[key] = []; groups.push(key); } byGroup[key].push(p); });
      html += '<h3 class="tsheet__h">Отмеченные элементы</h3>' + groups.map(function (key) {
        return '<div class="tsheet__group"><p class="tsheet__group-title">' + esc(key) + '</p><ul class="tsheet__parts">' + byGroup[key].map(function (p) {
          return '<li><div class="tsheet__part"><span>' + esc(p.name) + (p.zone ? '' : ' <small>(нет на схеме)</small>') + '</span>' +
            (p.code ? '<small>Код детали ' + esc(p.code) + '</small>' : '') + '</div><div class="tsheet__statuses">' + statusChips(p.statuses) + '</div></li>';
        }).join('') + '</ul></div>';
      }).join('');
    }

    if (ins.documents && ins.documents.length) {
      html += '<h3 class="tsheet__h">Сканы оригинального отчёта</h3><ul class="tsheet__docs">' + ins.documents.map(function (doc) {
        return '<li><a href="' + esc(doc.url) + '" target="_blank" rel="noopener">' + esc(doc.caption) + '</a></li>';
      }).join('') + '</ul>';
    }

    if (head.length) {
      html += '<h3 class="tsheet__h">Сведения об осмотре</h3>' + rowsHtml(head.map(function (r) { return { label: r[0], value: r[1], tone: 'neutral' }; }));
    }
    if (ins.flags && ins.flags.length) html += '<h3 class="tsheet__h">Отметки отчёта</h3>' + rowsHtml(ins.flags);
    if (ins.checks && ins.checks.length) html += '<h3 class="tsheet__h">Двигатель, коробка и другие узлы</h3><div class="optgroups">' + checksHtml(ins.checks) + '</div>';
    if (ins.comment) {
      html += '<details class="optgroup tsheet__comment"><summary>Комментарий инспектора (оригинал на корейском)<svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg></summary><p lang="ko">' + esc(ins.comment) + '</p></details>';
    }
    root.innerHTML = html;

    const info = root.querySelector('#tsheetInfo');
    if (!info) return;
    const allZones = OUTER.concat(FRAME);
    function show(zoneId, el) {
      root.querySelectorAll('.tz.is-on').forEach(function (z) { z.classList.remove('is-on'); });
      if (el) el.classList.add('is-on');
      const zone = allZones.find(function (z) { return z.id === zoneId; });
      const marked = byZone[zoneId] || [];
      let body;
      if (zone.off) body = '<p class="tsheet__hint">По правилам осмотра Encar неметаллические и съёмные детали не проверяются — сведений о бампере в отчёте нет.</p>';
      else if (!marked.length) body = '<p>Состояние: <b>отметок нет</b></p><p class="tsheet__hint">Источник: ' + SOURCE + '</p>';
      else body = marked.map(function (p) {
        return '<p class="tsheet__info-name">' + esc(p.name) + (p.code ? ' <small>' + esc(p.code) + '</small>' : '') + '</p>' +
          p.statuses.map(function (s) { return '<p>Состояние: <b>' + esc(s.label) + '</b> · обозначение <b>' + esc(s.code) + '</b></p>'; }).join('');
      }).join('') + '<p class="tsheet__hint">Источник: ' + SOURCE + '</p>';
      info.innerHTML = '<p class="tsheet__info-title">' + esc(marked.length === 1 ? marked[0].name : zone.name) + '</p>' + body;
    }
    root.querySelectorAll('.tz[data-zone]').forEach(function (el) {
      el.addEventListener('click', function () { show(el.dataset.zone, el); });
      el.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(el.dataset.zone, el); }
      });
    });
  }

  function renderHistory(root, data) {
    const history = (data && data.history) || { rows: [], insuranceCases: [] };
    const none = /^0\s*\/\s*0\b/.test(data.insurance || '');
    const cases = history.insuranceCases || [];
    const krw = function (n) { return n == null ? '—' : fmt(n) + ' ₩'; };
    let html = '';
    if (none) html += '<p class="dcard__text">Страховых случаев по этому автомобилю не зафиксировано.</p>';
    else if (data.insurance) html += '<p class="dcard__text">Повреждения этого автомобиля (случаев / сумма): ' + esc(data.insurance) + '</p>';
    if (cases.length) {
      html += '<ul class="tsheet__cases">' + cases.map(function (c) {
        return '<li><div class="tsheet__case-head"><b>' + esc(c.date) + '</b><span>' + esc(c.type) + '</span></div>' +
          '<dl class="tsheet__rows"><div><dt>Ремонт всего</dt><dd>' + krw(c.totalKrw) + '</dd></div>' +
          '<div><dt>Запчасти / работы / окрас</dt><dd>' + [c.partsKrw, c.laborKrw, c.paintKrw].map(krw).join(' / ') + '</dd></div>' +
          '<div><dt>Страховая выплата</dt><dd>' + krw(c.payoutKrw) + '</dd></div></dl></li>';
      }).join('') + '</ul>';
    }
    if (history.rows && history.rows.length) html += '<h3 class="tsheet__h">Записи об автомобиле</h3>' + rowsHtml(history.rows);
    if (html) html += '<p class="tsheet__note">Источник: страховая база и история автомобиля на Encar. Это отдельные сведения, не технический осмотр.</p>';
    root.innerHTML = html;
    return Boolean(html);
  }

  window.CarInspection = { render: render, renderHistory: renderHistory };
})();
