import { findShelf } from '../state.js';
import { esc } from '../utils.js';

export function renderBooks() {
  const shelf = findShelf();
  if (!shelf) {
    return `<div class="empty-state"><div class="empty-icon">LIBRARY</div><h3>Полка не выбрана</h3><p>Выберите или создайте полку, чтобы управлять книгами</p></div>`;
  }
  const books = shelf.books || [];
  return `
    <div class="books-actions">
      <div class="books-heading"><span class="section-kicker">CATALOGUE</span><h2>${esc(shelf.name)}</h2></div>
      <button class="btn btn-secondary" data-action="add-book-isbn">По ISBN</button>
      <button class="btn btn-primary" data-action="add-book">Новая книга</button>
      <span class="books-count">${books.length} ${declOfNum(books.length, ['книга', 'книги', 'книг'])}</span>
    </div>
    <div class="books-grid">
      ${books.map((book, index) => `
        <article class="book-card" data-book-id="${esc(book.id)}">
          <div class="book-cover-frame">
            ${book.coverUrl ? `<img class="book-cover" src="${esc(book.coverUrl)}" alt="Обложка «${esc(book.title)}»" loading="lazy" onerror="this.parentElement.classList.add('is-missing');this.remove();">` : ''}
            <div class="book-cover-fallback"><span>${String(index + 1).padStart(2, '0')}</span><strong>${esc(book.title)}</strong></div>
          </div>
          <div class="book-card__content">
            <div class="book-card__title">${esc(book.title)}</div>
            ${book.author ? `<div class="book-card__author">${esc(book.author)}</div>` : ''}
            ${book.isbn ? `<div class="book-card__isbn">${esc(book.isbn)}</div>` : ''}
          </div>
          <div class="book-card__actions">
            <button class="btn-icon btn-edit" data-action="edit-book" data-id="${esc(book.id)}" title="Редактировать">Edit</button>
            <button class="btn-icon btn-delete" data-action="delete-book" data-id="${esc(book.id)}" title="Удалить">×</button>
          </div>
        </article>`).join('')}
    </div>
    ${!books.length ? `<div class="empty-state"><div class="empty-icon">OPEN SHELF</div><h3>На полке пока нет книг</h3><p>Добавьте первую книгу на полку «${esc(shelf.name)}»</p></div>` : ''}
  `;
}

function declOfNum(n, forms) {
  const cases = [2, 0, 1, 1, 1, 2];
  return forms[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
}
