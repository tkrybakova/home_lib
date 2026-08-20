import { ui, lib, findRoom, getParentEntity } from './state.js';
import { renderLibraries } from './views/librariesView.js';
import { renderRooms } from './views/roomsView.js';
import { renderCabinets } from './views/cabinetsView.js';
import { renderShelves } from './views/shelvesView.js';
import { renderBooks } from './views/booksView.js';

export function render() {
  const app = document.querySelector('#app');
  if (!app) return;
  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <button class="brand-mark" data-action="back" aria-label="На уровень выше">HL</button>
        <div class="topbar-main">
          <div class="eyebrow">PRIVATE ARCHIVE · HOME LIBRARY</div>
          <div class="title-row">
            ${ui.step !== 'libraries' ? '<button class="back-btn" data-action="back" aria-label="Назад">←</button>' : ''}
            <div><h1>${title()}</h1><div class="title-rule"></div></div>
          </div>
          ${renderBreadcrumbs()}
        </div>
        <div class="topbar-actions">${renderContextActions()}</div>
      </header>
      <section class="content-frame">${view()}</section>
      <footer class="app-footer"><span>Домашняя библиотека</span><span class="footer-line"></span><span>personal archive</span></footer>
    </main>`;
}

function title() {
  return ({ libraries: 'Коллекции', rooms: 'Пространства', cabinets: 'Книжные шкафы', shelves: 'Полки', books: 'Каталог книг' })[ui.step] || 'Архив';
}

function renderBreadcrumbs() {
  if (ui.step === 'libraries') return '<span class="breadcrumb current">Личный архив</span>';
  const labels = { rooms: 'Коллекция', cabinets: 'Пространство', shelves: 'Шкаф', books: 'Полка' };
  const parent = getParentEntity();
  return `<span class="breadcrumb"><span>${labels[ui.step] || 'Архив'}</span><span class="breadcrumb-separator">·</span><strong>${parent?.name || parent?.title || 'Текущий раздел'}</strong></span>`;
}

function renderContextActions() {
  const actions = [];
  const parent = getParentEntity();
  if (parent) {
    let type = '';
    if (ui.step === 'rooms') type = 'library';
    else if (ui.step === 'cabinets') type = 'room';
    else if (ui.step === 'shelves') type = 'cabinet';
    else if (ui.step === 'books') type = 'shelf';
    if (type) {
      actions.push(`<button class="action-quiet" data-action="edit-parent" data-type="${type}">Изменить</button>`);
      actions.push(`<button class="action-danger" data-action="delete-parent" data-type="${type}">Удалить</button>`);
    }
  }
  if (ui.step === 'books') {
    actions.push('<button class="action-quiet" data-action="add-book-isbn">По ISBN</button>');
    actions.push('<button class="action-primary" data-action="add-book">+ Книга</button>');
  }
  if (ui.step === 'shelves') actions.push('<button class="action-primary" data-action="add-shelf">+ Полка</button>');
  if (ui.step === 'rooms' && lib()) actions.push('<button class="action-primary" data-action="add-room">+ Комната</button>');
  if (ui.step === 'cabinets' && findRoom()) actions.push('<button class="action-primary" data-action="add-cabinet">+ Шкаф</button>');
  return actions.join('');
}

function view() {
  if (ui.step === 'libraries') return renderLibraries();
  if (ui.step === 'rooms') return renderRooms();
  if (ui.step === 'cabinets') return renderCabinets();
  if (ui.step === 'shelves') return renderShelves();
  if (ui.step === 'books') return renderBooks();
  return '';
}
