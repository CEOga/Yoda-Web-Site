const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.primary-nav');

menuButton?.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.setAttribute('aria-label', expanded ? 'Открыть меню' : 'Закрыть меню');
  nav?.classList.toggle('open', !expanded);
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Открыть меню');
}));

const serviceSelect = document.querySelector('#service');
const groupField = document.querySelector('#group-field');
const groupSelect = groupField?.querySelector('select');
const form = document.querySelector('#booking-form');
const status = document.querySelector('#form-status');
const requiredMessages = {
  name: 'Введите ваше имя.',
  contact: 'Укажите телефон или имя пользователя в Telegram.',
  service: 'Выберите формат занятий.',
  consent: 'Подтвердите согласие на обработку данных.',
};

function showBookingStatus(message, state = '') {
  if (!status) return;
  status.dataset.state = state;
  status.textContent = message;
}

function showFieldError(field) {
  const label = field.closest('label');
  if (!label) return;
  const id = 'booking-error-' + field.name;
  let error = document.getElementById(id);
  if (!error) {
    error = document.createElement('span');
    error.id = id;
    error.className = 'booking-field-error';
    label.append(error);
  }
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', id);
  error.textContent = requiredMessages[field.name] || field.validationMessage;
}

function clearFieldError(field) {
  if (!field.hasAttribute('aria-invalid')) return;
  document.getElementById('booking-error-' + field.name)?.remove();
  field.removeAttribute('aria-invalid');
  field.removeAttribute('aria-describedby');
}

form?.addEventListener('invalid', (event) => {
  event.preventDefault();
  showFieldError(event.target);
}, true);

form?.addEventListener('input', (event) => {
  if (event.target.validity?.valid) clearFieldError(event.target);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || menuButton?.getAttribute('aria-expanded') !== 'true') return;
  menuButton.click();
  menuButton.focus();
});

function setService(value) {
  if (!serviceSelect) return;
  serviceSelect.value = value;
  clearFieldError(serviceSelect);
  const isGroup = value === 'group';
  if (groupField) groupField.hidden = !isGroup;
  if (groupSelect) groupSelect.required = false;
}

serviceSelect?.addEventListener('change', () => {
  const isGroup = serviceSelect.value === 'group';
  if (groupField) groupField.hidden = !isGroup;
  if (groupSelect) groupSelect.required = false;
});

document.querySelectorAll('[data-service]').forEach((link) => {
  link.addEventListener('click', () => {
    setService(link.dataset.service);
    if (groupSelect && link.dataset.group) groupSelect.value = link.dataset.group;
  });
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showBookingStatus('');
  if (!form.checkValidity()) {
    showBookingStatus('Проверьте отмеченные поля.', 'error');
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const submitButton = form.querySelector('.submit-button');
  if (submitButton) submitButton.disabled = true;
  showBookingStatus('Отправляем заявку…', 'pending');

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error('Заявка не отправлена');
    }

    form.reset();
    if (groupField) groupField.hidden = true;
    showBookingStatus('Спасибо! Заявка отправлена. Мы свяжемся с вами по указанным контактам.', 'success');
  } catch {
    showBookingStatus('Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.', 'error');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

document.querySelector('#year')?.replaceChildren(String(new Date().getFullYear()));

const morePhotosButton = document.querySelector('.more-photos');
const extraPhotos = document.querySelector('#extra-practice-photos');

morePhotosButton?.addEventListener('click', () => {
  const expanded = morePhotosButton.getAttribute('aria-expanded') === 'true';
  morePhotosButton.setAttribute('aria-expanded', String(!expanded));
  morePhotosButton.querySelector('.more-photos-label').textContent = expanded ? 'Ещё фото' : 'Скрыть фото';
  if (extraPhotos) extraPhotos.hidden = expanded;
});


const reviewTrack = document.querySelector('#review-list');
const reviewCards = reviewTrack ? [...reviewTrack.querySelectorAll('.review-item')] : [];
const reviewControls = [...document.querySelectorAll('.review-scroll')];

function updateReviewControls() {
  if (!reviewTrack || reviewCards.length === 0) return;
  const maxScroll = reviewTrack.scrollWidth - reviewTrack.clientWidth;
  reviewControls.forEach((button) => {
    const direction = Number(button.dataset.reviewDirection);
    button.disabled = direction < 0
      ? reviewTrack.scrollLeft <= 2
      : reviewTrack.scrollLeft >= maxScroll - 2;
  });
}

reviewControls.forEach((button) => {
  button.addEventListener('click', () => {
    if (!reviewTrack || reviewCards.length === 0) return;
    const direction = Number(button.dataset.reviewDirection);
    const trackStyle = getComputedStyle(reviewTrack);
    const gap = parseFloat(trackStyle.columnGap) || 0;
    const columns = Number(trackStyle.getPropertyValue('--review-columns')) || 1;
    const distance = (reviewCards[0].getBoundingClientRect().width + gap) * columns;
    reviewTrack.scrollBy({ left: direction * distance, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
});

reviewTrack?.addEventListener('scroll', updateReviewControls, { passive: true });
window.addEventListener('resize', updateReviewControls);
updateReviewControls();


const heroVideo = document.querySelector('.hero-video');
if (heroVideo) {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  function updateHeroMotion() {
    if (motionPreference.matches) {
      heroVideo.pause();
      heroVideo.currentTime = 0;
    } else {
      heroVideo.play().catch(() => {});
    }
  }
  motionPreference.addEventListener('change', updateHeroMotion);
  updateHeroMotion();
}
