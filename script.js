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

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (status) status.textContent = '';
  if (!form.reportValidity()) return;
  if (status) status.textContent = 'Форма пока не подключена. Заявка не отправлена. [УТОЧНИТЬ контакт для связи и подключить серверную отправку.]';
});

document.querySelector('#year')?.replaceChildren(String(new Date().getFullYear()));
