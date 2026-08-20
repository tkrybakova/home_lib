import { ui } from './state.js';
import { render } from './renderMain.js';

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
