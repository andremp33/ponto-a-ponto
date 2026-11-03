/* Treinar: sessões guiadas, biblioteca de lições, neuro, visualizações IA; lição e reframe */
import { S, PN, plan, markDone, saveState, pillarScores, trainingInfo, lastDone, dayKey, TODAY, shortDate, ofType, upcomingTournament, uid, go, back, render } from '../core.js';
import { PILLARS, LESSONS, SESSIONS, PILLAR_TRAINING } from '../content.js';
import { askJSON, hasAI, aiBtn, aiOff, entryLine } from '../ai.js';
import { $, esc, J, ic, item, group, secTitle, seg, bar, toast } from '../ui.js';
import { openPlayer } from './player.js';

export function startTraining(id) {
  if (id === 'neuro_schulte' || id === 'neuro_react') return go('neuro', id);
  if (id === 'reframe') return go('reframe');
  openPlayer(id);
}
const sessIcon = s => s.kind === 'breath' ? 'wind' : 'heart';
const TABS = [['hoje', 'Sessões'], ['lib', 'Biblioteca'], ['neuro', 'Neuro'], ['ai', 'Personalizado']];

function tabSessions() {
  return `<p class="lede">Treino mental guiado com voz. Usa auriculares.</p>
  ${group([...Object.entries(SESSIONS).map(([id, s]) => item({ lead: sessIcon(s), title: esc(s.n), sub: esc(s.d), val: `${s.min} min`, onclick: `startTraining('${id}')` })),
    item({ lead: 'quote', title: 'Do crítico ao treinador', sub: 'Reescreve as tuas frases críticas', val: '4 min', onclick: "go('reframe')" })])}`;
}
function tabLibrary() {
  const f = S.libFilter, list = LESSONS.filter(l => !f || l.p === f), read = Object.keys(S.state.lessonsDone).length;
  return `<div class="scroller mb" role="tablist" aria-label="Filtrar por competência"><button role="tab" aria-selected="${!f}" class="${!f ? 'on' : ''}" onclick="setLibFilter('')">Todas</button>${PILLARS.map(p => `<button role="tab" aria-selected="${f === p.k}" class="${f === p.k ? 'on' : ''}" onclick="setLibFilter('${p.k}')">${esc(p.n)}</button>`).join('')}</div>
  <p class="hint" style="margin:0 2px 8px">${read} de ${LESSONS.length} lições lidas</p>
  ${group(list.map(l => item({ lead: lastDone(l.id) ? ic('check') : 'book', cls: lastDone(l.id) ? 'done' : '', title: esc(l.t), sub: esc(l.sum), val: `${l.min} min`, onclick: `go('lesson','${l.id}')` })))}`;
}
function tabNeuro() {
  const runs = t => S.state.neuro.filter(x => x.t === t);
  const best = t => { const r = runs(t).map(x => x.ms); return r.length ? Math.min(...r) : null; };
  const last = t => { const r = runs(t); return r.length ? r[r.length - 1].ms : null; };
  const bs = best('schulte'), br = best('react');
  return `<p class="lede">Exercícios curtos de atenção e reação. Faz 2 a 3 vezes por semana e acompanha a evolução.</p>
  ${group([
    item({ lead: 'grid', title: 'Grelha de foco (Schulte)', sub: bs ? `Melhor ${(bs / 1000).toFixed(1)} s. Último ${(last('schulte') / 1000).toFixed(1)} s.` : 'Encontra 1 a 25 por ordem. Treina a atenção seletiva.', val: '2 min', onclick: "go('neuro','neuro_schulte')" }),
    item({ lead: 'zap', title: 'Tempo de reação', sub: br ? `Melhor média ${br} ms. Última ${last('react')} ms.` : '5 tentativas. Treina a prontidão, como na resposta ao serviço.', val: '1 min', onclick: "go('neuro','neuro_react')" }),
  ])}
  ${secTitle('Respiração')}
  ${group([item({ lead: 'wind', title: 'Respiração box 4-4-4-4', val: '3 min', onclick: "startTraining('respiracao_box')" }), item({ lead: 'wind', title: 'Suspiro fisiológico', val: '1 min', onclick: "startTraining('suspiro')" })])}`;
}
function tabCustom() {
  const pre = ofType('pre')[0], t = upcomingTournament();
  const list = S.state.customSessions.slice().reverse();
  return `<p class="lede">O coach cria visualizações à tua medida, a partir do teu perfil e dos próximos jogos.</p>
  ${hasAI() ? `<div class="panel"><label class="f" style="margin-top:0">Para quê?</label>${seg('visFor', [['jogo', 'Próximo jogo'], ['torneio', 'Torneio'], ['situacao', 'Uma situação']], 'jogo')}
    <label class="f" for="visDetail">Detalhes (opcional)</label><textarea id="visDetail" placeholder="${esc(pre ? 'vs ' + (pre.opp || '') + ': ' + (pre.planA || '') : t ? t.name : 'Ex.: fechar o set a servir, adversário que me irrita')}"></textarea>
    <button class="btn mt" id="visBtn" onclick="makeVis()">${ic('spark')}Criar visualização</button></div>` : aiOff('as visualizações personalizadas')}
  ${list.length ? `${secTitle('As tuas visualizações')}${group(list.map(c => item({ lead: 'spark', title: esc(c.n), sub: `${shortDate(c.ts)}. ${esc(c.d || '')}`, onclick: `openPlayer('${c.id}')` })))}` : ''}`;
}
function train() {
  const tab = S.trainTab, sc = pillarScores();
  const weak = Object.keys(PN).sort((a, b) => (sc[a] ?? 6) - (sc[b] ?? 6))[0];
  const rec = trainingInfo(PILLAR_TRAINING[weak]);
  const body = { hoje: tabSessions, lib: tabLibrary, neuro: tabNeuro, ai: tabCustom }[tab] || tabSessions;
  return `<h1 style="margin-bottom:14px">Treinar</h1>
  <div class="scroller mb" role="tablist" aria-label="Secções">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" onclick="setTrainTab('${k}')">${l}</button>`).join('')}</div>
  ${tab === 'hoje' ? `<button class="panel ink rec" onclick="startTraining('${PILLAR_TRAINING[weak]}')"><span class="muted">Recomendado para ti</span><b>${esc(rec.n)}</b><span class="muted">Para ${esc(PN[weak].toLowerCase())}, a tua competência mais baixa.</span></button>` : ''}
  ${body()}`;
}
function setTrainTab(k) { S.trainTab = k; render(); }
function setLibFilter(k) { S.libFilter = k; render(); }

async function makeVis() {
  const kind = document.querySelector('[name=visFor]').value, det = $('#visDetail').value.trim(), pre = ofType('pre')[0], t = upcomingTournament();
  const about = kind === 'jogo' ? `o próximo jogo${pre ? ': ' + entryLine(pre) : ''}` : kind === 'torneio' ? `o torneio${t ? ' ' + t.name + ' (' + (t.surface || '') + '), objetivo ' + (t.goal || '-') : ''}` : 'uma situação específica';
  await aiBtn('#visBtn', 'A criar…', async () => {
    const r = await askJSON(`Cria um guião de visualização guiada (voz, 2.ª pessoa) para ${about}. ${det ? 'Detalhes do jogador: ' + det + '.' : ''} Usa o estilo de jogo, a pancada mais forte e as palavras-chave do jogador. Inclui um momento de erro e reset, e um ponto importante. Chaves: "titulo" (até 6 palavras), "descricao" (1 frase), "passos" (array de 8 a 10 objetos {"texto": frase(s) curtas para ler em voz alta, "segundos": 8-16}).`);
    const steps = (r.passos || []).map(p => [Math.max(6, Math.min(20, +p.segundos || 10)), String(p.texto || '')]).filter(s => s[1]);
    if (!steps.length) throw Object.assign(new Error('vazio'), { code: 'parse' });
    const c = { id: 'c_' + uid(), n: r.titulo || 'Visualização', d: r.descricao || '', steps, ts: Date.now() };
    S.state.customSessions.push(c); saveState(); render(); openPlayer(c.id);
  });
}

function lesson() {
  const l = LESSONS.find(x => x.id === S.param); if (!l) return train();
  const done = lastDone(l.id), today = done && dayKey(done) === TODAY();
  return `${bar()}<p class="faint" style="margin:0">${esc(PN[l.p])}. ${l.min} min de leitura</p><h1>${esc(l.t)}</h1><p class="lede">${esc(l.sum)}</p>
  <div class="panel prose">${l.body.map(p => `<p>${esc(p)}</p>`).join('')}</div>
  ${secTitle('No circuito')}<div class="panel"><p class="pro" style="margin:0">${esc(l.pro)}</p></div>
  ${secTitle('Desafio no court')}<div class="panel"><p style="margin:0">${esc(l.drill)}</p></div>
  <div class="panel ink mt"><p class="muted" style="margin:0 0 4px">Leva contigo</p><p class="display takeaway" style="margin:0">${esc(l.key)}</p></div>
  <button class="btn mt" onclick="finishLesson('${l.id}')" ${today ? 'aria-disabled="true"' : ''}>${today ? `${ic('check')}Lida hoje` : 'Marcar como lida'}</button>
  <button class="btn secondary mt" onclick="askCoachAbout(${J('Sobre a lição "' + l.t + '": como aplico isto ao meu jogo?')})">${ic('coach')}Perguntar ao coach</button>`;
}
function finishLesson(id) {
  S.state.lessonsDone[id] = Date.now();
  if (plan().plan.lesson === id) markDone('lesson');
  saveState(); toast('Lição concluída'); back();
}
function askCoachAbout(text) { S.chatDraft = text; go('coach'); }

const reframe = () => `${bar()}<p class="faint" style="margin:0">Diálogo interno</p><h1>Do crítico ao treinador</h1>
  <p class="lede">Escreve uma frase que dizes a ti próprio quando as coisas correm mal. Depois cria a versão de treinador: instrução ou energia, sem julgamento.</p>
  <div class="panel"><label class="f" for="rfC" style="margin-top:0">O que o crítico diz</label><input type="text" id="rfC" placeholder="Ex.: és mesmo mau, falhas sempre esta bola">
  <label class="f" for="rfT">O que o treinador diria</label><input type="text" id="rfT" placeholder="Ex.: mais altura, pés antes, tu sabes esta bola">
  <div class="grid2 mt"><button class="btn secondary" id="rfAi" onclick="reframeAI()" ${hasAI() ? '' : 'disabled title="Ativa o coach nas Definições"'}>${ic('spark')}Sugestão</button><button class="btn" onclick="reframeSave()">Guardar</button></div></div>
  ${S.state.reframes.length ? `${secTitle('As tuas frases')}<div class="group">${S.state.reframes.slice().reverse().map((r, i) => `<div class="mem"><span><s class="faint">${esc(r.c)}</s><br><b>${esc(r.t)}</b></span><button onclick="reframeDel(${S.state.reframes.length - 1 - i})" aria-label="Apagar frase">${ic('x')}</button></div>`).join('')}</div>` : ''}`;
async function reframeAI() {
  const c = $('#rfC').value.trim(); if (!c) return toast('Escreve primeiro a frase do crítico.');
  await aiBtn('#rfAi', '', async () => {
    const r = await askJSON(`Transforma esta frase de autocrítica de um jogador de ténis numa frase de treinador (instrucional ou motivacional, curta, até 12 palavras, 2.ª pessoa, sem negações): "${c}". Chave: "frase".`, 'quick');
    $('#rfT').value = r.frase || '';
  });
}
function reframeSave() {
  const c = $('#rfC').value.trim(), t = $('#rfT').value.trim();
  if (!c || !t) return toast('Preenche as duas frases.');
  S.state.reframes.push({ c, t, ts: Date.now() });
  if (plan().plan.training === 'reframe') markDone('training');
  saveState(); toast('Frase guardada'); render();
}
function reframeDel(i) { S.state.reframes.splice(i, 1); saveState(); render(); }

export const views = { train, lesson, reframe };
export const handlers = { startTraining, setTrainTab, setLibFilter, makeVis, finishLesson, askCoachAbout, reframeAI, reframeSave, reframeDel };
