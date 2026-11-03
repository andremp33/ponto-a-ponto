/* Progresso: consistência, índice mental, check-ins, Schulte e revisão semanal */
import { S, ofType, reflections, mentalIndex, avg, streak, activeDays, activityCounts, daysUntil, dayKey, shortDate, saveState, saveProfile, go, render } from '../core.js';
import { askJSON, hasAI, aiBtn, aiOff, aiSections, addMemory } from '../ai.js';
import { $, esc, J, ic, f1, C, secTitle, bar, lineChart, heatmap, heatColor, toast } from '../ui.js';

function reviewCard(r) {
  return `<div class="panel ink"><p class="muted" style="margin:0 0 4px">Revisão semanal de ${shortDate(r.ts)}</p><h2 style="margin-bottom:6px">${esc(r.titulo || '')}</h2>
    ${aiSections(r, [['o_que_mudou', 'O que mudou'], ['padroes', 'Padrões'], ['prioridade', 'Prioridade'], ['plano', 'Plano para 7 dias']])}
    ${r.foco_proximo ? `<button class="btn small mt" style="background:var(--ball);color:var(--ink)" onclick="useFocus(${J(r.foco_proximo)})">Usar como foco: ${esc(r.foco_proximo)}</button>` : ''}</div>`;
}
function progress() {
  const posts = ofType('post'), refl = reflections(), checks = ofType('checkin');
  const mi = list => { const v = list.map(mentalIndex).filter(Boolean); return v.length ? f1(avg(v)) : '–'; };
  const w = posts.filter(e => e.result === 'vitória'), l = posts.filter(e => e.result === 'derrota');
  const lastRev = S.state.reviews.slice(-1)[0], hasSchulte = S.state.neuro.some(x => x.t === 'schulte');
  return `${bar()}<h1 style="margin-bottom:14px">Progresso</h1>
  <div class="nums"><div><b class="display">${streak()}</b><span>dias seguidos</span></div><div><b class="display">${mi(w)}</b><span>índice mental nas vitórias</span></div><div><b class="display">${mi(l)}</b><span>índice nas derrotas</span></div></div>
  ${secTitle('Consistência nas últimas 8 semanas')}
  <div class="panel"><div id="heat"></div><div class="legend"><span>Menos</span>${[0, 1, 2, 3].map(i => `<i style="background:${heatColor(i)}"></i>`).join('')}<span>Mais</span></div></div>
  ${refl.length ? `${secTitle('Índice mental por sessão')}<div class="panel"><div class="chartwrap" id="c1"></div><p class="hint" style="margin-bottom:0">Média das 8 competências em cada reflexão. Toca num ponto para ver o detalhe.</p></div>` : ''}
  ${checks.length > 1 ? `${secTitle('Check-ins: confiança e calma')}<div class="panel"><div class="chartwrap" id="c2"></div><div class="legend"><span><i style="background:${C.s1}"></i>Confiança</span><span><i style="background:${C.s2}"></i>Calma</span></div></div>` : ''}
  ${hasSchulte ? `${secTitle('Grelha de foco, em segundos')}<div class="panel"><div class="chartwrap" id="c3"></div><p class="hint" style="margin-bottom:0">Menos é melhor.</p></div>` : ''}
  ${!refl.length && checks.length < 2 ? `<div class="empty">Faz check-ins e reflexões para veres aqui a tua evolução.</div>` : ''}
  ${secTitle('Revisão semanal')}
  ${hasAI() ? `<button class="btn" id="weekBtn" onclick="weeklyReview()">${ic('spark')}Pedir revisão semanal ao coach</button>` : aiOff('a revisão semanal')}
  <div id="weekOut" class="mt">${lastRev ? reviewCard(lastRev) : ''}</div>`;
}
function progressAfter() {
  const refl = reflections().slice(0, 15).reverse();
  lineChart($('#c1'), [{ name: 'Índice', color: C.s1, values: refl.map(mentalIndex) }], { min: 1, max: 10, labels: refl.map(e => shortDate(e.ts)), extra: i => { const e = refl[i]; return e.type === 'post' ? `<br>${esc(e.result || '')} vs ${esc(e.opp || '?')}` : '<br>Treino'; } });
  const ch = ofType('checkin').slice(0, 14).reverse();
  lineChart($('#c2'), [{ name: 'Confiança', color: C.s1, values: ch.map(e => e.confianca) }, { name: 'Calma', color: C.s2, values: ch.map(e => e.calma) }], { min: 1, max: 10, labels: ch.map(e => shortDate(e.ts)), fmt: v => String(v) });
  const sn = S.state.neuro.filter(x => x.t === 'schulte').slice(-15);
  if (sn.length) {
    const vals = sn.map(x => x.ms / 1000);
    lineChart($('#c3'), [{ name: 'Tempo', color: C.s1, values: vals }], { min: Math.floor(Math.min(...vals) * 0.8), max: Math.ceil(Math.max(...vals) * 1.1), labels: sn.map(x => shortDate(x.ts)), fmt: v => f1(v) + ' s' });
  }
  heatmap($('#heat'), activityCounts(), dayKey);
}
async function weeklyReview() {
  await aiBtn('#weekBtn', 'O coach está a rever a tua semana…', async () => {
    const r = await askJSON(`Faz a revisão dos últimos 7-14 dias. Considera consistência do loop diário (${[...activeDays()].filter(k => daysUntil(k) >= -7).length} dias ativos na última semana), jogos, treinos, check-ins, objetivos e perfil mental. Chaves: "titulo" (até 8 palavras), "o_que_mudou" (2 frases), "padroes" (array de 2-3 padrões concretos), "prioridade" (a única coisa a trabalhar a seguir), "plano" (array de 3 ações para 7 dias), "foco_proximo" (máx. 8 palavras), "memoria" (array 0-2 notas novas para a tua memória).`);
    r.ts = Date.now(); addMemory(r.memoria); S.state.reviews.push(r); saveState(); render();
  });
}
function useFocus(t) { S.profile.weekFocus = t; saveProfile(); toast('Foco da semana atualizado'); go('home'); }

export const views = { progress, progress_after: progressAfter };
export const handlers = { weeklyReview, useFocus };
