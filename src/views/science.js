/* Ciência: estudos de psicologia do desporto aplicados ao ténis */
import { S, PN } from '../core.js';
import { SCIENCE, LEVEL_LABEL } from '../science.js';
import { PILLARS } from '../content.js';
import { esc, ic, J, item, group, secTitle, bar } from '../ui.js';

export const byId = id => SCIENCE.find(s => s.id === id);
const citeShort = s => s.cites.map(c => `${c.a.split(',')[0].replace(/ et al\.?$/, '')}${/,| et al/.test(c.a) ? ' et al.' : ''} ${c.y}`).join('; ');

/** Linha que leva a um estudo (para usar em respostas do coach, lições, etc.). */
export function studyRow(id) {
  const s = byId(id); if (!s) return '';
  return item({ lead: 'book', title: esc(s.t), sub: esc(citeShort(s)), onclick: `go('science','${s.id}')` });
}
export const studyLink = id => byId(id) ? `${secTitle('A ciência por trás')}${group([studyRow(id)])}` : '';
export const studiesForPillar = p => SCIENCE.filter(s => s.p === p);

/** Lista para o separador "Ciência" do Treinar. */
export function scienceList() {
  const f = S.sciFilter || '', list = SCIENCE.filter(s => !f || s.p === f);
  const pillars = PILLARS.filter(p => SCIENCE.some(s => s.p === p.k));
  return `<p class="lede">Estudos publicados sobre psicologia do desporto, resumidos para o court. Cada um tem o link para a fonte.</p>
  <div class="scroller mb" role="tablist" aria-label="Filtrar por competência"><button role="tab" aria-selected="${!f}" class="${!f ? 'on' : ''}" onclick="setSciFilter('')">Todos</button>${pillars.map(p => `<button role="tab" aria-selected="${f === p.k}" class="${f === p.k ? 'on' : ''}" onclick="setSciFilter('${p.k}')">${esc(p.n)}</button>`).join('')}</div>
  ${group(list.map(s => item({ lead: 'book', title: esc(s.t), sub: `${esc(citeShort(s))}`, val: `${s.min} min`, onclick: `go('science','${s.id}')` })))}`;
}
function setSciFilter(k) { S.sciFilter = k; window.render(); }

function science() {
  const s = byId(S.param); if (!s) return null;
  const related = SCIENCE.filter(x => x.p === s.p && x.id !== s.id).slice(0, 2);
  return `${bar()}<p class="faint" style="margin:0">${esc(PN[s.p])}. ${esc(LEVEL_LABEL[s.level])}</p><h1>${esc(s.t)}</h1><p class="lede">${esc(s.q)}</p>
  ${secTitle('O que os estudos encontraram')}<div class="panel prose"><p>${esc(s.find)}</p></div>
  ${secTitle('No court')}<div class="panel"><p style="margin:0">${esc(s.tennis)}</p></div>
  <div class="panel ink mt"><p class="muted" style="margin:0 0 4px">Experimenta</p><p style="margin:0;font-size:18px;line-height:1.4;font-weight:600">${esc(s.try)}</p></div>
  ${secTitle('Fontes')}
  <div class="group">${s.cites.map(c => `<a class="item" href="${esc(c.u)}" target="_blank" rel="noopener"><span class="lead">${ic('book')}</span><span class="tx"><b>${esc(c.a)} (${c.y})</b><small>${esc(c.j)}</small></span><span class="chev">${ic('chev')}</span></a>`).join('')}</div>
  <button class="btn secondary mt" onclick="askCoachAbout(${J(`Sobre o estudo "${s.t}": como aplico isto ao meu jogo esta semana?`)})">${ic('coach')}Perguntar ao coach</button>
  ${related.length ? `${secTitle('Relacionados')}${group(related.map(x => studyRow(x.id)))}` : ''}`;
}

export const views = { science };
export const handlers = { setSciFilter };
