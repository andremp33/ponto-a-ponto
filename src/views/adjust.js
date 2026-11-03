/* Conversa curta para afinar uma proposta do coach (cartão de jogo, análise, plano do torneio, plano do dia).
   O coach propõe primeiro; o jogador toca numa sugestão ou escreve, e o coach devolve a proposta ajustada. */
import { S, TODAY, plan, saveEntry, saveState, setDayPillar, setMatchToday, isMatchDay, render } from '../core.js';
import * as rules from '../rules.js';
import { adjustJSON, hasAI, aiErr, addMemory, aiSettings } from '../ai.js';
import { $, esc, J, ic, spin, toast } from '../ui.js';

const entryOf = id => S.entries.find(e => e.id === id);
const WHAT = { pre: 'cartão de jogo', post: 'análise do jogo', practice: 'feedback do treino' };

/* Cada alvo sabe onde está a proposta, onde guardar a conversa e o que fazer depois de ajustar. */
const TARGETS = {
  entry: {
    obj: id => entryOf(id),
    get: id => entryOf(id)?.ai,
    set: (id, v) => { entryOf(id).ai = v; },
    what: id => WHAT[entryOf(id)?.type] || 'proposta',
    save: id => saveEntry(entryOf(id)),
    after: (id, r) => { if (entryOf(id)?.type === 'post') addMemory(r.memoria); },
  },
  tournament: {
    obj: id => S.state.tournaments.find(t => t.id === id),
    get: id => S.state.tournaments.find(t => t.id === id)?.plan,
    set: (id, v) => { S.state.tournaments.find(t => t.id === id).plan = v; },
    what: () => 'plano do torneio',
    save: () => saveState(),
  },
  brief: {
    obj: () => S.state.briefs[TODAY()],
    get: () => S.state.briefs[TODAY()],
    set: (id, v) => { const old = S.state.briefs[TODAY()]; S.state.briefs[TODAY()] = { ...v, thread: old.thread, ts: old.ts }; },
    what: () => 'plano do coach para hoje (inclui as chaves "pilar" e "dia_de_jogo")',
    save: () => saveState(),
    tier: 'quick',
    after: (id, r) => {
      if (typeof r.dia_de_jogo === 'boolean' && r.dia_de_jogo !== isMatchDay()) setMatchToday(r.dia_de_jogo);
      if (r.pilar) setDayPillar(r.pilar);
    },
  },
};
const thread = (kind, id) => { const o = TARGETS[kind].obj(id); return (o.thread ||= []); };

/** Bloco de conversa. opts: title, defaults (sugestões fixas), compact (só a última resposta). */
export function adjustBlock(kind, id, { title = 'Afinar com o coach', defaults = [], compact = false, onInk = false } = {}) {
  const cur = TARGETS[kind].get(id); if (!cur) return '';
  const th = thread(kind, id), shown = compact ? th.slice(-2) : th;
  const used = new Set(th.filter(m => m.r === 'u').map(m => m.t.toLowerCase()));
  const sugg = [...new Set([...(cur.sugestoes || []), ...defaults])].filter(x => !used.has(String(x).toLowerCase())).slice(0, 6);
  const key = `${kind}:${id}`;
  return `<section class="adjust ${onInk ? 'on-ink' : ''}" data-adj="${esc(key)}" aria-label="${esc(title)}">
    ${title ? `<h2 class="sec-title">${esc(title)}</h2>` : ''}
    ${shown.length ? `<div class="chat">${shown.map(m => `<div class="msg ${m.r === 'u' ? 'u' : 'a'}">${esc(m.t)}</div>`).join('')}</div>` : ''}
    <div class="scroller adj-sugg">${sugg.map(s => `<button onclick="adjustSend(${J(kind)},${J(id)},${J(s)})">${esc(s)}</button>`).join('')}</div>
    <div class="composer inline"><textarea rows="1" class="adj-in" aria-label="Responder ao coach" placeholder="Responde ao coach…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();adjustSend(${J(kind)},${J(id)})}"></textarea><button class="btn adj-send" aria-label="Enviar" onclick="adjustSend(${J(kind)},${J(id)})">${ic('send')}</button></div>
  </section>`;
}

/* Ajuste sem modelo de IA: regras por tipo de proposta. */
function offline(kind, id, cur, text) {
  if (kind === 'brief') return rules.adjustBrief(cur, text, plan());
  const e = kind === 'entry' ? entryOf(id) : null;
  if (e?.type === 'pre') return rules.adjustPre(cur, text, e);
  if (e?.type === 'post') return rules.adjustPost(cur, text, e);
  return { ...cur, resposta: 'Anotei. Para ajustar isto com conversa livre, liga a IA no telemóvel nas Definições (é grátis).' };
}

let busy = false;
async function adjustSend(kind, id, text) {
  if (busy) return;
  const box = document.querySelector(`[data-adj="${CSS.escape(`${kind}:${id}`)}"]`);
  const inp = box?.querySelector('.adj-in');
  text = (text || inp?.value || '').trim(); if (!text) return;
  const T = TARGETS[kind], cur = T.get(id); if (!cur) return;
  busy = true;
  const th = thread(kind, id), before = th.slice();
  if (inp) inp.value = '';
  box?.querySelectorAll('button').forEach(b => b.disabled = true);
  let chat = box?.querySelector('.chat');
  if (box && !chat) { chat = document.createElement('div'); chat.className = 'chat'; box.querySelector('.adj-sugg').before(chat); }
  chat?.insertAdjacentHTML('beforeend', `<div class="msg u">${esc(text)}</div><div class="msg a">${spin('A ajustar…')}</div>`);
  try {
    let r;
    if (!hasAI()) r = offline(kind, id, cur, text);
    else {
      try { r = await adjustJSON(T.what(id), cur, before, text, T.tier || 'default'); }
      catch (e) { if (aiSettings().provider === 'anthropic') throw e; console.warn(e); toast(`${aiErr(e)} Usei o coach offline.`, 4500); r = offline(kind, id, cur, text); }
    }
    th.push({ r: 'u', t: text, ts: Date.now() }, { r: 'c', t: String(r.resposta || 'Ajustei a proposta.'), ts: Date.now() });
    if (th.length > 24) th.splice(0, th.length - 24);
    T.set(id, r); T.after?.(id, r); T.save(id);
    busy = false; render();
    document.querySelector(`[data-adj="${CSS.escape(`${kind}:${id}`)}"]`)?.scrollIntoView({ block: 'center' });
  } catch (e) {
    console.warn(e); busy = false; toast(aiErr(e), 4500); render();
  }
}

export const views = {};
export const handlers = { adjustSend };
