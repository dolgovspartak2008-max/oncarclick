/* Контакты: маска телефона и отправка заявки — она сразу приходит менеджерам в Telegram */
(function () {
  const form = document.getElementById('form');
  const phone = document.getElementById('fPhone');
  const name = document.getElementById('fName');
  const comment = document.getElementById('fComment');

  // Если пришли из каталога — подставим машину в комментарий
  try {
    const car = localStorage.getItem('car');
    if (car) { comment.value = 'Интересует ' + car; localStorage.removeItem('car'); }
  } catch (e) {}

  function mask(v) {
    let d = v.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = d.slice(1);
    let out = '+7';
    if (p.length) out += ' (' + p.slice(0, 3);
    if (p.length >= 3) out += ')';
    if (p.length > 3) out += ' ' + p.slice(3, 6);
    if (p.length > 6) out += '-' + p.slice(6, 8);
    if (p.length > 8) out += '-' + p.slice(8, 10);
    return out;
  }
  phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+7 ('; });
  phone.addEventListener('blur', () => { if (phone.value.replace(/\D/g, '').length <= 1) phone.value = ''; });
  phone.addEventListener('input', () => { phone.value = mask(phone.value); phone.classList.remove('is-error'); });
  name.addEventListener('input', () => name.classList.remove('is-error'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    if (name.value.trim().length < 2) { name.classList.add('is-error'); ok = false; }
    if (phone.value.replace(/\D/g, '').length !== 11) { phone.classList.add('is-error'); ok = false; }
    if (!ok) { window.toast && toast('Заполните имя и телефон'); return; }
    const button = form.querySelector('button[type="submit"], .btn');
    if (form.dataset.sending) return;
    form.dataset.sending = '1';
    if (button) button.disabled = true;
    const website = document.getElementById('fWebsite');
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value.trim(), phone: phone.value.trim(), comment: comment.value.trim(),
        page: location.href, website: website ? website.value : ''
      })
    }).then((response) => response.json().then((data) => ({ ok: response.ok, data: data }))).then((result) => {
      if (!result.ok) throw new Error(result.data && result.data.message || 'Не удалось отправить заявку');
      form.classList.add('is-sent');
    }).catch((error) => {
      window.toast && toast(error.message || 'Не удалось отправить заявку. Попробуйте ещё раз.');
    }).finally(() => {
      delete form.dataset.sending;
      if (button) button.disabled = false;
    });
  });
})();
