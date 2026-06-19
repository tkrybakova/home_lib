import { state, ui, lib, findRoom, findCabinet, findShelf, getParentEntity } from './state.js';
import { esc, formatDate } from './utils.js';
import { showModal } from './modal.js';

// Toast (временно здесь, позже вынесем)
export function showToast(message, type = 'info') {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--text-primary)'};
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.transition = '0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Основной рендер
export function render() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <main>
      <div class="topbar">
        ${ui.step !== 'libraries' ? `<button class="back-btn" data-action="back">← Назад</button>` : ''}
        <h1>${title()}</h1>
        <div class="topbar-actions">
          ${renderContextActions()}
        </div>
      </div>
      ${view()}
    </main>
  `;
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
      actions.push(`
        <button data-action="edit-parent" data-type="${type}">✏️</button>
        <button class="danger" data-action="delete-parent" data-type="${type}">🗑️</button>
      `);
    }
  }
  if (ui.step === 'books') {
    actions.push(`<button data-action="add-book-isbn" style="background:rgba(255,255,255,0.15);">📡 По ISBN</button>
      <button data-action="add-book">➕ Книга</button>`);
  }
  if (ui.step === 'shelves') {
    actions.push(`<button data-action="add-shelf">➕ Полка</button>`);
  }
  if (ui.step === 'rooms' && lib()) actions.push(`<button data-action="add-room">➕ Помещение</button>`);
  if (ui.step === 'cabinets' && findRoom()) actions.push(`<button data-action="add-cabinet">➕ Шкаф</button>`);
  return actions.join('');
}

function title() {
  const map = {
    libraries: 'Мои библиотеки',
    rooms: 'Помещения',
    cabinets: 'Шкафы',
    shelves: 'Полки',
    books: 'Книги'
  };
  return map[ui.step] || '';
}

function view() {
  if (ui.step === 'libraries') return renderLibraries();
  if (ui.step === 'rooms') return renderRooms();
  if (ui.step === 'cabinets') return renderCabinets();
  if (ui.step === 'shelves') return renderShelves();
  if (ui.step === 'books') return renderBooks();
  return '';
}

/* ---------- Представления ---------- */

function renderLibraries() {
  if (!state.libraries.length) {
    return `
      <button class="add-btn" data-action="add-library">📚 Создать первую библиотеку</button>
      <div class="empty-state"><span class="emoji">📚</span><h3>Нет библиотек</h3><p>Начните с создания своей первой библиотеки</p></div>
    `;
  }
  return `
    <button class="add-btn" data-action="add-library">➕ Новая библиотека</button>
    <div class="grid">
      ${state.libraries.map(l => `
        <div class="card">
          <button data-action="open-library" data-id="${l.id}">
            <span class="icon">🏛</span>
            <span class="name">${esc(l.name)}</span>
            <span class="badge">${l.rooms?.length || 0} помещений</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRooms() {
  const library = lib();
  if (!library) return `<div class="empty-state"><p>Библиотека не выбрана</p></div>`;
  const rooms = library.rooms || [];
  if (!rooms.length) {
    return `
      <button class="add-btn" data-action="add-room">➕ Создать первое помещение</button>
      <div class="empty-state"><span class="emoji">🏚️</span><h3>Нет помещений</h3><p>Добавьте помещение в библиотеку «${esc(library.name)}»</p></div>
    `;
  }
  return `
    <button class="add-btn" data-action="add-room">➕ Новое помещение</button>
    <div class="grid">
      ${rooms.map(r => `
        <div class="card">
          <button data-action="open-room" data-id="${r.id}">
            <span class="icon">🚪</span>
            <span class="name">${esc(r.name)}</span>
            <span class="badge">${r.cabinets?.length || 0} шкафов</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCabinets() {
  const room = findRoom();
  if (!room) return `<div class="empty-state"><p>Помещение не выбрано</p></div>`;
  const cabinets = room.cabinets || [];
  if (!cabinets.length) {
    return `
      <button class="add-btn" data-action="add-cabinet">➕ Создать первый шкаф</button>
      <div class="empty-state"><span class="emoji">🗄️</span><h3>Нет шкафов</h3><p>Добавьте шкаф в помещение «${esc(room.name)}»</p></div>
    `;
  }
  return `
    <button class="add-btn" data-action="add-cabinet">➕ Новый шкаф</button>
    <div class="grid">
      ${cabinets.map(c => `
        <div class="card">
          <button data-action="open-cabinet" data-id="${c.id}">
            <span class="icon">🗄</span>
            <span class="name">${esc(c.name)}</span>
            <span class="badge">${c.shelves?.length || 0} полок</span>
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

// Вспомогательная функция для отрисовки книг в HTML (используется в renderShelves)
function renderBooksHTML(books) {
  let html = '';
  let i = 0;
  while (i < books.length) {
    const book = books[i];
    const visual = book.visual || { type: 'upright', height: 200, width: 20, lean: null };
    if (visual.type === 'horizontal') {
      html += '<div class="horizontal-stack">';
      while (i < books.length && books[i].visual && books[i].visual.type === 'horizontal') {
        const b = books[i];
        const v = b.visual;
        html += `<div class="book horizontal" style="height:${v.height}px;width:${v.width}px;" data-book-id="${b.id}"></div>`;
        i++;
      }
      html += '</div>';
    } else {
      const v = visual;
      const leanClass = v.lean ? ` lean-${v.lean}` : '';
      html += `<div class="book upright${leanClass}" style="height:${v.height}px;width:${v.width}px;" data-book-id="${book.id}"></div>`;
      i++;
    }
  }
  return html;
}

function renderShelves() {
  const cabinet = findCabinet();
  if (!cabinet) return `<div class="empty-state"><p>Шкаф не выбран</p></div>`;
  const shelves = cabinet.shelves || [];

  if (!shelves.length) {
    return `
      <button class="add-btn" data-action="add-shelf">➕ Создать первую полку</button>
      <div class="empty-state"><span class="emoji">📦</span><h3>Нет полок</h3><p>Добавьте полку в шкаф «${esc(cabinet.name)}»</p></div>
    `;
  }

  let html = `<button class="add-btn" data-action="add-shelf">➕ Новая полка</button>`;

  shelves.forEach(shelf => {
    const books = shelf.books || [];
    html += `
      <div class="shelf" data-shelf-id="${shelf.id}">
        <div class="shelf-actions">
          <button data-action="open-shelf" data-id="${shelf.id}">Открыть</button>
          <button data-action="edit-shelf" data-id="${shelf.id}">✏️</button>
          <button class="btn-add-book" data-action="add-book-to-shelf" data-shelf-id="${shelf.id}">+</button>
          <button class="btn-remove" data-action="delete-shelf" data-id="${shelf.id}">×</button>
        </div>
        <div class="books-container" data-shelf-id="${shelf.id}">
          ${books.length ? renderBooksHTML(books) : ''}
        </div>
      </div>
    `;
  });

  return html;
}

function renderBooks() {
  const shelf = findShelf();
  if (!shelf) return `<div class="empty-state"><p>Полка не выбрана</p></div>`;
  const books = shelf.books || [];
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
      <button class="add-btn" style="flex:1;min-width:150px;" data-action="add-book">➕ Новая книга</button>
      <button class="add-btn secondary" style="flex:1;min-width:150px;" data-action="add-book-isbn">📡 По ISBN</button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px 0;">
      ${books.map(b => `
        <div class="book-tile" data-book-id="${b.id}" style="background:var(--bg-primary);border-radius:8px;padding:12px 16px;cursor:pointer;transition:var(--transition);border-left:4px solid var(--accent);width:160px;min-height:80px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <div style="font-weight:600;font-size:14px;line-height:1.3;word-break:break-word;">${esc(b.title)}</div>
          ${b.author ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${esc(b.author)}</div>` : ''}
          ${b.isbn ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;opacity:0.6;">${esc(b.isbn)}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button data-action="edit-book" data-id="${b.id}" style="padding:2px 8px;font-size:11px;border:none;border-radius:4px;background:var(--bg-card);cursor:pointer;">✏️</button>
            <button data-action="delete-book" data-id="${b.id}" style="padding:2px 8px;font-size:11px;border:none;border-radius:4px;background:var(--danger);color:white;cursor:pointer;">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
    ${!books.length ? `<div class="empty-state" style="padding:40px 20px;"><span class="emoji">📖</span><h3>Нет книг</h3><p>Добавьте книгу на полку «${esc(shelf.name)}»</p></div>` : ''}
  `;
}
