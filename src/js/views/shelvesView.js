import { findCabinet } from '../state.js';
import { esc } from '../utils.js';

function renderBooksHTML(books) {
  return books.map((book, index) => {
    const visual = book.visual || { type: 'upright', height: 190, width: 24, lean: null };
    const leanClass = visual.lean === 'left' || visual.lean === 'right' ? ` lean-${visual.lean}` : '';
    const coverStyle = book.coverUrl ? `background-image:url('${esc(book.coverUrl)}')` : '';
    return `
      <div class="shelf-book-wrap${leanClass}" style="height:${safeDimension(visual.height, 190)}px;width:${Math.max(safeDimension(visual.width, 24), 24)}px">
        <div class="shelf-book" data-book-id="${esc(book.id)}" title="${esc(book.title)}" style="${coverStyle}">
          <div class="shelf-book__fallback"><span>${String(index + 1).padStart(2, '0')}</span><strong>${esc(book.title)}</strong></div>
          <div class="shelf-book__shine"></div>
        </div>
      </div>`;
  }).join('');
}

export function renderShelves() {
  const cabinet = findCabinet();
  if (!cabinet) return '<div class="empty-state"><p>Шкаф не выбран</p></div>';
  const shelves = cabinet.shelves || [];
  if (!shelves.length) {
    return `<button class="add-btn" data-action="add-shelf">Создать первую полку</button><div class="empty-state"><span class="empty-icon">ARCHIVE</span><h3>Нет полок</h3><p>Добавьте полку в шкаф «${esc(cabinet.name)}»</p></div>`;
  }
  const totalBooks = shelves.reduce((sum, shelf) => sum + (shelf.books?.length || 0), 0);
  let html = `
    <section class="hardback-stage" aria-label="Интерактивный книжный шкаф">
      <div class="hardback-stage__copy"><span class="stage-badge">PRIVATE BOOKCASE</span><h2>${esc(cabinet.name)}</h2><p>Книги представлены реальными обложками там, где они доступны. Нажмите на книгу, чтобы открыть её данные.</p></div>
      <div class="hardback-stage__stats"><span><strong>${shelves.length}</strong> ${declOfNum(shelves.length, ['полка', 'полки', 'полок'])}</span><span><strong>${totalBooks}</strong> ${declOfNum(totalBooks, ['книга', 'книги', 'книг'])}</span></div>
    </section>
    <button class="add-btn" data-action="add-shelf">Новая полка</button>`;
  shelves.forEach(shelf => {
    const books = shelf.books || [];
    html += `
      <div class="shelf" data-shelf-id="${esc(shelf.id)}">
        <div class="shelf-header">
          <button class="shelf-title" data-action="open-shelf" data-id="${esc(shelf.id)}"><span>${esc(shelf.name)}</span><small>${books.length} ${declOfNum(books.length, ['книга', 'книги', 'книг'])} · ${esc(shelf.lengthCm)}×${esc(shelf.heightCm)}×${esc(shelf.depthCm)} см</small></button>
          <div class="shelf-actions">
            <button title="Открыть полку" data-action="open-shelf" data-id="${esc(shelf.id)}">Open</button>
            <button title="Редактировать полку" data-action="edit-shelf" data-id="${esc(shelf.id)}">Edit</button>
            <button title="Добавить книгу" data-action="add-book-to-shelf" data-shelf-id="${esc(shelf.id)}">+</button>
            <button title="Удалить полку" data-action="delete-shelf" data-id="${esc(shelf.id)}">×</button>
          </div>
        </div>
        <div class="books-container hardback-bookshelf" data-shelf-id="${esc(shelf.id)}">${books.length ? renderBooksHTML(books) : '<span class="shelf-empty-label">Полка свободна</span>'}</div>
      </div>`;
  });
  return html;
}

function safeDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1000 ? number : fallback;
}
function declOfNum(n, forms) {
  const cases = [2, 0, 1, 1, 1, 2];
  return forms[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
}
