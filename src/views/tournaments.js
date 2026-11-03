/* Torneios: contagem decrescente, plano IA com checklist por fase, jogos ligados */
import { S, uid, daysUntil, isoDate, TODAY, saveState, plan, go, back, replace, render } from '../core.js';
import { askJSON, hasAI, aiBtn, aiOff } from '../ai.js';
import { esc, ic, item, group, secTitle, seg, formData, bar, checkRow, confirmBox } from '../ui.js';
import { adjustBlock } from './adjust.js';

const dates = t => `${isoDate(t.start)}${t.end && t.end !== t.start ? ` a ${isoDate(t.end)}` : ''}`;
function status(t) {
  const dd = daysUntil(t.start);
  if ((t.end || t.start) < TODAY()) return 'Terminado';
  if (dd <= 0) return 'A decorrer';
  return dd === 1 ? 'Amanhã' : `Em ${dd} dias`;
}
const matchesOf = (t, types = ['post']) => S.entries.filter(e => types.includes(e.type) && e.tournament === t.id);

function tournaments() {
  const all = S.state.tournaments.slice().sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  return `${bar(`<button class="btn small" onclick="go('tournamentEdit')">${ic('plus')}Novo</button>`)}<h1>Torneios</h1>
  <p class="lede">Marca os próximos para receberes um plano de preparação.</p>
  ${all.length ? group(all.map(t => {
    const ms = matchesOf(t), w = ms.filter(e => e.result === 'vitória').length, l = ms.filter(e => e.result === 'derrota').length;
    return item({ lead: 'trophy', title: esc(t.name), sub: `${dates(t)}${t.surface ? `, ${esc(t.surface.toLowerCase())}` : ''}${ms.length ? `. ${w} V, ${l} D` : ''}`, val: status(t), onclick: `go('tournament','${t.id}')` });
  })) : `<div class="empty">Sem torneios.<button class="btn" onclick="go('tournamentEdit')">Adicionar torneio</button></div>`}`;
}

function tournamentEdit() {
  const t = S.state.tournaments.find(x => x.id === S.param) || { name: '', start: '', end: '', place: '', surface: 'Terra', goal: '', notes: '' };
  return `${bar()}<h1>${S.param ? 'Editar torneio' : 'Novo torneio'}</h1><form onsubmit="saveTournament(event)">
  <label class="f" for="tName">Nome</label><input type="text" id="tName" name="name" value="${esc(t.name)}" required>
  <div class="grid2"><div><label class="f" for="tStart">Início</label><input type="date" id="tStart" name="start" value="${esc(t.start)}" required></div><div><label class="f" for="tEnd">Fim</label><input type="date" id="tEnd" name="end" value="${esc(t.end)}"></div></div>
  <label class="f" for="tPlace">Local</label><input type="text" id="tPlace" name="place" value="${esc(t.place)}">
  <label class="f">Superfície</label>${seg('surface', ['Terra', 'Rápido', 'Indoor'], t.surface)}
  <label class="f" for="tGoal">Objetivo para o torneio</label><input type="text" id="tGoal" name="goal" value="${esc(t.goal)}" placeholder="Ex.: chegar aos quartos; competir cada ponto">
  <label class="f" for="tNotes">Notas (horários, viagem, quadro…)</label><textarea id="tNotes" name="notes">${esc(t.notes)}</textarea>
  <button class="btn mt">Guardar</button></form>`;
}
function saveTournament(ev) {
  ev.preventDefault(); const d = formData(ev.target);
  let t = S.state.tournaments.find(x => x.id === S.param);
  if (!t) { t = { id: uid(), checks: {}, ts: Date.now() }; S.state.tournaments.push(t); }
  Object.assign(t, { name: d.name.trim(), start: d.start, end: d.end && d.end >= d.start ? d.end : d.start, place: d.place, surface: d.surface, goal: d.goal, notes: d.notes });
  saveState(); plan(); if (S.param) back(); else replace('tournament', t.id);
}

const PHASES = [['antes', 'Semana antes'], ['vespera', 'Véspera'], ['dia_de_jogo', 'Dia de jogo'], ['entre_jogos', 'Entre jogos'], ['depois_derrota', 'Se perderes']];
function tournament() {
  const t = S.state.tournaments.find(x => x.id === S.param); if (!t) return tournaments();
  const dd = daysUntil(t.start), ms = matchesOf(t, ['post', 'pre']), posts = ms.filter(e => e.type === 'post'), p = t.plan;
  const sect = (k, l) => p?.[k]?.length ? `${secTitle(l)}<div class="group">${p[k].map((x, i) => { const ck = k + i; return checkRow(!!t.checks?.[ck], esc(x), `tCheck('${t.id}','${ck}')`); }).join('')}</div>` : '';
  return `${bar()}<h1>${esc(t.name)}</h1><p class="muted">${dates(t)}${t.surface ? `, ${esc(t.surface.toLowerCase())}` : ''}${t.place ? `, ${esc(t.place)}` : ''}.</p>
  <div class="nums"><div><b class="display">${dd > 0 ? dd : '–'}</b><span>${dd > 0 ? (dd === 1 ? 'dia até começar' : 'dias até começar') : status(t).toLowerCase()}</span></div><div><b class="display">${posts.filter(e => e.result === 'vitória').length}</b><span>vitórias</span></div><div><b class="display">${posts.filter(e => e.result === 'derrota').length}</b><span>derrotas</span></div></div>
  ${t.goal ? `<div class="panel ink mt"><p class="muted" style="margin:0 0 4px">Objetivo</p><h3>${esc(t.goal)}</h3></div>` : ''}
  ${p ? `${p.foco_mental ? `${secTitle('Foco mental para o torneio')}<div class="panel"><p class="display takeaway" style="margin:0">${esc(p.foco_mental)}</p></div>` : ''}${PHASES.map(([k, l]) => sect(k, l)).join('')}
    ${adjustBlock('tournament', t.id, { title: 'Afinar o plano com o coach', defaults: ['Viajo na véspera', 'Jogo duas vezes por dia', 'Estou com pouco ritmo'] })}
    ${hasAI() ? `<button class="btn text" id="tpBtn" onclick="tPlan('${t.id}')">Refazer o plano do zero</button>` : ''}`
    : hasAI() ? `<div class="panel mt"><p class="muted" style="margin-top:0">O coach cria um plano de preparação: semana antes, véspera, dia de jogo, entre jogos e o que fazer se perderes.</p><button class="btn" id="tpBtn" onclick="tPlan('${t.id}')">${ic('spark')}Criar plano do torneio</button></div>` : `<div class="mt">${aiOff('o plano do torneio')}</div>`}
  ${secTitle('Jogos')}
  ${group([...ms.map(e => item({ lead: e.type === 'pre' ? 'flag' : 'pen', title: `${e.type === 'pre' ? 'Pré-jogo' : 'Jogo'} vs ${esc(e.opp || '?')}`, sub: esc(e.round || ''), val: e.result ? `<span class="pill ${e.result === 'vitória' ? 'win' : 'loss'}">${e.result === 'vitória' ? 'V' : 'D'}</span>` : '', onclick: `go('entry','${e.id}')` })),
    item({ lead: 'flag', title: 'Preparar jogo', onclick: "go('pre')" }), item({ lead: 'pen', title: 'Rever jogo', onclick: "go('post')" })])}
  ${t.notes ? `${secTitle('Notas')}<div class="panel"><p class="ai-text" style="margin:0">${esc(t.notes)}</p></div>` : ''}
  <div class="grid2 mt"><button class="btn secondary" onclick="go('tournamentEdit','${t.id}')">Editar</button><button class="btn secondary" onclick="tDelete('${t.id}')">${ic('trash')}Apagar</button></div>`;
}
function tCheck(id, k) { const t = S.state.tournaments.find(x => x.id === id); t.checks = t.checks || {}; t.checks[k] = !t.checks[k]; saveState(); render(); }
function tDelete(id) { confirmBox('Apagar este torneio?', () => { S.state.tournaments = S.state.tournaments.filter(x => x.id !== id); saveState(); back(); }, 'Apagar', { detail: 'Os jogos registados ficam no diário.' }); }
async function tPlan(id) {
  const t = S.state.tournaments.find(x => x.id === id);
  await aiBtn('#tpBtn', 'O coach está a planear…', async () => {
    t.plan = await askJSON(`Cria um plano de preparação mental e prática para o torneio "${t.name}" (${t.start} a ${t.end}, ${t.surface}, ${t.place || ''}). Objetivo: ${t.goal || '-'}. Notas: ${t.notes || '-'}. Adapta às competências mais fracas do jogador. Chaves (arrays de 3-5 itens curtos e acionáveis, até 16 palavras cada): "antes" (semana antes), "vespera", "dia_de_jogo" (inclui aquecimento e rotina pré-jogo com timings), "entre_jogos" (recuperação física e mental entre rondas), "depois_derrota" (como processar uma derrota no torneio); e "foco_mental" (string, máx. 10 palavras); e "sugestoes" (array de 3 respostas curtas que o jogador pode tocar para ajustar o plano, na voz dele).`);
    t.checks = {}; t.thread = []; saveState(); render();
  });
}

export const views = { tournaments, tournamentEdit, tournament };
export const handlers = { saveTournament, tCheck, tDelete, tPlan };
