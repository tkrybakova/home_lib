import { render } from './js/renderMain.js';
import { initEvents } from './js/eventHandlers.js';
import { go } from './js/navigation.js';

render();
initEvents();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed:', error);
    });
  }, { once: true });
}

export { go };
