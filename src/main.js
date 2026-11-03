/* Ponto a Ponto — arranque, router e tab bar */
import * as core from './core.js';
import * as ui from './ui.js';
import * as ai from './ai.js';
import { crashedLastTime } from './local-llm.js';
import * as onboarding from './views/onboarding.js';
import * as home from './views/home.js';
import * as train from './views/train.js';
import * as player from './views/player.js';
import * as neuro from './views/neuro.js';
import * as match from './views/match.js';
import * as coach from './views/coach.js';
import * as me from './views/me.js';
import * as goals from './views/goals.js';
import * as tournaments from './views/tournaments.js';
import * as progress from './views/progress.js';
import * as settings from './views/settings.js';
import * as adjust from './views/adjust.js';
import * as science from './views/science.js';

const { S, hooks } = core;
const { $, ic } = ui;
const MODULES = [onboarding, home, train, player, neuro, match, coach, me, goals, tournaments, progress, settings, adjust, science];
const VIEWS = Object.assign({}, ...MODULES.map(m => m.views));

const TABS = [['home', 'ball', 'Hoje'], ['train', 'target', 'Treinar'], ['add', 'plus', 'Registar'], ['coach', 'coach', 'Coach'], ['me', 'me', 'Eu']];
const TAB_OF = { home: 'home', checkin: 'home', challenge: 'home', train: 'train', lesson: 'train', science: 'train', neuro: 'train', reframe: 'train', coach: 'coach', me: 'me', goals: 'me', goal: 'me', goalEdit: 'me', tournaments: 'me', tournament: 'me', tournamentEdit: 'me', progress: 'me', history: 'me', entry: 'me', settings: 'me' };
const TITLES = { home: 'Hoje', train: 'Treinar', coach: 'Coach', me: 'Eu', onboarding: 'Bem-vindo', settings: 'Definições', progress: 'Progresso', goals: 'Objetivos', tournaments: 'Torneios', history: 'Diário' };

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
  if (!S.profile.onboarded && S.view !== 'onboarding') S.view = 'onboarding';
  let html = (VIEWS[S.view] || VIEWS.home)();
  if (html == null) { S.view = 'home'; S.param = null; html = VIEWS.home(); }
  renderTabs();
  $('#main').innerHTML = html;
  document.title = `${TITLES[S.view] ? TITLES[S.view] + ' · ' : ''}Ponto a Ponto`;
  VIEWS[S.view + '_after']?.();
};
hooks.beforeNav = player.stopPlayer;
hooks.toast = ui.toast;

Object.assign(window, core, ui, ...MODULES.map(m => m.handlers || {}));

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#layer').innerHTML) { player.stopPlayer(); ui.closeLayer(); }
});
window.addEventListener('error', e => console.error(e.error || e.message));

core.loadLocal();
// Se o iOS fechou a app enquanto o modelo local carregava (memória), volta ao coach offline.
if (crashedLastTime() && ai.aiSettings().provider === 'local' && ai.aiSettings().localReady) {
  ai.saveAiSettings({ provider: 'rules' });
  setTimeout(() => ui.toast('A IA no telemóvel não terminou de carregar da última vez. Mudei para o coach offline; nas Definições podes escolher o modelo mais leve.', 7000), 800);
}
core.requestPersist();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e)));
}
core.render();
