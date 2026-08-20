import { state, ui, persist, findCabinet, getParentEntity } from './state.js';
import { showModal, closeModal } from './modal.js';
import { go } from './navigation.js';
import { addLibrary } from './actions/libraryActions.js';
import { addRoom } from './actions/roomActions.js';
import { addCabinet } from './actions/cabinetActions.js';
import { addShelf } from './actions/shelfActions.js';
import { addBook, addBookByIsbn } from './actions/bookActions.js';
import { editEntity, deleteEntityWithConfirm } from './actions/entityActions.js';

let eventsInitialized = false;

export function initEvents() {
  if (eventsInitialized) return;

  const app = document.querySelector('#app');
  if (!app) throw new Error('Application root #app not found');
  eventsInitialized = true;

  app.addEventListener('click', e => {
    const bookEl = e.target.closest('.book-card');
    if (bookEl && !e.target.closest('button')) {
      const bookId = bookEl.dataset.bookId;
      const cabinet = findCabinet();
      for (const shelf of cabinet?.shelves || []) {
        const book = (shelf.books || []).find(item => item.id === bookId);
        if (book) {
          showModal('book-details', {
            book,
            onEdit: () => editEntity(book, 'book')
          });
          return;
        }
      }
    }

    const container = e.target.closest('.books-container');
    if (container && !e.target.closest('.book-card')) {
      const shelfId = container.dataset.shelfId;
      if (shelfId) addBook(shelfId);
      return;
    }

    const btn = e.target.closest('button');
    if (!btn) return;
    const { action, id, type, shelfId } = btn.dataset;

    switch (action) {
      case 'back':
        switch (ui.step) {
          case 'books': go('shelves', { roomId: ui.roomId, cabinetId: ui.cabinetId }); break;
          case 'shelves': go('cabinets', { roomId: ui.roomId }); break;
          case 'cabinets': go('rooms'); break;
          case 'rooms': go('libraries'); break;
        }
        break;
      case 'add-library': addLibrary(); break;
      case 'add-room': addRoom(); break;
      case 'add-cabinet': addCabinet(); break;
      case 'add-shelf': addShelf(); break;
      case 'add-book': addBook(); break;
      case 'add-book-isbn': addBookByIsbn(); break;
      case 'add-book-to-shelf': addBook(shelfId); break;
      case 'open-library':
        if (!state.libraries.some(library => library.id === id)) break;
        state.activeLibraryId = id;
        persist();
        go('rooms');
        break;
      case 'open-room':
        if (id) go('cabinets', { roomId: id });
        break;
      case 'open-cabinet':
        if (id) go('shelves', { roomId: ui.roomId, cabinetId: id });
        break;
      case 'open-shelf':
        if (id) go('books', { roomId: ui.roomId, cabinetId: ui.cabinetId, shelfId: id });
        break;
      case 'edit-parent': {
        const entity = getParentEntity();
        if (entity) editEntity(entity, type);
        break;
      }
      case 'delete-parent': {
        const entity = getParentEntity();
        if (entity) deleteEntityWithConfirm(entity, type);
        break;
      }
      case 'edit-shelf': {
        const shelf = findCabinet()?.shelves?.find(item => item.id === id);
        if (shelf) editEntity(shelf, 'shelf');
        break;
      }
      case 'delete-shelf': {
        const shelf = findCabinet()?.shelves?.find(item => item.id === id);
        if (shelf) deleteEntityWithConfirm(shelf, 'shelf');
        break;
      }
      case 'edit-book': {
        for (const shelf of findCabinet()?.shelves || []) {
          const book = (shelf.books || []).find(item => item.id === id);
          if (book) {
            closeModal();
            editEntity(book, 'book');
            return;
          }
        }
        break;
      }
      case 'delete-book': {
        for (const shelf of findCabinet()?.shelves || []) {
          const book = (shelf.books || []).find(item => item.id === id);
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
    if (e.key === 'Escape') closeModal();
  });
}
