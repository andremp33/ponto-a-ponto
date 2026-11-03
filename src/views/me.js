/* Eu: perfil mental (radar + barras), modo do programa, atalhos; Diário */
import { S, PK, PN, pillarScores, saveProfile, plan, upcomingTournament, fmtDate, mentalIndex, render } from '../core.js';
import { PILLARS } from '../content.js';
import { $, esc, ic, f1, C, item, group, secTitle, bar, radar, toast } from '../ui.js';

function me() {
  const sc = pillarScores(), b = S.profile.baseline || {}, p = S.profile;
  const sorted = PK.slice().sort((a, c) => (sc[c] ?? 0) - (sc[a] ?? 0));
  const about = [p.level, p.ranking].filter(Boolean).join(', ') + ((p.style || []).length ? `. ${p.style.join(', ')}` : '');
  const ut = upcomingTournament(), activeGoals = S.state.goals.filter(g => !g.done).length;
  return `<div class="row between"><h1>${esc(p.name || 'Eu')}</h1><button class="icon-btn" onclick="go('settings')" aria-label="Definições">${ic('gear')}</button></div>
  <p class="lede">${esc(about)}</p>
  ${secTitle('Perfil mental')}
  <div class="panel"><div class="chartwrap" id="meRadar"></div>
    <div class="legend"><span><i style="background:${C.s1}"></i>Agora</span><span><i class="dash"></i>Avaliação inicial</span></div></div>
  ${secTitle('Competências')}
  <div class="group bars">${sorted.map(k => {
    const v = sc[k], d = v != null && b[k] ? v - b[k] : null;
    return `<div class="b"><div class="lab"><span>${PN[k]}</span><span><span class="val">${f1(v)}</span>${d != null && Math.abs(d) >= 0.1 ? ` <span class="d">${d > 0 ? '+' : '−'}${f1(Math.abs(d))}</span>` : ''}</span></div><div class="track"><i style="width:${(v || 0) * 10}%"></i></div></div>`;
  }).join('')}</div>
  <p class="hint" style="margin:8px 2px 0">Calculado a partir da avaliação inicial, das tuas reflexões e dos check-ins. O número mais pequeno é a diferença para a avaliação inicial.</p>
  <label class="f" for="focusSel">Modo do programa</label>
  <select id="focusSel" onchange="setFocusPillar(this.value)"><option value="">Adaptativo (recomendado)</option>${PILLARS.map(x => `<option value="${x.k}" ${p.focusPillar === x.k ? 'selected' : ''}>Focar só em ${esc(x.n.toLowerCase())}</option>`).join('')}</select>
  ${secTitle('Mais')}
  ${group([
    item({ lead: 'target', title: 'Objetivos', sub: activeGoals === 1 ? '1 ativo' : `${activeGoals} ativos`, onclick: "go('goals')" }),
    item({ lead: 'trophy', title: 'Torneios', sub: ut ? esc(ut.name) : 'Nenhum marcado', onclick: "go('tournaments')" }),
    item({ lead: 'chart', title: 'Progresso', sub: 'Gráficos e revisão semanal', onclick: "go('progress')" }),
    item({ lead: 'list', title: 'Diário', sub: S.entries.length === 1 ? '1 registo' : `${S.entries.length} registos`, onclick: "go('history')" }),
    item({ lead: 'gear', title: 'Definições', sub: 'Coach, voz, lembrete e dados', onclick: "go('settings')" }),
  ])}`;
}
function meAfter() {
  radar($('#meRadar'), [{ name: 'Avaliação inicial', values: S.profile.baseline || {}, color: C.ink3, dash: true }, { name: 'Agora', values: pillarScores(), color: C.s1 }]);
}
function setFocusPillar(v) { S.profile.focusPillar = v; saveProfile(); plan(true); toast('Plano atualizado'); }

const LAB = { checkin: 'Check-in', pre: 'Pré-jogo', post: 'Jogo', practice: 'Treino' };
const LEAD = { checkin: 'sun', pre: 'flag', post: 'pen', practice: 'clock' };
function history() {
  const f = S.histFilter || '', list = S.entries.filter(e => !f || e.type === f);
  const sub = e => {
    const mi = mentalIndex(e);
    const s = e.type === 'checkin' ? `Confiança ${e.confianca}, calma ${e.calma}` : e.type === 'pre' ? `vs ${esc(e.opp || '?')}` : e.type === 'post' ? `vs ${esc(e.opp || '?')} ${esc(e.score || '')}` : esc(e.what || '');
    return `${fmtDate(e.ts)}. ${s}${mi ? `. Índice ${f1(mi)}` : ''}`;
  };
  return `${bar()}<h1 style="margin-bottom:14px">Diário</h1>
  <div class="scroller mb" role="tablist" aria-label="Filtrar">${[['', 'Tudo'], ['post', 'Jogos'], ['practice', 'Treinos'], ['pre', 'Pré-jogo'], ['checkin', 'Check-ins']].map(([k, l]) => `<button role="tab" aria-selected="${f === k}" class="${f === k ? 'on' : ''}" onclick="setHistFilter('${k}')">${l}</button>`).join('')}</div>
  ${list.length ? group(list.map(e => item({ lead: LEAD[e.type], title: LAB[e.type], sub: sub(e), val: e.result ? `<span class="pill ${e.result === 'vitória' ? 'win' : 'loss'}">${e.result === 'vitória' ? 'V' : 'D'}</span>` : '', onclick: `go('entry','${e.id}')` })))
    : `<div class="empty">Ainda não há registos.<button class="btn" onclick="openAdd()">Registar</button></div>`}`;
}
function setHistFilter(k) { S.histFilter = k; render(); }

export const views = { me, me_after: meAfter, history };
export const handlers = { setFocusPillar, setHistFilter };
