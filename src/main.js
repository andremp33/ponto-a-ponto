/* Ponto a Ponto — arranque, router e tab bar */
import { S, hooks, go, back, replace, render } from './core.js';
import * as ui from './ui.js';
const { $, ic } = ui;

const VIEWS = {
  home: () => `<h1>Ponto a Ponto</h1><p class="lede">A preparar a app…</p>`,
};

const TABS = [['home', 'ball', 'Hoje'], ['train', 'target', 'Treinar'], ['add', 'plus', 'Registar'], ['coach', 'coach', 'Coach'], ['me', 'me', 'Eu']];
const TAB_OF = { home: 'home', train: 'train', coach: 'coach', me: 'me' };

function renderTabs() {
  const cur = TAB_OF[S.view] || 'home';
  $('#tabbar').hidden = false;
  $('#tabs').innerHTML = TABS.map(([v, icon, label]) => v === 'add'
    ? `<button type="button" class="plus" onclick="openAdd()" aria-label="${label}"><span class="p">${ic(icon)}</span>${label}</button>`
    : `<button type="button" class="${cur === v ? 'on' : ''}" ${cur === v ? 'aria-current="page"' : ''} onclick="go('${v}')">${ic(icon)}${label}</button>`).join('');
}

hooks.render = () => {
  renderTabs();
  const fn = VIEWS[S.view] || VIEWS.home;
  $('#main').innerHTML = fn();
  VIEWS[S.view + '_after']?.();
};

function openAdd() { ui.toast('Em breve'); }

Object.assign(window, { S, go, back, replace, render, openAdd, closeLayer: ui.closeLayer, segPick: ui.segPick, chipToggle: ui.chipToggle, sliderInput: ui.sliderInput });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e)));
}
render();
