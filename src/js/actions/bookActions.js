import { findShelfById, findShelf, persist } from './state.js';
import { showModal, showToast } from './modal.js';
import { render } from './render.js';
import { createBook } from './factories.js';
import { fetchBookByIsbn } from './booksApi.js';

/**
 * Добавление книги вручную на указанную или текущую полку.
 * @param {string} [shelfId] – ID полки (если не передан, используется текущая полка UI)
 */
export function addBook(shelfId) {
  const shelf = shelfId ? findShelfById(shelfId) : findShelf();
  if (!shelf) return showToast('Полка не найдена', 'error');

  showModal('edit', {
    title: 'Новая книга',
    fields: [
      { key: 'title', label: 'Название книги', type: 'text', placeholder: 'Война и мир', required: true },
      { key: 'author', label: 'Автор', type: 'text', placeholder: 'Лев Толстой' },
      { key: 'isbn', label: 'ISBN (опционально)', type: 'text', placeholder: '978-5-17-123456-7' },
      { key: 'description', label: 'Описание', type: 'textarea', placeholder: 'Краткое описание книги...' }
    ],
    onSave: (data) => {
      shelf.books.push(createBook(data.title, data.isbn, data.author, data.description));
      persist();
      render();
    }
  });
}

/**
 * Добавление книги по ISBN с автоматическим заполнением из внешнего API.
 * При неудаче предлагает ввести данные вручную.
 * @param {string} [shelfId] – ID полки
 */
export async function addBookByIsbn(shelfId) {
  const shelf = shelfId ? findShelfById(shelfId) : findShelf();
  if (!shelf) return showToast('Полка не найдена', 'error');

  showModal('add-book-isbn', {
    title: 'Добавить книгу по ISBN',
    fields: [
      { key: 'isbn', label: 'ISBN', type: 'text', placeholder: '978-5-17-123456-7', required: true }
    ],
    onSave: async (data) => {
      const isbn = data.isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
      try {
        const bookData = await fetchBookByIsbn(isbn);
        if (bookData) {
          shelf.books.push(createBook(bookData.title, bookData.isbn, bookData.author, bookData.description));
          persist();
          render();
          showToast(`Книга "${bookData.title}" добавлена!`, 'success');
        } else {
          // Книга не найдена – ручной ввод
          showModal('edit', {
            title: 'Книга не найдена. Введите данные вручную',
            fields: [
              { key: 'title', label: 'Название книги', type: 'text', placeholder: 'Название', required: true },
              { key: 'author', label: 'Автор', type: 'text', placeholder: 'Автор' },
              { key: 'isbn', label: 'ISBN', type: 'text', value: isbn },
              { key: 'description', label: 'Описание', type: 'textarea', placeholder: 'Описание' }
            ],
            onSave: (manualData) => {
              shelf.books.push(createBook(manualData.title, manualData.isbn, manualData.author, manualData.description));
              persist();
              render();
              showToast('Книга добавлена вручную', 'success');
            }
          });
        }
      } catch (error) {
        showToast('Ошибка: ' + error.message, 'error');
      }
    }
  });
}