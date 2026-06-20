import { state, ui, persist, findCabinet, getParentEntity } from './state.js';
import { showModal, closeModal } from './modal.js';
import { go } from './navigation.js';
import { addLibrary } from './actions/libraryActions.js';
import { addRoom } from './actions/roomActions.js';
import { addCabinet } from './actions/cabinetActions.js';
import { addShelf } from './actions/shelfActions.js';
import { addBook, addBookByIsbn } from './actions/bookActions.js';
import { editEntity, deleteEntityWithConfirm } from './actions/entityActions.js';

/**
 * Инициализация всех обработчиков событий интерфейса.
 * Навешивает делегированные клики по кнопкам и элементам, а также закрытие по Escape.
 */
export function initEvents() {
  const app = document.querySelector('#app');

  // Делегирование кликов внутри #app
  app.addEventListener('click', e => {

    // === Открытие деталей книги при клике на саму книгу (не на кнопку) ===
    const bookEl = e.target.closest('.book');
    if (bookEl && !e.target.closest('button')) {
      const bookId = bookEl.dataset.bookId;
      const cabinet = findCabinet();

      if (cabinet) {
        for (const shelf of cabinet.shelves) {
          const book = shelf.books.find(b => b.id === bookId);
          if (book) {
            showModal('book-details', {
              book,
              onEdit: () => editEntity(book, 'book')
            });
            return;
          }
        }
      }
    }

    // === Клик по пустой области контейнера книг → добавить книгу на эту полку ===
    const container = e.target.closest('.books-container');
    if (container && !e.target.closest('.book')) {
      const shelfId = container.dataset.shelfId;
      if (shelfId) {
        addBook(shelfId);
      }
      return;
    }

    // === Обработка нажатий на любые кнопки ===
    const btn = e.target.closest('button');
    if (!btn) return;

    const { action, id, type, shelfId } = btn.dataset;

    switch (action) {

      // ---------- Навигация «Назад» ----------
      case 'back':
        switch (ui.step) {
          case 'books':
            go('shelves', { roomId: ui.roomId, cabinetId: ui.cabinetId });
            break;
          case 'shelves':
            go('cabinets', { roomId: ui.roomId });
            break;
          case 'cabinets':
            go('rooms');
            break;
          case 'rooms':
            go('libraries');
            break;
        }
        break;

      // ---------- Добавление сущностей ----------
      case 'add-library':
        addLibrary();
        break;
      case 'add-room':
        addRoom();
        break;
      case 'add-cabinet':
        addCabinet();
        break;
      case 'add-shelf':
        addShelf();
        break;
      case 'add-book':
        addBook();
        break;
      case 'add-book-isbn':
        addBookByIsbn();
        break;
      case 'add-book-to-shelf':
        addBook(shelfId);
        break;

      // ---------- Открытие/переход в сущность ----------
      case 'open-library':
        state.activeLibraryId = id;
        persist();
        go('rooms');
        break;
      case 'open-room':
        go('cabinets', { roomId: id });
        break;
      case 'open-cabinet':
        go('shelves', { roomId: ui.roomId, cabinetId: id });
        break;
      case 'open-shelf':
        go('books', { roomId: ui.roomId, cabinetId: ui.cabinetId, shelfId: id });
        break;

      // ---------- Редактирование/удаление родительского элемента (библиотека, комната, шкаф) ----------
      case 'edit-parent': {
        const entity = getParentEntity();
        if (entity) {
          editEntity(entity, type);
        }
        break;
      }
      case 'delete-parent': {
        const entity = getParentEntity();
        if (entity) {
          deleteEntityWithConfirm(entity, type);
        }
        break;
      }

      // ---------- Редактирование/удаление полки ----------
      case 'edit-shelf': {
        const cabinet = findCabinet();
        if (!cabinet) break;
        const shelf = cabinet.shelves.find(s => s.id === id);
        if (shelf) {
          editEntity(shelf, 'shelf');
        }
        break;
      }
      case 'delete-shelf': {
        const cabinet = findCabinet();
        if (!cabinet) break;
        const shelf = cabinet.shelves.find(s => s.id === id);
        if (shelf) {
          deleteEntityWithConfirm(shelf, 'shelf');
        }
        break;
      }

      // ---------- Редактирование/удаление книги ----------
      case 'edit-book': {
        const cabinet = findCabinet();
        if (!cabinet) break;
        for (const shelf of cabinet.shelves) {
          const book = shelf.books.find(b => b.id === id);
          if (book) {
            closeModal();         // закрываем модалку с деталями, если открыта
            editEntity(book, 'book');
            return;
          }
        }
        break;
      }
      case 'delete-book': {
        const cabinet = findCabinet();
        if (!cabinet) break;
        for (const shelf of cabinet.shelves) {
          const book = shelf.books.find(b => b.id === id);
          if (book) {
            deleteEntityWithConfirm(book, 'book');
            return;
          }
        }
        break;
      }
    }
  });

  // Закрытие любого модального окна по клавише Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}