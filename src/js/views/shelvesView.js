import { findCabinet } from '../state.js';
import { esc } from '../utils.js';

function renderBooksHTML(books) {
  let html = '';
  let i = 0;
  while (i < books.length) {
    const book = books[i];
    const visual = book.visual || { type: 'upright', height: 200, width: 20, lean: null };
    const color = Math.abs(hashString(`${book.id}-${book.title}`)) % 12;

    if (visual.type === 'horizontal') {
      html += '<div class="horizontal-stack">';
      while (i < books.length && books[i].visual && books[i].visual.type === 'horizontal') {
        const current = books[i];
        const currentVisual = current.visual;
        const stackColor = Math.abs(hashString(`${current.id}-${current.title}`)) % 12;
        html += `
          <div
            class="book hardback-book horizontal"
            style="height:${safeDimension(currentVisual.height, 12)}px;width:${safeDimension(currentVisual.width, 40)}px;"
            data-book-id="${esc(current.id)}"
            data-color="${stackColor}"
            title="${esc(current.title)}"
          >
            <span class="book-shine"></span>
          </div>
        `;
        i++;
      }
      html += '</div>';
    } else {
      const leanClass = visual.lean === 'left' || visual.lean === 'right' ? ` lean-${visual.lean}` : '';
      html += `
        <div
          class="book hardback-book upright${leanClass}"
          style="height:${safeDimension(visual.height, 200)}px;width:${Math.max(safeDimension(visual.width, 26), 26)}px;"
          data-book-id="${esc(book.id)}"
          data-color="${color}"
          title="${esc(book.title)}"
        >
          <div class="book-spine">
            <span class="book-spine__title">${esc(book.title)}</span>
            ${book.author ? `<span class="book-spine__author">${esc(book.author)}</span>` : ''}
          </div>
          <span class="book-shine"></span>
        </div>
      `;
      i++;
    }
  }
  return html;
}

export function renderShelves() {
  const cabinet = findCabinet();
  if (!cabinet) return '<div class="empty-state"><p>Шкаф не выбран</p></div>';

  const shelves = cabinet.shelves || [];
  if (!shelves.length) {
    return `
      <button class="add-btn" data-action="add-shelf">➕ Создать первую полку</button>
      <div class="empty-state"><span class="emoji">📦</span><h3>Нет полок</h3><p>Добавьте полку в шкаф «${esc(cabinet.name)}»</p></div>
    `;
  }

  const totalBooks = shelves.reduce((sum, shelf) => sum + (shelf.books?.length || 0), 0);
  let html = `
    <section class="hardback-stage" aria-label="Интерактивный книжный шкаф">
      <div class="hardback-stage__copy">
        <span class="stage-badge">✦ Hardback · Interactive shelf</span>
        <h2>Живой шкаф «${esc(cabinet.name)}»</h2>
        <p>Наводите на корешки и открывайте книги прямо с полки. Интерфейс использует ваши реальные данные.</p>
      </div>
      <div class="hardback-stage__stats" aria-label="Статистика шкафа">
        <span><strong>${shelves.length}</strong> ${declOfNum(shelves.length, ['полка', 'полки', 'полок'])}</span>
        <span><strong>${totalBooks}</strong> ${declOfNum(totalBooks, ['книга', 'книги', 'книг'])}</span>
      </div>
    </section>
    <button class="add-btn" data-action="add-shelf">➕ Новая полка</button>
  `;

  shelves.forEach(shelf => {
    const books = shelf.books || [];
    html += `
      <div class="shelf" data-shelf-id="${esc(shelf.id)}">
        <div class="shelf-header">
          <button class="shelf-title" data-action="open-shelf" data-id="${esc(shelf.id)}">
            <span>${esc(shelf.name)}</span>
            <small>${books.length} ${declOfNum(books.length, ['книга', 'книги', 'книг'])} · ${esc(shelf.lengthCm)}×${esc(shelf.heightCm)}×${esc(shelf.depthCm)} см</small>
          </button>
          <div class="shelf-actions">
            <button title="Открыть полку" data-action="open-shelf" data-id="${esc(shelf.id)}">📖</button>
            <button title="Редактировать полку" data-action="edit-shelf" data-id="${esc(shelf.id)}">✏️</button>
            <button title="Добавить книгу" class="btn-add-book" data-action="add-book-to-shelf" data-shelf-id="${esc(shelf.id)}">+</button>
            <button title="Удалить полку" class="btn-remove" data-action="delete-shelf" data-id="${esc(shelf.id)}">×</button>
          </div>
        </div>
        <div class="books-container hardback-bookshelf" data-shelf-id="${esc(shelf.id)}">
          ${books.length ? renderBooksHTML(books) : ''}
        </div>
        ${books.length ? `
          <div class="bookshelf-dots" aria-hidden="true">
            ${books.slice(0, 12).map((_, index) => `<span class="${index === 0 ? 'active' : ''}"></span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  });

  return html;
}

function safeDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1000 ? number : fallback;
}

function hashString(value = '') {
  return String(value).split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
}

function declOfNum(n, forms) {
  const cases = [2, 0, 1, 1, 1, 2];
  return forms[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
}
