import { id, now, generateBookVisual } from './utils.js';

export function createBook(title = 'Книга', isbn = '', author = '', description = '') {
  const visual = generateBookVisual();
  return {
    id: id('book'),
    title,
    isbn: isbn || '',
    author: author || '',
    description: description || '',
    visual,
    createdAt: now(),
    updatedAt: now()
  };
}

export function createShelf(name = 'Полка', lengthCm = 100, heightCm = 30, depthCm = 40) {
  return {
    id: id('shelf'),
    name,
    lengthCm: Number(lengthCm) || 100,
    heightCm: Number(heightCm) || 30,
    depthCm: Number(depthCm) || 40,
    books: [],
    createdAt: now(),
    updatedAt: now()
  };
}

export function createCabinet(name = 'Шкаф') {
  return {
    id: id('cabinet'),
    name,
    shelves: [],
    createdAt: now(),
    updatedAt: now()
  };
}

export function createRoom(name = 'Помещение') {
  return {
    id: id('room'),
    name,
    cabinets: [],
    createdAt: now(),
    updatedAt: now()
  };
}

export function createLibrary(name = 'Библиотека') {
  return {
    id: id('library'),
    name,
    rooms: [],
    createdAt: now(),
    updatedAt: now()
  };
}

export function migrateState(state) {
  console.log('🔄 Миграция началась');
  if (!Array.isArray(state.libraries)) state.libraries = [];
  state.libraries = state.libraries.map(lib => {
    lib.rooms = (lib.rooms || []).map(room => {
      room.cabinets = (room.cabinets || []).map(cab => {
        if (cab.books && !cab.shelves) {
          const shelf = createShelf('Основная полка', 100, 30, 40);
          shelf.books = cab.books.map(book => {
            if (!book.visual) book.visual = generateBookVisual();
            return book;
          });
          cab.shelves = [shelf];
          delete cab.books;
        } else if (!cab.shelves) {
          cab.shelves = [createShelf('Основная полка', 100, 30, 40)];
        }
        cab.shelves = cab.shelves.map(s => {
          s.books = (s.books || []).map(book => {
            if (!book.visual) book.visual = generateBookVisual();
            return book;
          });
          if (s.capacity !== undefined) delete s.capacity;
          if (s.heightCm === undefined) s.heightCm = 30;
          if (s.depthCm === undefined) s.depthCm = 40;
          return s;
        });
        return cab;
      });
      return room;
    });
    return lib;
  });
  console.log('🔄 Миграция завершена');
  return state;
}
