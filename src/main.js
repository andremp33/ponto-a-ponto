/* Ponto a Ponto — arranque, router e tab bar */
import * as core from './core.js';
import * as ui from './ui.js';
import * as ai from './ai.js';
import * as settings from './views/settings.js';

const { S, hooks } = core;
const { $, ic } = ui;
const MODULES = [settings];

const VIEWS = Object.assign({
  home: () => `<h1>Ponto a Ponto</h1><p class="lede">A preparar a app…</p><button class="btn" onclick="go('settings')">Definições</button>`,
}, ...MODULES.map(m => m.views));

const TABS = [['home', 'ball', 'Hoje'], ['train', 'target', 'Treinar'], ['add', 'plus', 'Registar'], ['coach', 'coach', 'Coach'], ['me', 'me', 'Eu']];
const TAB_OF = { home: 'home', train: 'train', coach: 'coach', me: 'me', lesson: 'train', session: 'train', neuro: 'train', reframe: 'train', challenge: 'home', checkin: 'home', goals: 'me', goal: 'me', goalEdit: 'me', tournaments: 'me', tournament: 'me', tournamentEdit: 'me', progress: 'me', history: 'me', entry: 'me', settings: 'me' };

function renderTabs() {
  const bar = $('#tabbar');
  bar.hidden = !S.profile.onboarded || S.view === 'onboarding';
  if (bar.hidden) return;
  const cur = TAB_OF[S.view] || 'home';
  $('#tabs').innerHTML = TABS.map(([v, icon, label]) => v === 'add'
    ? `<button type="button" class="plus" onclick="openAdd()"><span class="p">${ic(icon)}</span>${label}</button>`
    : `<button type="button" class="${cur === v ? 'on' : ''}" ${cur === v ? 'aria-current="page"' : ''} onclick="go('${v}')">${ic(icon)}${label}</button>`).join('');
}

hooks.render = () => {
  renderTabs();
  const fn = VIEWS[S.view] || VIEWS.home;
  $('#main').innerHTML = fn();
  VIEWS[S.view + '_after']?.();
};
hooks.toast = ui.toast;

function openAdd() { ui.toast('Em breve'); }

Object.assign(window, core, ui, { ai }, { openAdd }, ...MODULES.map(m => m.handlers || {}));

core.loadLocal();
navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e)));
}
core.render();
