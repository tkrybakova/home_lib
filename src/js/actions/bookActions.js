import { findShelfById, findShelf, persist } from '../state.js';
import { showModal } from '../modal.js';
import { render } from '../renderMain.js';
import { createBook } from '../factories.js';
import { fetchBookByIsbn } from '../booksApi.js';
import { showToast } from '../toast.js';
import { normalizeIsbn, isValidIsbn } from '../utils.js';

function getShelf(shelfId) {
  return shelfId ? findShelfById(shelfId) : findShelf();
}

export function addBook(shelfId) {
  const targetShelfId = shelfId || findShelf()?.id;
  if (!targetShelfId || !getShelf(targetShelfId)) {
    return showToast('Полка не найдена', 'error');
  }

  showModal('edit', {
    title: 'Новая книга',
    fields: [
      { key: 'title', label: 'Название книги', type: 'text', placeholder: 'Война и мир', required: true },
      { key: 'author', label: 'Автор', type: 'text', placeholder: 'Лев Толстой' },
      { key: 'isbn', label: 'ISBN (опционально)', type: 'text', placeholder: '978-5-17-123456-7' },
      { key: 'description', label: 'Описание', type: 'textarea', placeholder: 'Краткое описание книги...' }
    ],
    onSave: (data) => {
      const shelf = getShelf(targetShelfId);
      if (!shelf) return showToast('Полка больше не существует', 'error');
      const isbn = normalizeIsbn(data.isbn);
      if (isbn && !isValidIsbn(isbn)) {
        return showToast('Некорректный ISBN', 'error');
      }
      shelf.books.push(createBook(data.title, isbn, data.author, data.description));
      persist();
      render();
    }
  });
}

export async function addBookByIsbn(shelfId) {
  const targetShelfId = shelfId || findShelf()?.id;
  if (!targetShelfId || !getShelf(targetShelfId)) {
    return showToast('Полка не найдена', 'error');
  }

  showModal('add-book-isbn', {
    title: 'Добавить книгу по ISBN',
    fields: [
      { key: 'isbn', label: 'ISBN', type: 'text', placeholder: '978-5-17-123456-7', required: true }
    ],
    onSave: async (data) => {
      const isbn = normalizeIsbn(data.isbn);
      if (!isValidIsbn(isbn)) {
        showToast('Некорректный ISBN', 'error');
        return;
      }

      try {
        const bookData = await fetchBookByIsbn(isbn);
        const shelf = getShelf(targetShelfId);
        if (!shelf) {
          showToast('Полка больше не существует', 'error');
          return;
        }

        if (bookData) {
          shelf.books.push(createBook(bookData.title, bookData.isbn || isbn, bookData.author, bookData.description));
          persist();
          render();
          showToast(`Книга "${bookData.title}" добавлена!`, 'success');
        } else {
          showModal('edit', {
            title: 'Книга не найдена. Введите данные вручную',
            fields: [
              { key: 'title', label: 'Название книги', type: 'text', placeholder: 'Название', required: true },
              { key: 'author', label: 'Автор', type: 'text', placeholder: 'Автор' },
              { key: 'isbn', label: 'ISBN', type: 'text', value: isbn },
              { key: 'description', label: 'Описание', type: 'textarea', placeholder: 'Описание' }
            ],
            onSave: (manualData) => {
              const currentShelf = getShelf(targetShelfId);
              if (!currentShelf) return showToast('Полка больше не существует', 'error');
              const manualIsbn = normalizeIsbn(manualData.isbn);
              if (manualIsbn && !isValidIsbn(manualIsbn)) {
                return showToast('Некорректный ISBN', 'error');
              }
              currentShelf.books.push(createBook(manualData.title, manualIsbn, manualData.author, manualData.description));
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
