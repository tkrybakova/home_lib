import { render } from './js/renderMain.js';
import { initEvents } from './js/eventHandlers.js';
import { go } from './js/navigation.js';// или вынести в отдельный navigation.js

// Инициализация приложения
render();
initEvents();

// Экспорт go для использования в других модулях (если нужно)
export { go };