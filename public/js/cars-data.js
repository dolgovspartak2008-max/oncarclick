/* Демо-данные автомобилей (заменить на реальные из базы) + рисовалка силуэта.
   price — итоговая цена под ключ в рублях; engine — объём двигателя, л (0 — электромобиль). */
window.CARS = [
  { brand: 'Kia', model: 'Sorento', country: 'Корея', year: 2024, km: 12000, engine: 2.5, price: 4390000, type: 'suv', color: '#1b1d22', pop: 10 },
  { brand: 'Hyundai', model: 'Palisade', country: 'Корея', year: 2024, km: 9000, engine: 3.8, price: 5290000, type: 'suv', color: '#c9ccd1', pop: 9 },
  { brand: 'Geely', model: 'Monjaro', country: 'Китай', year: 2025, km: 3000, engine: 2.0, price: 3990000, type: 'suv', color: '#2a2d33', pop: 10 },
  { brand: 'Chery', model: 'Tiggo 8 Pro', country: 'Китай', year: 2024, km: 11000, engine: 2.0, price: 2890000, type: 'suv', color: '#b8241e', pop: 7 },
  { brand: 'Haval', model: 'Jolion', country: 'Китай', year: 2025, km: 2000, engine: 1.5, price: 2190000, type: 'suv', color: '#d9dbe0', pop: 6 },
  { brand: 'Toyota', model: 'RAV4', country: 'Япония', year: 2024, km: 15000, engine: 2.5, price: 3890000, type: 'suv', color: '#e9eaec', pop: 9 },
  { brand: 'Genesis', model: 'GV80', country: 'Корея', year: 2024, km: 8000, engine: 3.5, price: 6990000, type: 'suv', color: '#141518', pop: 7 },
  { brand: 'Zeekr', model: '001', country: 'Китай', year: 2025, km: 4000, engine: 0, price: 4690000, type: 'sedan', color: '#5d6168', pop: 8 },
  { brand: 'Honda', model: 'CR-V', country: 'Япония', year: 2024, km: 10000, engine: 1.5, price: 3590000, type: 'suv', color: '#9aa0a8', pop: 6 },
  { brand: 'Kia', model: 'K5', country: 'Корея', year: 2024, km: 14000, engine: 2.0, price: 2990000, type: 'sedan', color: '#7b8088', pop: 7 },
  { brand: 'Kia', model: 'Sorento', country: 'Корея', year: 2022, km: 36000, engine: 2.2, price: 3240000, type: 'suv', color: '#1b1d22', pop: 9 },
  { brand: 'BMW', model: '5 Series (G30)', country: 'Корея', year: 2022, km: 41000, engine: 2.0, price: 4490000, type: 'sedan', color: '#5d6168', pop: 9 },
  { brand: 'Toyota', model: 'Camry', country: 'Япония', year: 2022, km: 38000, engine: 2.5, price: 3190000, type: 'sedan', color: '#141518', pop: 8 },
  { brand: 'Hyundai', model: 'Tucson', country: 'Корея', year: 2023, km: 27000, engine: 2.0, price: 2890000, type: 'suv', color: '#d5d7db', pop: 8 },
  { brand: 'Mazda', model: 'CX-5', country: 'Япония', year: 2022, km: 44000, engine: 2.5, price: 2790000, type: 'suv', color: '#9b1c1c', pop: 6 },
  { brand: 'Lexus', model: 'NX 250', country: 'Япония', year: 2022, km: 33000, engine: 2.5, price: 4590000, type: 'suv', color: '#f0f0f2', pop: 7 },
  { brand: 'Geely', model: 'Coolray', country: 'Китай', year: 2023, km: 21000, engine: 1.5, price: 1890000, type: 'suv', color: '#7b8088', pop: 6 },
  { brand: 'Hyundai', model: 'Grandeur', country: 'Корея', year: 2023, km: 24000, engine: 2.5, price: 3690000, type: 'sedan', color: '#2a2d33', pop: 7 },
  { brand: 'BMW', model: '5 Series (G30)', country: 'Корея', year: 2020, km: 58000, engine: 2.0, price: 3890000, type: 'sedan', color: '#5d6168', pop: 10 },
  { brand: 'Toyota', model: 'RAV4', country: 'Япония', year: 2021, km: 42000, engine: 2.0, price: 2790000, type: 'suv', color: '#e9eaec', pop: 9 },
  { brand: 'Honda', model: 'CR-V', country: 'Япония', year: 2020, km: 61000, engine: 2.0, price: 2590000, type: 'suv', color: '#9aa0a8', pop: 7 },
  { brand: 'Genesis', model: 'G80', country: 'Корея', year: 2021, km: 39000, engine: 2.5, price: 4150000, type: 'sedan', color: '#d5d7db', pop: 7 },
  { brand: 'Lexus', model: 'RX 300', country: 'Япония', year: 2019, km: 72000, engine: 2.0, price: 4290000, type: 'suv', color: '#f0f0f2', pop: 6 },
  { brand: 'Toyota', model: 'Camry', country: 'Япония', year: 2020, km: 53000, engine: 2.5, price: 2890000, type: 'sedan', color: '#141518', pop: 8 },
  { brand: 'Hyundai', model: 'Palisade', country: 'Корея', year: 2021, km: 47000, engine: 3.8, price: 3990000, type: 'suv', color: '#c9ccd1', pop: 8 },
  { brand: 'Kia', model: 'K5', country: 'Корея', year: 2021, km: 44000, engine: 2.0, price: 2350000, type: 'sedan', color: '#7b8088', pop: 6 }
];

window.carSvg = function (c, i) {
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (k > 0 ? (255 - v) * k : v * k))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  const g = `g${i}`, hi = shade(c.color, .35), lo = shade(c.color, -.45);
  const body = c.type === 'suv'
    ? 'M18 112 C18 96 24 86 40 82 L78 74 C90 52 104 40 128 38 L236 38 C256 38 268 48 278 70 L298 78 C306 82 308 92 308 104 L308 116 C308 120 305 122 301 122 L24 122 C20 122 18 119 18 116 Z'
    : 'M18 112 C18 98 26 92 44 89 L92 84 C108 66 130 54 160 52 L212 52 C236 52 252 64 266 82 L292 88 C304 90 308 98 308 108 L308 116 C308 120 305 122 301 122 L24 122 C20 122 18 119 18 116 Z';
  const win1 = c.type === 'suv' ? 'M90 74 C100 56 112 47 130 46 L176 46 L176 74 Z' : 'M104 84 C118 68 134 60 158 59 L180 59 L180 84 Z';
  const win2 = c.type === 'suv' ? 'M182 46 L232 46 C248 46 258 54 266 72 L182 74 Z' : 'M186 59 L210 59 C228 59 242 68 254 83 L186 84 Z';
  const wheel = (x) => `<circle cx="${x}" cy="120" r="23" fill="#0b0c0f"/><circle cx="${x}" cy="120" r="14" fill="#3a3d44"/><circle cx="${x}" cy="120" r="5" fill="#16171b"/>`;
  return `<svg viewBox="0 0 326 150" aria-hidden="true">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${c.color}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>
    <ellipse cx="163" cy="142" rx="150" ry="6" fill="rgba(0,0,0,.6)"/>
    <path d="${body}" fill="url(#${g})"/>
    <path d="${win1}" fill="#14161b" opacity=".92"/><path d="${win2}" fill="#14161b" opacity=".92"/>
    <path d="M30 100 L300 100" stroke="${lo}" stroke-width="1.2" opacity=".6"/>
    <path d="M22 96 l14 -3 l0 7 l-14 1z" fill="#fff" opacity=".85"/>
    <path d="M306 96 l-10 -2 l0 7 l10 1z" fill="#ff2b2b"/>
    ${wheel(78)}${wheel(252)}
  </svg>`;
};

window.plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return (m === 1 && h !== 11) ? a : (m >= 2 && m <= 4 && (h < 12 || h > 14)) ? b : c; };
