import { render } from './js/render.js';
import { initEvents } from './js/eventHandlers.js';
import { go } from './js/modal.js';// или вынести в отдельный navigation.js

// Инициализация приложения
render();
initEvents();

// Экспорт go для использования в других модулях (если нужно)
export { go };