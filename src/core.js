/* Ponto a Ponto — estado e navegação */

export const S = { view: 'home', param: null, stack: [] };

/* main.js liga estes ganchos (evita imports circulares entre vistas e router). */
export const hooks = { render() {}, beforeNav() {} };
export const render = () => hooks.render();

const ROOT = { home: 1, train: 1, coach: 1, me: 1 };
function settle() {
  window.scrollTo(0, 0);
  document.getElementById('main')?.focus({ preventScroll: true });
}
export function go(v, param = null) {
  hooks.beforeNav();
  if (!ROOT[v]) S.stack.push([S.view, S.param]); else S.stack = [];
  S.view = v; S.param = param; render(); settle();
}
export function replace(v, param = null) { hooks.beforeNav(); S.view = v; S.param = param; render(); settle(); }
export function back() {
  hooks.beforeNav();
  const p = S.stack.pop();
  if (p) { S.view = p[0]; S.param = p[1]; } else { S.view = 'home'; S.param = null; }
  render(); settle();
}
