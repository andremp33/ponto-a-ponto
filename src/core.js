/* Ponto a Ponto — estado, utilitários, armazenamento, motor do programa e navegação */
import { PILLARS, LESSONS, SESSIONS, PILLAR_TRAINING } from './content.js';

export const PK = PILLARS.map(p => p.k);
export const PN = Object.fromEntries(PILLARS.map(p => [p.k, p.n]));
export const CHECK = [['energia', 'Energia'], ['confianca', 'Confiança'], ['foco', 'Foco'], ['calma', 'Calma']];
export const CH_MAP = { 'Ficar nervoso no início dos jogos': 'emocoes', 'Fechar sets e jogos': 'pressao', 'Irritar-me com erros não forçados': 'reset', 'Perder a concentração': 'foco', 'Adversários que devolvem tudo': 'foco', 'Pensar no resultado': 'foco', 'Linguagem corporal negativa': 'corpo', 'Perder vantagens': 'pressao', 'Jogar contra quem tem ranking pior': 'pressao', 'Duplas faltas sob pressão': 'rotinas', 'Recuperar depois de perder um set': 'reset', 'Batotas e bolas duvidosas': 'emocoes' };
export const LS = 'pap_v3';
const LEGACY_LS = 'pap_v2';

export const DEFAULT_PROFILE = {
  onboarded: false, name: '', level: 'Clube', ranking: '', years: '',
  style: [], strength: 'Direita', surface: 'Terra batida', hand: 'Destro', backhand: 'Duas mãos',
  extra: '', challenges: [], baseline: {}, seasonGoal: '', days: '4', duration: '10',
  cues: ['Respira', 'Pés', 'Agressivo'], focusPillar: '', weekFocus: '', coachMemory: [], voice: true, reminder: '19:00'
};
export const DEFAULT_STATE = { goals: [], tournaments: [], lessonsDone: {}, neuro: [], days: {}, insights: {}, reframes: [], sessionsLog: [], customSessions: [], reviews: [] };

export const S = {
  profile: { ...DEFAULT_PROFILE }, state: clone(DEFAULT_STATE), entries: [], chat: [],
  view: 'home', param: null, stack: [],
  ob: null, obStep: 0, trainTab: 'hoje', libFilter: '', histFilter: '', chatDraft: '', seenLoop: null,
};

/* main.js liga estes ganchos (evita imports circulares entre vistas e router). */
export const hooks = { render() {}, beforeNav() {}, toast() {} };
export const render = () => hooks.render();
const notify = (m, ms) => hooks.toast(m, ms);

/* ===== utilitários ===== */
export function clone(o) { return JSON.parse(JSON.stringify(o)); }
export const dayKey = d => { d = new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const TODAY = () => dayKey(Date.now());
export const fmtDate = ts => new Date(ts).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
export const shortDate = ts => new Date(ts).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
export const longDate = (ts = Date.now()) => new Date(ts).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
export const isoDate = s => s ? new Date(s + 'T12:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
export const daysUntil = d => Math.round((new Date(d + 'T12:00').getTime() - new Date(TODAY() + 'T12:00').getTime()) / 864e5);
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ===== armazenamento (localStorage) ===== */
function normalizeEntries(list) {
  return (Array.isArray(list) ? list : [])
    .filter(e => e && e.id && e.type)
    .map(e => e.type === 'post' && e.kind === 'treino' ? { ...e, type: 'practice', what: 'Treino', quality: '–', intentDone: '–' } : e)
    .sort((a, b) => b.ts - a.ts);
}
function applyData(d) {
  S.profile = { ...DEFAULT_PROFILE, ...(d.profile || {}) };
  S.state = { ...clone(DEFAULT_STATE), ...(d.state || {}) };
  S.entries = normalizeEntries(d.entries);
  S.chat = Array.isArray(d.chat) ? d.chat.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : [];
}
export function loadLocal() {
  try {
    const raw = localStorage.getItem(LS) ?? localStorage.getItem(LEGACY_LS);
    if (raw) applyData(JSON.parse(raw));
  } catch (e) { console.warn('load', e); }
}
function persist() {
  try {
    localStorage.setItem(LS, JSON.stringify({ profile: S.profile, state: S.state, entries: S.entries, chat: S.chat }));
  } catch (e) {
    console.warn('save', e);
    notify('Não consegui guardar: o espaço do navegador está cheio. Exporta uma cópia nas Definições.', 5000);
  }
}
function trimState() {
  const st = S.state;
  st.neuro = st.neuro.slice(-200); st.sessionsLog = st.sessionsLog.slice(-300); st.customSessions = st.customSessions.slice(-10); st.reviews = st.reviews.slice(-12);
  const dk = Object.keys(st.days).sort(); if (dk.length > 150) dk.slice(0, dk.length - 150).forEach(k => delete st.days[k]);
  const ik = Object.keys(st.insights).sort(); if (ik.length > 14) ik.slice(0, ik.length - 14).forEach(k => delete st.insights[k]);
}
export function saveState() { trimState(); persist(); }
export function saveProfile() { persist(); }
export function saveChat() { S.chat = S.chat.slice(-40); persist(); }
export function saveEntry(e) {
  const i = S.entries.findIndex(x => x.id === e.id); if (i >= 0) S.entries[i] = e; else S.entries.unshift(e);
  S.entries.sort((a, b) => b.ts - a.ts); persist();
}
export function deleteEntry(id) { S.entries = S.entries.filter(x => x.id !== id); persist(); }
export function resetData() { applyData({}); persist(); }

/* Cópia de segurança. A chave da API fica de fora de propósito. */
export function exportJSON() {
  return JSON.stringify({ app: 'ponto-a-ponto', version: 3, exportedAt: new Date().toISOString(), profile: S.profile, state: S.state, entries: S.entries, chat: S.chat }, null, 1);
}
/** Aceita o formato desta app e o do artifact antigo ({profile, state, entries}). Devolve um resumo ou lança erro. */
export function parseBackup(text) {
  let d;
  try { d = typeof text === 'string' ? JSON.parse(text.trim().replace(/^﻿/, '')) : text; } catch { throw new Error('O texto não é JSON válido.'); }
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Formato desconhecido.');
  if (!d.profile && !d.state && !d.entries) throw new Error('Não encontrei perfil, estado nem registos neste ficheiro.');
  if (d.profile && typeof d.profile !== 'object') throw new Error('Perfil inválido.');
  if (d.state && typeof d.state !== 'object') throw new Error('Estado inválido.');
  if (d.entries && !Array.isArray(d.entries)) throw new Error('Registos inválidos.');
  return { data: d, entries: normalizeEntries(d.entries).length, name: d.profile?.name || '', onboarded: !!d.profile?.onboarded };
}
export function importBackup(d) { applyData(d); persist(); }

/* ===== motor ===== */
export const ofType = (...t) => S.entries.filter(e => t.includes(e.type));
export const reflections = () => ofType('post', 'practice').filter(e => e.skills);
export function pillarScores() {
  const base = S.profile.baseline || {}, refl = reflections().slice(0, 6), checks = ofType('checkin').slice(0, 5), out = {};
  PK.forEach(k => {
    const r = avg(refl.map(e => +e.skills[k]).filter(x => x > 0)); const n = refl.filter(e => +e.skills[k] > 0).length; const b = +base[k] || null;
    let v = r == null ? b : b == null ? r : b * (1 - Math.min(n, 5) / 5 * 0.8) + r * (Math.min(n, 5) / 5 * 0.8);
    const ck = k === 'confianca' ? 'confianca' : k === 'foco' ? 'foco' : k === 'emocoes' ? 'calma' : null;
    if (ck && v != null && checks.length) { const c = avg(checks.map(e => +e[ck]).filter(Boolean)); if (c) v = v * 0.85 + c * 0.15; }
    out[k] = v;
  });
  return out;
}
export function mentalIndex(e) { const v = PK.map(k => +e.skills?.[k]).filter(x => x > 0); return v.length ? avg(v) : null; }
export function overallScore() { const s = pillarScores(); const v = PK.map(k => s[k]).filter(x => x != null); return v.length ? avg(v) : null; }
export function challengeBias(challenges) { const bias = {}; (challenges || []).forEach(c => { const k = CH_MAP[c]; if (k) bias[k] = (bias[k] || 0) + 0.4; }); return bias; }
export function choosePillar(exclude) {
  if (S.profile.focusPillar) return S.profile.focusPillar;
  const sc = pillarScores(), bias = challengeBias(S.profile.challenges);
  const ranked = PK.map(k => ({ k, v: (sc[k] ?? 6) - (bias[k] || 0) })).sort((a, b) => a.v - b.v);
  if (exclude && ranked[0].k === exclude && ranked[1] && ranked[1].v - ranked[0].v < 1) return ranked[1].k;
  return ranked[0].k;
}
export const lastDone = id => S.state.lessonsDone[id] || 0;
function chooseLesson(pillar, matchDay) {
  const pool = matchDay ? ['e3', 'pr3', 'ro3', 'pr1', 'f1', 'r3', 'pr2'].map(id => LESSONS.find(l => l.id === id)).filter(Boolean) : LESSONS.filter(l => l.p === pillar);
  return pool.slice().sort((a, b) => lastDone(a.id) - lastDone(b.id))[0].id;
}
export function isMatchDay() {
  const t = TODAY(); const ci = ofType('checkin').find(e => dayKey(e.ts) === t);
  if (ci && ci.plan === 'jogo') return true;
  if (ofType('pre').some(e => dayKey(e.ts) === t)) return true;
  return S.state.tournaments.some(x => x.start && x.start <= t && (x.end || x.start) >= t);
}
export function plan(force) {
  const t = TODAY(); let d = S.state.days[t];
  const md = isMatchDay();
  if (!d || !d.plan || (force && !d.done?.lesson) || (d.plan.matchDay !== md && !d.done?.lesson && !d.done?.training)) {
    const y = S.state.days[dayKey(Date.now() - 864e5)];
    const pillar = choosePillar(y?.plan?.pillar);
    const lesson = chooseLesson(pillar, md);
    const lp = LESSONS.find(l => l.id === lesson).p;
    d = { plan: { pillar: md ? lp : pillar, lesson, training: md ? 'vis_prejogo' : PILLAR_TRAINING[pillar], matchDay: md }, done: { ...(d?.done || {}) }, challengeNote: d?.challengeNote || '' };
    S.state.days[t] = d; saveState();
  }
  return d;
}
export function markDone(step) { const d = plan(); if (!d.done[step]) { d.done[step] = Date.now(); saveState(); } }
export function loopStatus() {
  const d = plan(), t = TODAY();
  return {
    checkin: ofType('checkin').some(e => dayKey(e.ts) === t),
    lesson: !!d.done.lesson, training: !!d.done.training, challenge: !!d.done.challenge,
    reflection: ofType('post', 'practice').some(e => dayKey(e.ts) === t),
  };
}
export function activeDays() {
  const s = new Set(S.entries.map(e => dayKey(e.ts)));
  Object.entries(S.state.days).forEach(([k, d]) => { if (d.done && Object.keys(d.done).length) s.add(k); });
  return s;
}
export function streak() {
  const days = activeDays(); const d = new Date(); let n = 0;
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function activityCounts() {
  const cnt = {};
  S.entries.forEach(e => { const k = dayKey(e.ts); cnt[k] = (cnt[k] || 0) + 1; });
  Object.entries(S.state.days).forEach(([k, d]) => { cnt[k] = (cnt[k] || 0) + Object.keys(d.done || {}).length; });
  return cnt;
}
export function currentFocus() {
  if (S.profile.weekFocus) return { text: S.profile.weekFocus, src: 'Definido por ti' };
  const r = S.state.reviews.slice(-1)[0]; if (r && Date.now() - r.ts < 8 * 864e5 && r.foco_proximo) return { text: r.foco_proximo, src: 'Da revisão semanal' };
  const last = ofType('post', 'practice').find(e => e.ai?.foco_proximo); if (last) return { text: last.ai.foco_proximo, src: 'Sugerido pelo coach' };
  return null;
}
export const upcomingTournament = () => S.state.tournaments.filter(t => t.start && (t.end || t.start) >= TODAY()).sort((a, b) => a.start.localeCompare(b.start))[0];
export function winLoss() { const g = ofType('post'); return [g.filter(e => e.result === 'vitória').length, g.filter(e => e.result === 'derrota').length]; }
export function trainingInfo(id) {
  if (SESSIONS[id]) return SESSIONS[id];
  if (id === 'neuro_schulte') return { n: 'Grelha de foco', min: 2, p: 'foco', d: 'Encontra os números de 1 a 25 por ordem, o mais rápido possível.' };
  if (id === 'neuro_react') return { n: 'Tempo de reação', min: 1, p: 'foco', d: 'Toca no ecrã assim que mudar de cor.' };
  if (id === 'reframe') return { n: 'Do crítico ao treinador', min: 4, p: 'dialogo', d: 'Transforma as tuas frases críticas em frases úteis.' };
  const c = S.state.customSessions.find(x => x.id === id);
  if (c) return { n: c.n, min: Math.round(c.steps.reduce((a, s) => a + s[0], 0) / 60) || 3, p: 'confianca', d: c.d || '' };
  return { n: 'Treino', min: 3 };
}

/* ===== navegação ===== */
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
