import { STORAGE_KEY, ACTIVE_KEY } from './constants.js';
import { migrateState } from './factories.js';

// Состояние приложения
export let state = loadState();

// UI состояние
export let ui = {
  step: 'libraries',
  libraryId: state.activeLibraryId,
  roomId: null,
  cabinetId: null,
  shelfId: null
};

// Загрузка состояния
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    console.log('📂 Читаем из localStorage:', raw);
    const data = JSON.parse(raw || '[]');
    if (!data.length) {
      console.log('📂 Данных нет, возвращаем пустое состояние');
      return { libraries: [], activeLibraryId: null };
    }
    const libs = data;
    const active = localStorage.getItem(ACTIVE_KEY);
    const activeId = libs.find(l => l.id === active)?.id || null;
    const migrated = migrateState({ libraries: libs, activeLibraryId: activeId });
    if (migrated.libraries !== libs) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated.libraries));
      console.log('🔄 Миграция сохранена в localStorage');
    }
    return migrated;
  } catch (e) {
    console.error('❌ Ошибка загрузки состояния:', e);
    return { libraries: [], activeLibraryId: null };
  }
}

// Сохранение
export function persist() {
  console.log('💾 Сохраняем:', state.libraries);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.libraries));
  if (state.activeLibraryId) {
    localStorage.setItem(ACTIVE_KEY, state.activeLibraryId);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

// Получение текущей библиотеки
export function lib() {
  return state.libraries.find(l => l.id === state.activeLibraryId) || null;
}

// Поиск сущностей
export function findRoom() {
  const library = lib();
  if (!library) return null;
  return library.rooms?.find(r => r.id === ui.roomId) || null;
}

export function findCabinet() {
  const room = findRoom();
  if (!room) return null;
  return room.cabinets?.find(c => c.id === ui.cabinetId) || null;
}

export function findShelf() {
  const cabinet = findCabinet();
  if (!cabinet) return null;
  return cabinet.shelves?.find(s => s.id === ui.shelfId) || null;
}

export function findShelfById(shelfId) {
  const cabinet = findCabinet();
  if (!cabinet) return null;
  return cabinet.shelves?.find(s => s.id === shelfId) || null;
}

export function getParentEntity() {
  if (ui.step === 'rooms') return lib();
  if (ui.step === 'cabinets') return findRoom();
  if (ui.step === 'shelves') return findCabinet();
  if (ui.step === 'books') return findShelf();
  return null;
}

// Обновление ui и перерендер (вызывается извне)
export function updateUI(newUi) {
  Object.assign(ui, newUi);
}

// Экспортируем также функции для изменения state (чтобы можно было мутировать)
// но мы будем мутировать напрямую через state