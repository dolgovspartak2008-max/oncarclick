/* OnCarClick — общий скрипт: иконки, мобильное меню, тосты */
(function () {
  const ICONS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4.2A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    chevronR: '<path d="m9 6 6 6-6 6"/>',
    calc: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/>',
    truck: '<path d="M2 7h11v9H2zM13 10h4.5l3.5 3.5V16h-8z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/><path d="M0 9.5h3M0 12h4"/>',
    coins: '<ellipse cx="9" cy="6.5" rx="5.5" ry="2.5"/><path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/><path d="M3.5 10.5v4C3.5 15.9 6 17 9 17"/><ellipse cx="15" cy="14" rx="5.5" ry="2.5"/><path d="M9.5 14v3.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V14"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 16.5 9 5 9-5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14c2.4.2 4 1.7 4.5 4.5"/>',
    car: '<path d="M3 16v-3.5l2-5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5l2 5V16a1 1 0 0 1-1 1h-1.5M4 17a1 1 0 0 1-1-1M3.5 12.5h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M9.3 17h5.4"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-2 2.5-5 2.5"/>',
    receipt: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 10v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4M5 14v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    pin: '<path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12Z" fill="currentColor"/><circle cx="12" cy="10" r="2.6" fill="#08090c" stroke="none"/>',
    phone: '<path d="M5 3.5h3.5l1.6 4.2-2.2 1.5a11 11 0 0 0 6.9 6.9l1.5-2.2 4.2 1.6V19a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 3.2 5.5 1.8 1.8 0 0 1 5 3.5Z" fill="currentColor" stroke="none"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
    telegram: '<path d="M21.4 4.2 2.9 11.3c-1 .4-1 1.6 0 1.9l4.6 1.5 1.8 5.4c.2.6 1 .8 1.5.3l2.6-2.4 4.7 3.5c.6.4 1.4.1 1.6-.6L22.9 5.6c.2-1-.7-1.8-1.5-1.4Zm-3.6 3.6-8.4 7.6-.4 3.4-1.5-4.6 10.3-6.4Z" fill="currentColor" stroke="none"/>',
    whatsapp: '<path d="M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.6 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5Zm0 17.1a7.7 7.7 0 0 1-4-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A7.7 7.7 0 1 1 12 19.6Zm4.3-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.3 6.3 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.7 4.3 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3Z" fill="currentColor" stroke="none"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'
  };

  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">' +
    Object.entries(ICONS).map(([id, p]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${p}</symbol>`).join('') +
    '</svg>';
  document.body.insertAdjacentHTML('afterbegin', sprite);

  // Мобильное меню
  const mnav = document.querySelector('.mnav');
  const openBtn = document.querySelector('.burger');
  const closeBtn = document.querySelector('.mnav__close');
  const setMenu = (open) => {
    if (!mnav) return;
    mnav.classList.toggle('is-open', open);
    document.body.classList.toggle('no-scroll', open);
    openBtn && openBtn.setAttribute('aria-expanded', String(open));
  };
  openBtn && openBtn.addEventListener('click', () => setMenu(true));
  closeBtn && closeBtn.addEventListener('click', () => setMenu(false));
  mnav && mnav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Тост
  let toastEl, toastT;
  window.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-show'), 2400);
  };

  // Форматирование
  window.fmtRub = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
})();
