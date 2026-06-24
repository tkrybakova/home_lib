import { findShelf } from '../state.js';
import { esc } from '../utils.js';

/**
 * Детальное представление книг на текущей полке.
 * Книги отображаются плитками с кнопками редактирования и удаления.
 * Улучшенный дизайн: сетка, тени, hover-эффекты, текстовые кнопки.
 */
export function renderBooks() {
  const shelf = findShelf();
  if (!shelf) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📚</div> <!-- символ не эмодзи, а юникодный значок -->
        <h3>Полка не выбрана</h3>
        <p>Выберите или создайте полку, чтобы управлять книгами</p>
      </div>
    `;
  }

  const books = shelf.books || [];

  return `
    <!-- Панель действий -->
    <div class="books-actions">
      <button class="btn btn-primary" data-action="add-book">Новая книга</button>
      <button class="btn btn-secondary" data-action="add-book-isbn">Добавить по ISBN</button>
      <span class="books-count">${books.length} ${declOfNum(books.length, ['книга', 'книги', 'книг'])}</span>
    </div>

    <!-- Сетка книг -->
    <div class="books-grid">
      ${books.map(b => `
        <div class="book-card" data-book-id="${b.id}">
          <div class="book-card__content">
            <div class="book-card__title">${esc(b.title)}</div>
            ${b.author ? `<div class="book-card__author">${esc(b.author)}</div>` : ''}
            ${b.isbn ? `<div class="book-card__isbn">ISBN: ${esc(b.isbn)}</div>` : ''}
          </div>
          <div class="book-card__actions">
            <button class="btn-icon btn-edit" data-action="edit-book" data-id="${b.id}" title="Редактировать">✎</button>
            <button class="btn-icon btn-delete" data-action="delete-book" data-id="${b.id}" title="Удалить">✕</button>
          </div>
        </div>
      `).join('')}
    </div>

    ${!books.length ? `
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <h3>На полке пока нет книг</h3>
        <p>Добавьте первую книгу на полку «${esc(shelf.name)}»</p>
      </div>
    ` : ''}
  `;
}

// Вспомогательная функция для склонения числительных
function declOfNum(n, forms) {
  const cases = [2, 0, 1, 1, 1, 2];
  return forms[(n % 100 > 4 && n % 100 < 20) ? 2 : cases[Math.min(n % 10, 5)]];
}