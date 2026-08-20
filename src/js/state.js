import { STORAGE_KEY, ACTIVE_KEY } from './constants.js';
import { migrateState } from './factories.js';

export let state = loadState();

export let ui = {
  step: 'libraries',
  libraryId: state.activeLibraryId,
  roomId: null,
  cabinetId: null,
  shelfId: null
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    const libraries = Array.isArray(parsed) ? parsed : [];
    const storedActiveId = localStorage.getItem(ACTIVE_KEY);
    const migrated = migrateState({ libraries, activeLibraryId: storedActiveId });

    const activeLibraryId = migrated.libraries.some(library => library.id === storedActiveId)
      ? storedActiveId
      : (migrated.libraries[0]?.id || null);

    const stateChanged = migrated.libraries !== libraries || activeLibraryId !== storedActiveId;
    const result = { libraries: migrated.libraries, activeLibraryId };

    if (stateChanged) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.libraries));
      if (activeLibraryId) localStorage.setItem(ACTIVE_KEY, activeLibraryId);
      else localStorage.removeItem(ACTIVE_KEY);
    }

    return result;
  } catch (error) {
    console.error('Ошибка загрузки состояния:', error);
    return { libraries: [], activeLibraryId: null };
  }
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.libraries));
    if (state.activeLibraryId && state.libraries.some(library => library.id === state.activeLibraryId)) {
      localStorage.setItem(ACTIVE_KEY, state.activeLibraryId);
    } else {
      state.activeLibraryId = state.libraries[0]?.id || null;
      localStorage.removeItem(ACTIVE_KEY);
      if (state.activeLibraryId) localStorage.setItem(ACTIVE_KEY, state.activeLibraryId);
    }
  } catch (error) {
    console.error('Ошибка сохранения состояния:', error);
  }
}

export function lib() {
  return state.libraries.find(library => library.id === state.activeLibraryId) || null;
}

export function findRoom() {
  const library = lib();
  return library?.rooms?.find(room => room.id === ui.roomId) || null;
}

export function findCabinet() {
  const room = findRoom();
  return room?.cabinets?.find(cabinet => cabinet.id === ui.cabinetId) || null;
}

export function findShelf() {
  const cabinet = findCabinet();
  return cabinet?.shelves?.find(shelf => shelf.id === ui.shelfId) || null;
}

export function findShelfById(shelfId) {
  const cabinet = findCabinet();
  return cabinet?.shelves?.find(shelf => shelf.id === shelfId) || null;
}

export function getParentEntity() {
  if (ui.step === 'rooms') return lib();
  if (ui.step === 'cabinets') return findRoom();
  if (ui.step === 'shelves') return findCabinet();
  if (ui.step === 'books') return findShelf();
  return null;
}

export function updateUI(newUi) {
  Object.assign(ui, newUi);
}
