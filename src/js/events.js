import {
  state,
  ui,
  persist,
  findCabinet,
  getParentEntity
} from './state.js';

import { showModal, closeModal } from './modal.js';

import {
  addLibrary,
  addRoom,
  addCabinet,
  addShelf,
  addBook,
  addBookByIsbn,
  editEntity,
  deleteEntityWithConfirm
} from './crud.js';

import { render } from './render.js';

export function go(step, payload = {}) {
  Object.assign(ui, {
    step,
    roomId: null,
    cabinetId: null,
    shelfId: null,
    ...payload
  });

  render();
}

export function initEvents() {
  const app = document.querySelector('#app');

  app.addEventListener('click', e => {

    // Открытие книги
    const bookEl = e.target.closest('.book');

    if (bookEl && !e.target.closest('button')) {
      const bookId = bookEl.dataset.bookId;
      const cabinet = findCabinet();

      if (cabinet) {
        for (const shelf of cabinet.shelves) {
          const book = shelf.books.find(b => b.id === bookId);

          if (book) {
            showModal('book-details', { book });
            return;
          }
        }
      }
    }

    // Клик по пустому месту полки
    const container = e.target.closest('.books-container');

    if (container && !e.target.closest('.book')) {
      const shelfId = container.dataset.shelfId;

      if (shelfId) {
        addBook(shelfId);
      }

      return;
    }

    const btn = e.target.closest('button');

    if (!btn) return;

    const {
      action,
      id,
      type,
      shelfId
    } = btn.dataset;

    switch (action) {

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

      case 'open-library':
        state.activeLibraryId = id;
        persist();
        go('rooms');
        break;

      case 'open-room':
        go('cabinets', {
          roomId: id
        });
        break;

      case 'open-cabinet':
        go('shelves', {
          roomId: ui.roomId,
          cabinetId: id
        });
        break;

      case 'open-shelf':
        go('books', {
          roomId: ui.roomId,
          cabinetId: ui.cabinetId,
          shelfId: id
        });
        break;

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

      case 'edit-book': {
        const cabinet = findCabinet();

        if (!cabinet) break;

        for (const shelf of cabinet.shelves) {
          const book = shelf.books.find(b => b.id === id);

          if (book) {
            closeModal();
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

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}