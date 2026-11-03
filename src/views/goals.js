/* Objetivos: mental/ténis × processo/performance/resultado, passos e progresso */
import { S, PN, uid, daysUntil, isoDate, saveState, go, back, replace, render } from '../core.js';
import { PILLARS } from '../content.js';
import { askJSON, hasAI, aiBtn } from '../ai.js';
import { $, esc, ic, item, group, secTitle, seg, slider, formData, bar, checkRow, confirmBox, toast } from '../ui.js';

const label = g => `${g.area === 'mental' ? 'Mental' : 'Ténis'}, ${g.kind}`;
const progressBar = v => `<span class="progress" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i style="width:${v}%"></i></span>`;
const goalRow = g => item({ lead: g.done ? ic('check') : 'target', cls: g.done ? 'done' : '', title: esc(g.title), sub: `${label(g)}${g.deadline ? `, até ${isoDate(g.deadline)}` : ''}${progressBar(g.done ? 100 : g.progress || 0)}`, val: `${g.done ? 100 : g.progress || 0}%`, onclick: `go('goal','${g.id}')` });

function goals() {
  const act = S.state.goals.filter(g => !g.done), done = S.state.goals.filter(g => g.done);
  return `${bar(`<button class="btn small" onclick="go('goalEdit')">${ic('plus')}Novo</button>`)}<h1>Objetivos</h1>
  <p class="lede">Um objetivo de resultado dá direção. Os de processo é que o fazem acontecer.</p>
  ${act.length ? group(act.map(goalRow)) : `<div class="empty">Sem objetivos ativos.<button class="btn" onclick="go('goalEdit')">Criar objetivo</button></div>`}
  ${done.length ? `<details class="more"><summary>Concluídos (${done.length})</summary><div class="inner flush">${done.map(goalRow).join('')}</div></details>` : ''}`;
}

function goalEdit() {
  const g = S.state.goals.find(x => x.id === S.param) || { area: 'mental', kind: 'processo', title: '', deadline: '', why: '', pillar: '' };
  return `${bar()}<h1>${S.param ? 'Editar objetivo' : 'Novo objetivo'}</h1><form onsubmit="saveGoal(event)">
  <label class="f">Área</label>${seg('area', [['mental', 'Mental'], ['ténis', 'Ténis']], g.area)}
  <label class="f">Tipo</label>${seg('kind', [['processo', 'Processo'], ['performance', 'Performance'], ['resultado', 'Resultado']], g.kind)}
  <p class="hint">Processo: o que fazes (rotina em todos os pontos). Performance: um número teu (65% de 1.º serviço). Resultado: ganhar ou subir no ranking.</p>
  <label class="f" for="gTitle">Objetivo</label><input type="text" id="gTitle" name="title" value="${esc(g.title)}" required placeholder="Ex.: fazer o reset em 3 passos depois de todos os erros">
  <label class="f" for="gPillar">Competência ligada</label><select id="gPillar" name="pillar"><option value="">Nenhuma</option>${PILLARS.map(p => `<option value="${p.k}" ${g.pillar === p.k ? 'selected' : ''}>${esc(p.n)}</option>`).join('')}</select>
  <label class="f" for="gDeadline">Prazo</label><input type="date" id="gDeadline" name="deadline" value="${esc(g.deadline)}">
  <label class="f" for="gWhy">Porque é importante para ti?</label><textarea id="gWhy" name="why">${esc(g.why || '')}</textarea>
  <button class="btn mt">Guardar</button></form>`;
}
function saveGoal(ev) {
  ev.preventDefault(); const d = formData(ev.target);
  let g = S.state.goals.find(x => x.id === S.param);
  if (!g) { g = { id: uid(), progress: 0, steps: [], ts: Date.now() }; S.state.goals.push(g); }
  Object.assign(g, { area: d.area, kind: d.kind, title: d.title.trim(), pillar: d.pillar, deadline: d.deadline, why: d.why });
  saveState(); if (S.param) back(); else replace('goal', g.id);
}

function goal() {
  const g = S.state.goals.find(x => x.id === S.param); if (!g) return goals();
  const dd = g.deadline ? daysUntil(g.deadline) : null;
  return `${bar()}<span class="pill ${g.area === 'mental' ? 'ai' : ''}">${label(g)}</span><h1 class="mt">${esc(g.title)}</h1>
  ${g.deadline ? `<p class="muted">Prazo: ${isoDate(g.deadline)}${dd >= 0 ? `, faltam ${dd} ${dd === 1 ? 'dia' : 'dias'}` : ', já passou'}.${g.pillar ? ` Ligado a ${esc(PN[g.pillar].toLowerCase())}.` : ''}</p>` : g.pillar ? `<p class="muted">Ligado a ${esc(PN[g.pillar].toLowerCase())}.</p>` : ''}
  ${g.why ? `<div class="panel"><p class="faint" style="margin:0 0 4px">Porque importa</p><p style="margin:0">${esc(g.why)}</p></div>` : ''}
  <div class="group mt">${slider('gprog', 'Progresso', g.progress || 0, '', { min: 0, max: 100, step: 5, suffix: '%', onchange: `goalProg('${g.id}',this.value)` })}</div>
  <div class="row between" style="margin:26px 2px 8px"><h2 class="sec-title" style="margin:0">Passos</h2>${hasAI() ? `<button class="btn small secondary" id="gStepsAi" onclick="goalSteps('${g.id}')">${ic('spark')}Dividir com o coach</button>` : ''}</div>
  <div class="group">${(g.steps || []).map((s, i) => checkRow(s.done, esc(s.t), `goalStep('${g.id}',${i})`)).join('') || '<p class="hint" style="margin:0;padding:14px 16px">Sem passos ainda.</p>'}
    <div class="row" style="padding:8px 16px 12px"><input type="text" id="gStep" aria-label="Novo passo" placeholder="Novo passo"><button class="btn small" onclick="goalAddStep('${g.id}')" aria-label="Acrescentar passo">${ic('plus')}</button></div></div>
  <div class="grid2 mt"><button class="btn secondary" onclick="go('goalEdit','${g.id}')">Editar</button><button class="btn" onclick="goalToggle('${g.id}')">${g.done ? 'Reabrir' : `${ic('check')}Concluído`}</button></div>
  <button class="btn danger mt" onclick="goalDelete('${g.id}')">${ic('trash')}Apagar objetivo</button>`;
}
const byId = id => S.state.goals.find(x => x.id === id);
function goalProg(id, v) { byId(id).progress = +v; saveState(); }
function goalStep(id, i) {
  const g = byId(id); g.steps[i].done = !g.steps[i].done;
  const n = g.steps.length; if (n) g.progress = Math.round(g.steps.filter(s => s.done).length / n * 100);
  saveState(); render();
}
function goalAddStep(id) { const v = $('#gStep').value.trim(); if (!v) return; byId(id).steps.push({ t: v, done: false }); saveState(); render(); }
function goalToggle(id) { const g = byId(id); g.done = !g.done; if (g.done) g.progress = 100; saveState(); toast(g.done ? 'Objetivo concluído. Parabéns!' : 'Objetivo reaberto'); render(); }
function goalDelete(id) { confirmBox('Apagar este objetivo?', () => { S.state.goals = S.state.goals.filter(x => x.id !== id); saveState(); back(); }); }
async function goalSteps(id) {
  const g = byId(id);
  await aiBtn('#gStepsAi', 'A dividir…', async () => {
    const r = await askJSON(`Divide este objetivo (${g.area}, ${g.kind}) em 3 a 5 passos de processo concretos e mensuráveis, adaptados ao jogador: "${g.title}"${g.deadline ? ' até ' + g.deadline : ''}. Chave: "passos" (array de strings até 14 palavras).`);
    (r.passos || []).forEach(t => g.steps.push({ t: String(t), done: false })); saveState(); render();
  });
}

export const views = { goals, goalEdit, goal };
export const handlers = { saveGoal, goalProg, goalStep, goalAddStep, goalToggle, goalDelete, goalSteps };
