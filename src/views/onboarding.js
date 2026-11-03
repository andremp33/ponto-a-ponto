/* Onboarding em 7 passos: perfil, jogo, desafios, avaliação, objetivos → radar e plano inicial */
import { S, PK, PN, clone, uid, challengeBias, saveProfile, saveState, plan, back, render } from '../core.js';
import { PILLARS, CHALLENGES } from '../content.js';
import { askJSON, hasAI, addMemory } from '../ai.js';
import { $, esc, ic, C, seg, chipset, chipVals, slider, radar, toast } from '../ui.js';

const STEPS = 7;
const val = id => { const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`); return el ? el.value : ''; };

function onboarding() {
  if (!S.ob) S.ob = clone(S.profile);
  const o = S.ob, st = S.obStep;
  const dots = `<div class="obdots" role="progressbar" aria-label="Passo ${st + 1} de ${STEPS}" aria-valuenow="${st + 1}" aria-valuemin="1" aria-valuemax="${STEPS}">${Array.from({ length: STEPS }, (_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>`;
  const nav = (next = 'Continuar') => `<div class="grid2 mt">${st > 0 ? `<button class="btn secondary" onclick="obBack()">Voltar</button>` : '<span></span>'}<button class="btn" onclick="obNext()">${next}</button></div>`;
  const how = (n, t, s) => `<div class="item static"><span class="lead">${n}</span><span class="tx"><b>${t}</b><small>${s}</small></span></div>`;
  let body = '';
  if (st === 0) body = `<h1>O teu treino mental de ténis.</h1>
    <p class="lede">Um programa diário que se adapta a ti: lições curtas, treino mental guiado, preparação e revisão de jogos, e um coach de IA que conhece o teu jogo.</p>
    <div class="group">${how(1, 'Perfil mental', 'Avalias 8 competências. O plano começa pelas mais fracas.')}${how(2, 'Loop diário', 'Check-in, lição, treino mental, desafio no court e reflexão.')}${how(3, 'Jogos e torneios', 'Preparação, revisão e um coach que aprende contigo.')}</div>
    <p class="hint mt">Leva cerca de 3 minutos. Já tens uma cópia? Podes importá-la nas Definições depois de começar.</p>${nav('Começar')}`;
  if (st === 1) body = `<h1>Quem és em campo</h1>
    <label class="f" for="ob_name">Nome</label><input type="text" id="ob_name" value="${esc(o.name)}" placeholder="Como queres que o coach te trate" autocomplete="given-name">
    <label class="f">Nível</label>${seg('ob_level', ['Clube', 'Competição regional', 'Competição nacional', 'Internacional'], o.level)}
    <label class="f" for="ob_ranking">Ranking ou classificação</label><input type="text" id="ob_ranking" value="${esc(o.ranking)}">
    <div class="grid2"><div><label class="f" for="ob_years">Anos de ténis</label><input type="number" inputmode="numeric" id="ob_years" value="${esc(o.years)}"></div><div><label class="f">Mão</label>${seg('ob_hand', ['Destro', 'Canhoto'], o.hand)}</div></div>
    <label class="f">Esquerda</label>${seg('ob_backhand', ['Uma mão', 'Duas mãos'], o.backhand)}${nav()}`;
  if (st === 2) body = `<h1>O teu jogo</h1>
    <label class="f">Estilo (escolhe vários)</label>${chipset('ob_style', ['Agressivo', 'All-court', 'Contra-atacante', 'Defensivo', 'Serviço-rede', 'Consistente'], o.style)}
    <label class="f">Pancada mais forte</label>${seg('ob_strength', ['Serviço', 'Direita', 'Esquerda', 'Rede'], o.strength)}
    <label class="f">Superfície preferida</label>${seg('ob_surface', ['Terra batida', 'Rápido', 'Indoor'], o.surface)}
    <label class="f" for="ob_extra">Mais alguma coisa sobre o teu jogo?</label><textarea id="ob_extra">${esc(o.extra)}</textarea>${nav()}`;
  if (st === 3) body = `<h1>Onde o mental te falha?</h1><p class="lede">Escolhe tudo o que se aplica. É o ponto de partida do teu plano.</p>${chipset('ob_ch', CHALLENGES, o.challenges)}${nav()}`;
  if (st === 4) body = `<h1>Avaliação inicial</h1><p class="lede">Sê honesto: 1 é o teu maior problema, 10 é um ponto muito forte.</p>
    <div class="group">${PILLARS.map(p => slider('ob_' + p.k, p.n, o.baseline?.[p.k] || 5, p.s)).join('')}</div>${nav()}`;
  if (st === 5) body = `<h1>Objetivos e rotina</h1>
    <label class="f" for="ob_goal">Objetivo principal para esta época</label><textarea id="ob_goal" placeholder="Ex.: entrar no top 200 nacional; ganhar mais jogos de 3 sets">${esc(o.seasonGoal)}</textarea>
    <label class="f">Dias de treino por semana</label>${seg('ob_days', ['2', '3', '4', '5', '6'], o.days)}
    <label class="f">Tempo para o treino mental diário</label>${seg('ob_duration', [['5', '5 min'], ['10', '10 min'], ['15', '15 min']], o.duration)}
    <label class="f" for="ob_cues">Palavras-chave (separadas por vírgulas)</label><input type="text" id="ob_cues" value="${esc((o.cues || []).join(', '))}">
    <p class="hint">Palavras curtas que vais dizer a ti próprio entre pontos.</p>${nav('Ver o meu perfil')}`;
  if (st === 6) {
    const b = o.baseline || {}, bias = challengeBias(o.challenges);
    const ranked = PK.slice().sort((a, c) => ((b[a] || 5) - (bias[a] || 0)) - ((b[c] || 5) - (bias[c] || 0)));
    body = `<h1>O teu perfil mental</h1>
    <div class="panel mt"><div class="chartwrap" id="obRadar"></div></div>
    <div class="panel ink mt"><p class="muted" style="margin:0 0 4px">O teu plano começa por</p><h2>${esc(PN[ranked[0]])} e ${esc(PN[ranked[1]].toLowerCase())}</h2>
      <p class="muted" style="margin-bottom:0">Todos os dias recebes uma lição, um treino mental e um desafio para o court, escolhidos pelas competências mais fracas. O plano ajusta-se a cada jogo e treino que registas.</p></div>
    ${nav('Começar o programa')}`;
  }
  const cancel = S.profile.onboarded ? `<div class="bar"><button class="back" onclick="obCancel()">${ic('x')}Cancelar</button></div>` : '';
  return cancel + dots + body;
}
function obCancel() { S.ob = null; S.obStep = 0; back(); }
function onboardingAfter() { if (S.obStep === 6) radar($('#obRadar'), [{ name: 'Avaliação inicial', values: S.ob.baseline, color: C.s1 }]); }

function collect() {
  const o = S.ob;
  if (S.obStep === 1) { o.name = val('ob_name').trim(); o.level = val('ob_level'); o.ranking = val('ob_ranking').trim(); o.years = val('ob_years'); o.hand = val('ob_hand'); o.backhand = val('ob_backhand'); }
  if (S.obStep === 2) { o.style = chipVals('ob_style'); o.strength = val('ob_strength'); o.surface = val('ob_surface'); o.extra = val('ob_extra'); }
  if (S.obStep === 3) o.challenges = chipVals('ob_ch');
  if (S.obStep === 4) { o.baseline = {}; PK.forEach(k => o.baseline[k] = +val('ob_' + k)); }
  if (S.obStep === 5) { o.seasonGoal = val('ob_goal').trim(); o.days = val('ob_days'); o.duration = val('ob_duration'); o.cues = val('ob_cues').split(',').map(s => s.trim()).filter(Boolean).slice(0, 5); }
}
const top = () => { window.scrollTo(0, 0); $('#main')?.focus({ preventScroll: true }); };
function obBack() { collect(); S.obStep = Math.max(0, S.obStep - 1); render(); top(); }
function obNext() {
  collect();
  if (S.obStep < STEPS - 1) { S.obStep++; render(); top(); return; }
  const was = S.profile.onboarded;
  S.profile = { ...S.profile, ...S.ob, onboarded: true, baselineTs: Date.now() }; S.ob = null; S.obStep = 0;
  if (S.profile.seasonGoal && !S.state.goals.some(g => g.title === S.profile.seasonGoal)) S.state.goals.push({ id: uid(), area: 'ténis', kind: 'resultado', title: S.profile.seasonGoal, deadline: '', progress: 0, steps: [], why: 'Objetivo da época', ts: Date.now() });
  saveProfile(); saveState(); S.view = 'home'; S.stack = []; plan(true); render(); top();
  toast(was ? 'Perfil atualizado' : 'Bem-vindo ao programa');
  if (hasAI() && !was) {
    askJSON(`O jogador acabou de fazer o onboarding. Escreve 3 a 5 notas curtas para a tua memória sobre ele (factos e hipóteses de trabalho a confirmar), com base no perfil e na avaliação inicial. Chave: "memoria" (array de strings, cada uma até 20 palavras).`, 'quick').then(r => addMemory(r.memoria)).catch(e => console.warn(e));
  }
}

export const views = { onboarding, onboarding_after: onboardingAfter };
export const handlers = { obBack, obNext, obCancel };
