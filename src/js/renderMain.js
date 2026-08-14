import { ui, lib, findRoom, getParentEntity } from './state.js';
import { renderLibraries } from './views/librariesView.js';
import { renderRooms } from './views/roomsView.js';
import { renderCabinets } from './views/cabinetsView.js';
import { renderShelves } from './views/shelvesView.js';
import { renderBooks } from './views/booksView.js';

export function render() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <main>
      <div class="topbar">
        ${ui.step !== 'libraries' ? '<button class="back-btn" data-action="back">← Назад</button>' : ''}
        <h1>${title()}</h1>
        <div class="topbar-actions">${renderContextActions()}</div>
      </div>
      ${view()}
    </main>
  `;
}

function title() {
  const map = { libraries: 'Мои библиотеки', rooms: 'Помещения', cabinets: 'Шкафы', shelves: 'Полки', books: 'Книги' };
  return map[ui.step] || '';
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
      actions.push(`<button data-action="edit-parent" data-type="${type}">Изменить</button>`);
      actions.push(`<button class="danger" data-action="delete-parent" data-type="${type}">Удалить</button>`);
    }
  }

  if (ui.step === 'books') {
    actions.push('<button data-action="add-book-isbn">По ISBN</button>');
    actions.push('<button data-action="add-book">+ Книга</button>');
  }
  if (ui.step === 'shelves') actions.push('<button data-action="add-shelf">+ Полка</button>');
  if (ui.step === 'rooms' && lib()) actions.push('<button data-action="add-room">+ Помещение</button>');
  if (ui.step === 'cabinets' && findRoom()) actions.push('<button data-action="add-cabinet">+ Шкаф</button>');

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
