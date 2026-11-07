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

function setService(value) {
  if (!serviceSelect) return;
  serviceSelect.value = value;
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
  link.addEventListener('click', () => setService(link.dataset.service));
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (status) status.textContent = '';
  if (!form.reportValidity()) return;

  const submitButton = form.querySelector('.submit-button');
  if (submitButton) submitButton.disabled = true;
  if (status) status.textContent = 'Отправляем заявку…';

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
    if (status) status.textContent = 'Спасибо! Заявка отправлена.';
  } catch {
    if (status) status.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз.';
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
    const gap = parseFloat(getComputedStyle(reviewTrack).columnGap) || 0;
    const distance = (reviewCards[0].getBoundingClientRect().width + gap) * 3;
    reviewTrack.scrollBy({ left: direction * distance, behavior: 'smooth' });
  });
});

reviewTrack?.addEventListener('scroll', updateReviewControls, { passive: true });
window.addEventListener('resize', updateReviewControls);
updateReviewControls();


const heroVideo = document.querySelector('.hero-video');
if (heroVideo) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    heroVideo.pause();
  } else {
    heroVideo.play().catch(() => {});
  }
}
