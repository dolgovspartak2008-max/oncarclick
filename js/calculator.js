/* Калькулятор: упрощённая модель «под ключ» (ориентировочно) */
(function () {
  const $ = (s) => document.querySelector(s);
  const COUNTRIES = {
    kr: { cur: '₩', rate: 0.0558, ship: 180000, def: 25000000 },
    jp: { cur: '¥', rate: 0.53, ship: 220000, def: 2600000 },
    cn: { cur: '元', rate: 11.2, ship: 160000, def: 125000 }
  };
  // ставка пошлины, ₽ за 1 см³ (упрощённо)
  const PER_CC = [[1.0, 150], [1.5, 170], [1.8, 190], [2.3, 209.6], [3.0, 240], [99, 300]];
  const FEE = 50000;

  const country = $('#cCountry'), price = $('#cPrice'), vol = $('#cVol'), fuel = $('#cFuel');
  const rateInput = $('#cRate'), rateEdit = $('#rateEdit');
  const rates = { kr: COUNTRIES.kr.rate, jp: COUNTRIES.jp.rate, cn: COUNTRIES.cn.rate };

  const parse = (s) => +String(s).replace(/[^\d]/g, '') || 0;
  const group = (n) => n.toLocaleString('ru-RU');
  const rub = (n) => group(Math.round(n)) + ' ₽';
  const rateStr = (r) => String(r).replace('.', ',');

  function calc() {
    const c = country.value, cfg = COUNTRIES[c], r = rates[c];
    const carRub = Math.round(parse(price.value) * r);
    const v = +vol.value, f = fuel.value;
    let duty;
    if (f === 'ev') duty = carRub * 0.15;
    else {
      const perCc = PER_CC.find(([max]) => v <= max)[1];
      duty = Math.max(carRub * 0.2, v * 1000 * perCc);
      if (f === 'hybrid') duty *= 0.9;
    }
    duty = Math.round(duty / 100) * 100;
    const util = v > 3 && f !== 'ev' ? 300000 : 20000;
    const total = carRub + duty + util + cfg.ship + FEE;
    return { carRub, duty, util, ship: cfg.ship, total, r, cur: cfg.cur };
  }

  function paint(flash) {
    const x = calc();
    $('#cCur').textContent = x.cur;
    $('#cRub').textContent = rub(x.carRub);
    $('#cRateTxt').textContent = `1 ${x.cur} = ${rateStr(x.r)} ₽`;
    $('#rCar').textContent = rub(x.carRub);
    $('#rDuty').textContent = rub(x.duty);
    $('#rUtil').textContent = rub(x.util);
    $('#rShip').textContent = rub(x.ship);
    $('#rFee').textContent = rub(FEE);
    $('#rTotal').textContent = rub(x.total);
    vol.disabled = fuel.value === 'ev';
    if (flash) {
      const box = $('#calcResult');
      box.classList.remove('is-updated'); void box.offsetWidth; box.classList.add('is-updated');
    }
  }

  // форматирование ввода с пробелами
  price.addEventListener('input', () => {
    const pos = price.value.length - price.selectionStart;
    const n = parse(price.value);
    price.value = n ? group(n) : '';
    const p = Math.max(0, price.value.length - pos);
    price.setSelectionRange(p, p);
    paint();
  });
  country.addEventListener('change', () => { price.value = group(COUNTRIES[country.value].def); rateEdit.classList.remove('is-open'); paint(true); });
  vol.addEventListener('change', () => paint(true));
  fuel.addEventListener('change', () => paint(true));

  $('#rateEditBtn').addEventListener('click', () => {
    rateInput.value = rateStr(rates[country.value]);
    rateEdit.classList.toggle('is-open');
    if (rateEdit.classList.contains('is-open')) rateInput.focus();
  });
  const applyRate = () => {
    const v = parseFloat(rateInput.value.replace(',', '.'));
    if (v > 0) { rates[country.value] = v; paint(true); }
    rateEdit.classList.remove('is-open');
  };
  $('#rateOk').addEventListener('click', applyRate);
  rateInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyRate(); } });

  $('#calcForm').addEventListener('submit', (e) => {
    e.preventDefault();
    paint(true);
    if (window.matchMedia('(max-width: 767px)').matches) window.scrollTo({ top: $('#calcResult').getBoundingClientRect().top + scrollY - 80, behavior: 'smooth' });
    window.toast && toast('Расчёт обновлён');
  });

  paint();
})();
