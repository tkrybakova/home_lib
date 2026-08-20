import { id, now, generateBookVisual, normalizeIsbn, isValidIsbn } from './utils.js';

export function createBook(title = 'Книга', isbn = '', author = '', description = '') {
  const normalizedIsbn = normalizeIsbn(isbn);
  return {
    id: id('book'),
    title: String(title).trim(),
    isbn: normalizedIsbn && isValidIsbn(normalizedIsbn) ? normalizedIsbn : '',
    author: String(author || '').trim(),
    description: String(description || '').trim(),
    visual: generateBookVisual(),
    createdAt: now(),
    updatedAt: now()
  };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function createShelf(name = 'Полка', lengthCm = 100, heightCm = 30, depthCm = 40) {
  return {
    id: id('shelf'),
    name: String(name).trim(),
    lengthCm: positiveNumber(lengthCm, 100),
    heightCm: positiveNumber(heightCm, 30),
    depthCm: positiveNumber(depthCm, 40),
    books: [],
    createdAt: now(),
    updatedAt: now()
  };
}

export function createCabinet(name = 'Шкаф') {
  return {
    id: id('cabinet'),
    name: String(name).trim(),
    shelves: [],
    createdAt: now(),
    updatedAt: now()
  };
}

export function createRoom(name = 'Помещение') {
  return {
    id: id('room'),
    name: String(name).trim(),
    cabinets: [],
    createdAt: now(),
    updatedAt: now()
  };
}

export function createLibrary(name = 'Библиотека') {
  return {
    id: id('library'),
    name: String(name).trim(),
    rooms: [],
    createdAt: now(),
    updatedAt: now()
  };
}

export function migrateState(state) {
  if (!Array.isArray(state.libraries)) state.libraries = [];
  state.libraries = state.libraries.map(lib => {
    lib.rooms = (lib.rooms || []).map(room => {
      room.cabinets = (room.cabinets || []).map(cab => {
        if (cab.books && !cab.shelves) {
          const shelf = createShelf('Основная полка', 100, 30, 40);
          shelf.books = cab.books.map(book => {
            if (!book.visual) book.visual = generateBookVisual();
            if (book.isbn) book.isbn = normalizeIsbn(book.isbn);
            return book;
          });
          cab.shelves = [shelf];
          delete cab.books;
        } else if (!cab.shelves) {
          cab.shelves = [createShelf('Основная полка', 100, 30, 40)];
        }
        cab.shelves = cab.shelves.map(shelf => {
          shelf.books = (shelf.books || []).map(book => {
            if (!book.visual) book.visual = generateBookVisual();
            if (book.isbn) book.isbn = normalizeIsbn(book.isbn);
            return book;
          });
          if (shelf.capacity !== undefined) delete shelf.capacity;
          shelf.lengthCm = positiveNumber(shelf.lengthCm, 100);
          shelf.heightCm = positiveNumber(shelf.heightCm, 30);
          shelf.depthCm = positiveNumber(shelf.depthCm, 40);
          return shelf;
        });
        return cab;
      });
      return room;
    });
    return lib;
  });
  return state;
}
