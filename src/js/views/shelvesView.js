import { findCabinet, esc } from './state.js';

/**
 * Преобразует массив книг в HTML-разметку для визуального представления на полке.
 * Учитывает тип книги (вертикальная, горизонтальная стопка) и наклон.
 * @param {Array} books - массив книг с полями visual
 * @returns {string} HTML
 */
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

/**
 * Отрисовывает полки текущего шкафа с книгами на них.
 * Каждая полка отображается как блок с заголовком, кнопками управления и контейнером книг.
 */
export function renderShelves() {
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
        <div class="shelf-header">
          <button class="shelf-title" data-action="open-shelf" data-id="${shelf.id}">
            <span>${esc(shelf.name)}</span>
            <small>${books.length} книг · ${shelf.lengthCm}×${shelf.heightCm}×${shelf.depthCm} см</small>
          </button>
          <div class="shelf-actions">
            <button title="Открыть полку" data-action="open-shelf" data-id="${shelf.id}">📖</button>
            <button title="Редактировать полку" data-action="edit-shelf" data-id="${shelf.id}">✏️</button>
            <button title="Добавить книгу" class="btn-add-book" data-action="add-book-to-shelf" data-shelf-id="${shelf.id}">+</button>
            <button title="Удалить полку" class="btn-remove" data-action="delete-shelf" data-id="${shelf.id}">×</button>
          </div>
        </div>
        <div class="books-container" data-shelf-id="${shelf.id}">
          ${books.length ? renderBooksHTML(books) : ''}
        </div>
      </div>
    `;
  });

  return html;
}