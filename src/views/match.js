/* Jogos e treinos: registar, preparar, rever, refletir e ver um registo */
import { S, PK, PN, CHECK, uid, dayKey, TODAY, daysUntil, fmtDate, ofType, mentalIndex, saveEntry, deleteEntry, plan, go, back, replace, render } from '../core.js';
import { askJSON, hasAI, aiBtn, aiOff, aiSections, addMemory, entryLine } from '../ai.js';
import { $, esc, J, ic, f1, bar, item, group, secTitle, slider, seg, chipset, chipVals, formData, pillarSliders, sheet, closeLayer, confirmBox, toast } from '../ui.js';

/* ===== folha "Registar" (botão + da tab bar) ===== */
function openAdd() {
  const row = (lead, title, sub, v) => item({ lead, title, sub, onclick: `closeLayer();go('${v}')` });
  sheet(`<h2 style="margin:0 2px 12px">Registar</h2>
    ${group([row('sun', 'Check-in diário', '30 segundos: como chegas hoje', 'checkin'), row('flag', 'Preparar jogo', 'Plano A e B e cartão de jogo', 'pre'), row('pen', 'Rever jogo', 'Resultado, estatísticas e mental', 'post'), row('clock', 'Reflexão de treino', 'Intenção e execução', 'practice')])}
    ${group([row('target', 'Objetivo', 'Mental ou ténis', 'goalEdit'), row('trophy', 'Torneio', 'Datas, objetivo e plano', 'tournamentEdit')], 'mt')}`, 'Registar');
}

function tournamentSelect(sel = '') {
  const ts = S.state.tournaments.filter(t => (t.end || t.start || '9999') >= dayKey(Date.now() - 3 * 864e5));
  if (!ts.length) return '';
  return `<label class="f" for="tSel">Torneio</label><select id="tSel" name="tournament"><option value="">Nenhum</option>${ts.map(t => `<option value="${t.id}" ${t.id === sel || (!sel && daysUntil(t.start) <= 0) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
  <label class="f" for="tRound">Ronda</label><input type="text" id="tRound" name="round" placeholder="Ex.: 1.ª ronda, quartos">`;
}

/* ===== preparar ===== */
const pre = () => `${bar()}<h1>Preparar jogo</h1><p class="lede">Cinco minutos agora poupam-te um set de nervos.</p>
  <form onsubmit="submitPre(event)">
  <label class="f" for="pOpp" style="margin-top:0">Adversário</label><input type="text" id="pOpp" name="opp" placeholder="Nome">${tournamentSelect()}
  <label class="f">Superfície</label>${seg('surface', ['Terra', 'Rápido', 'Indoor'], S.profile.surface === 'Rápido' ? 'Rápido' : S.profile.surface === 'Indoor' ? 'Indoor' : 'Terra')}
  <label class="f" for="pStyle">Como joga o adversário?</label><textarea id="pStyle" name="oppStyle" placeholder="Ex.: defensivo, muito consistente, esquerda a uma mão fraca em bolas altas"></textarea>
  <label class="f" for="pA">Plano A</label><textarea id="pA" name="planA" placeholder="Ex.: servir aberto no deuce, entrar com a direita inside-in"></textarea>
  <label class="f" for="pB">Plano B</label><textarea id="pB" name="planB" placeholder="Ex.: mais altura e peso, subir à rede"></textarea>
  <label class="f" for="pT">O que me pode tirar do jogo?</label><textarea id="pT" name="threats" placeholder="Ex.: frustrar-me se ele devolver tudo"></textarea>
  <div class="group mt">${slider('nerves', 'Nervos agora', 5, '1 nada, 10 muito')}</div>
  <button class="btn mt" id="preBtn">${hasAI() ? `${ic('spark')}Gerar cartão de jogo` : 'Guardar plano'}</button>
  <p class="hint" style="text-align:center">${hasAI() ? 'Resumo do plano, 3 palavras-chave, reset, nervos e visualização de 60 s.' : 'Com o coach ativo nas Definições, recebes também um cartão de jogo.'}</p></form>`;
const PRE_TASK = e => `O jogador vai jogar. Pré-jogo: ${entryLine(e)}. Cria um cartão de jogo. Chaves: "plano" (2 frases concretas com base no plano A, no estilo do adversário e na pancada mais forte do jogador), "chaves" (array de exatamente 3 palavras-chave de 1-2 palavras), "primeiros_jogos" (como abordar os 3 primeiros jogos, 1 frase), "se_correr_mal" (o que mudar, 1-2 frases), "reset" (o reset após erro em 3 passos curtos numa frase), "ativacao" (dica para os nervos ajustada ao nível indicado), "visualizacao" (guião de 60 s, 2.ª pessoa, 4-5 frases).`;
async function submitPre(ev) {
  ev.preventDefault(); const d = formData(ev.target);
  const e = { id: uid(), type: 'pre', ts: Date.now(), ...d, nerves: +d.nerves }; saveEntry(e); plan();
  if (!hasAI()) { toast('Plano guardado'); return replace('entry', e.id); }
  await aiBtn('#preBtn', 'O coach está a preparar o cartão…', async () => { e.ai = await askJSON(PRE_TASK(e)); saveEntry(e); });
  replace('entry', e.id);
}

/* ===== rever jogo ===== */
function post() {
  const p = ofType('pre')[0], recentPre = p && Date.now() - p.ts < 2 * 864e5 ? p : null;
  return `${bar()}<h1>Rever jogo</h1><p class="lede">Sê honesto. Isto é só para ti.</p>
  <form onsubmit="submitPost(event)">
  <label class="f" for="oOpp" style="margin-top:0">Adversário</label><input type="text" id="oOpp" name="opp" value="${esc(recentPre?.opp || '')}">${tournamentSelect(recentPre?.tournament || '')}
  <label class="f">Resultado</label>${seg('result', [['vitória', 'Vitória'], ['derrota', 'Derrota']], 'vitória')}
  <label class="f" for="oScore">Marcador</label><input type="text" id="oScore" name="score" placeholder="Ex.: 6-4 3-6 10-7">
  <details class="more"><summary>Estatísticas (opcional)</summary><div class="inner"><div class="grid2">
    <div><label class="f" for="sFs">% 1.º serviço</label><input type="number" inputmode="numeric" id="sFs" name="fs" min="0" max="100"></div><div><label class="f" for="sDf">Duplas faltas</label><input type="number" inputmode="numeric" id="sDf" name="df" min="0"></div>
    <div><label class="f" for="sBw">Break points ganhos</label><input type="number" inputmode="numeric" id="sBw" name="bpw" min="0"></div><div><label class="f" for="sBt">Break points jogados</label><input type="number" inputmode="numeric" id="sBt" name="bpt" min="0"></div></div></div></details>
  ${recentPre ? `<label class="f">Cumpriste o plano A? (1 a 10)</label>${seg('planDone', ['1', '3', '5', '7', '10'], '5')}<input type="hidden" name="preId" value="${recentPre.id}">` : ''}
  ${secTitle('O teu mental neste jogo')}<p class="hint" style="margin:-4px 2px 8px">1 muito mal, 10 excelente</p>${pillarSliders()}
  <label class="f" for="oGood">O que correu bem?</label><textarea id="oGood" name="good"></textarea>
  <label class="f" for="oBad">O que correu mal?</label><textarea id="oBad" name="bad"></textarea>
  <label class="f" for="oKey">Momento em que o jogo mudou</label><textarea id="oKey" name="key" placeholder="Ex.: 4-4 no 2.º set, perdi o serviço com duas duplas"></textarea>
  <label class="f">Emoção dominante</label>${chipset('emotion', ['Calma', 'Confiança', 'Nervos', 'Frustração', 'Raiva', 'Medo de perder', 'Cansaço', 'Garra'], [])}
  <button class="btn mt" id="postBtn">${hasAI() ? 'Guardar e pedir análise' : 'Guardar jogo'}</button></form>`;
}
const POST_TASK = (e, pre) => `O jogador registou este jogo: ${entryLine(e)}${pre ? `\nPlano antes do jogo: ${entryLine(pre)}. Cumprimento do plano A: ${e.planDone}/10.` : ''}
Compara com o histórico e a memória. Chaves: "resumo" (2-3 frases sobre o que aconteceu mentalmente), "padrao" (um padrão que se repete no histórico, ou "Ainda poucos dados" se não houver), "ponto_forte" (1 frase), "a_trabalhar" (a competência mental mais importante a melhorar e porquê, 1-2 frases), "exercicio" (exercício concreto para o próximo treino, com duração), "foco_proximo" (foco para a próxima semana, máx. 8 palavras), "memoria" (array de 0-2 notas novas e duradouras sobre este jogador para a tua memória, só se forem mesmo novas).`;
async function submitPost(ev) {
  ev.preventDefault(); const d = formData(ev.target);
  const e = { id: uid(), type: 'post', ts: Date.now(), opp: d.opp, result: d.result, score: d.score, fs: d.fs, df: d.df, bpw: d.bpw, bpt: d.bpt, good: d.good, bad: d.bad, key: d.key, emotion: chipVals('emotion').join(', '), tournament: d.tournament || '', round: d.round || '', planDone: d.planDone || '', preId: d.preId || '', skills: {} };
  PK.forEach(k => e.skills[k] = +d[k]); saveEntry(e);
  if (!hasAI()) { toast('Jogo guardado'); return replace('entry', e.id); }
  await aiBtn('#postBtn', 'O coach está a analisar…', async () => {
    const p = e.preId ? S.entries.find(x => x.id === e.preId) : null;
    e.ai = await askJSON(POST_TASK(e, p)); addMemory(e.ai.memoria); saveEntry(e);
  });
  replace('entry', e.id);
}

/* ===== reflexão de treino ===== */
function practice() {
  const ci = ofType('checkin').find(e => dayKey(e.ts) === TODAY());
  return `${bar()}<h1>Reflexão de treino</h1>
  ${ci?.intent ? `<div class="panel ink mt"><p class="muted" style="margin:0 0 4px">A tua intenção de hoje</p><h3>${esc(ci.intent)}</h3></div>` : '<p class="lede">Intenção e execução: o que fizeste e o que levas.</p>'}
  <form onsubmit="submitPractice(event)">
  <label class="f" for="prWhat">O que treinaste?</label><input type="text" id="prWhat" name="what" placeholder="Ex.: cesto de direitas e pontos a partir do serviço">
  <div class="group mt">${slider('quality', 'Qualidade do treino', 6)}${slider('intentDone', 'Cumpri a minha intenção', 6)}</div>
  <details class="more" id="prSkills"><summary>Avaliar competências mentais (recomendado)</summary><div class="inner flush">${pillarSliders()}</div></details>
  <label class="f" for="prLearned">O que aprendi e levo para o próximo treino</label><textarea id="prLearned" name="learned"></textarea>
  <button class="btn mt" id="prBtn">Guardar reflexão</button></form>`;
}
async function submitPractice(ev) {
  ev.preventDefault(); const d = formData(ev.target), opened = $('#prSkills')?.open;
  const e = { id: uid(), type: 'practice', ts: Date.now(), what: d.what, quality: +d.quality, intentDone: +d.intentDone, learned: d.learned };
  if (opened) { e.skills = {}; PK.forEach(k => e.skills[k] = +d[k]); }
  saveEntry(e);
  if (!hasAI()) { toast('Reflexão guardada'); return replace('entry', e.id); }
  await aiBtn('#prBtn', 'O coach está a ler…', async () => {
    e.ai = await askJSON(`Reflexão de treino: ${entryLine(e)}. Dá feedback curto. Chaves: "resumo" (1-2 frases), "a_trabalhar" (1 frase), "exercicio" (para o próximo treino, 1 frase), "foco_proximo" (máx. 8 palavras).`, 'quick');
    saveEntry(e);
  });
  replace('entry', e.id);
}

/* ===== ver registo ===== */
const resultPill = r => `<span class="pill ${r === 'vitória' ? 'win' : 'loss'}">${r === 'vitória' ? 'Vitória' : 'Derrota'}</span>`;
function skillsBars(e) {
  if (!e.skills) return '';
  const mi = mentalIndex(e);
  return `${secTitle(`Mental${mi ? `, índice ${f1(mi)}` : ''}`)}<div class="group bars">${PK.filter(k => e.skills[k]).map(k => `<div class="b"><div class="lab"><span>${PN[k]}</span><span class="val">${e.skills[k]}</span></div><div class="track"><i style="width:${e.skills[k] * 10}%"></i></div></div>`).join('')}</div>`;
}
function entry() {
  const e = S.entries.find(x => x.id === S.param); if (!e) return null;
  const tn = e.tournament ? S.state.tournaments.find(t => t.id === e.tournament) : null;
  const retry = !e.ai && e.type !== 'checkin' ? (hasAI() ? `<div class="panel mt"><p class="muted" style="margin-top:0">Ainda sem análise do coach.</p><button class="btn small" id="retry" onclick="retryAI('${e.id}')">${ic('spark')}Pedir análise</button></div>` : `<div class="mt">${aiOff('a análise')}</div>`) : '';
  const meta = [tn?.name, e.round].filter(Boolean).map(esc).join(', ');
  let body = '';
  if (e.type === 'checkin') body = `<h1>Check-in</h1>${group([...CHECK.map(([k, l]) => item({ title: l, val: e[k] })), ...(e.sleep ? [item({ title: 'Sono', val: esc(e.sleep) + ' h' })] : []), ...(e.plan ? [item({ title: 'Dia de', val: esc(e.plan) })] : [])], 'mt')}${e.intent ? `<div class="panel mt"><p class="faint" style="margin:0 0 4px">Intenção</p><h3>${esc(e.intent)}</h3></div>` : ''}`;
  if (e.type === 'pre') body = `<h1>Jogo vs ${esc(e.opp || '?')}</h1><p class="muted">${[esc(e.surface || ''), `nervos ${e.nerves} em 10`, meta].filter(Boolean).join(', ')}</p>
    ${e.ai ? `<div class="panel ink"><p class="muted" style="margin:0 0 6px">Cartão de jogo</p><h2 style="margin-bottom:12px">${esc(e.ai.plano || '')}</h2><div class="cues">${(e.ai.chaves || []).map(c => `<span class="cue">${esc(c)}</span>`).join('')}</div></div>
      <div class="panel mt">${aiSections(e.ai, [['primeiros_jogos', 'Primeiros 3 jogos'], ['reset', 'Reset após erro'], ['se_correr_mal', 'Se correr mal'], ['ativacao', 'Nervos']])}</div>
      ${e.ai.visualizacao ? `${secTitle('Visualização de 60 segundos')}<div class="panel"><p class="ai-text" style="margin-top:0">${esc(e.ai.visualizacao)}</p><button class="btn secondary small" onclick="playText(${J(e.ai.visualizacao)})">${ic('play')}Ouvir</button></div>` : ''}` : retry}
    <details class="more"><summary>O teu plano</summary><div class="inner">${[['oppStyle', 'Adversário'], ['planA', 'Plano A'], ['planB', 'Plano B'], ['threats', 'Riscos']].map(([k, l]) => e[k] ? `<p><b>${l}.</b> ${esc(e[k])}</p>` : '').join('') || '<p class="faint">Sem notas.</p>'}</div></details>
    <button class="btn secondary mt" onclick="go('post')">Rever este jogo depois de jogar</button>`;
  if (e.type === 'post') body = `<h1>vs ${esc(e.opp || '?')}</h1><p class="row" style="flex-wrap:wrap">${resultPill(e.result)} <b>${esc(e.score || '')}</b> <span class="muted">${meta}</span></p>
    ${e.ai ? `<div class="panel ink"><p class="muted" style="margin:0 0 6px">Análise do coach</p><p class="ai-text" style="margin:0 0 4px">${esc(e.ai.resumo || '')}</p>${aiSections(e.ai, [['padrao', 'Padrão'], ['ponto_forte', 'Ponto forte'], ['a_trabalhar', 'A trabalhar'], ['exercicio', 'Exercício'], ['foco_proximo', 'Foco da próxima semana']])}</div>` : retry}
    ${(e.fs || e.df || e.bpt) ? `<div class="nums mt"><div><b class="display">${e.fs ? esc(e.fs) + '%' : '–'}</b><span>1.º serviço</span></div><div><b class="display">${esc(e.df || '–')}</b><span>duplas faltas</span></div><div><b class="display">${esc(e.bpw || '–')}/${esc(e.bpt || '–')}</b><span>break points</span></div></div>` : ''}
    ${skillsBars(e)}
    ${secTitle('Notas')}<div class="panel">${[['good', 'Correu bem'], ['bad', 'Correu mal'], ['key', 'Momento-chave'], ['emotion', 'Emoção'], ['planDone', 'Plano A cumprido']].map(([k, l]) => e[k] ? `<p><b>${l}.</b> ${esc(e[k])}${k === 'planDone' ? ' em 10' : ''}</p>` : '').join('') || '<p class="faint" style="margin:0">Sem notas.</p>'}</div>`;
  if (e.type === 'practice') body = `<h1>Treino</h1>${e.what ? `<p class="lede">${esc(e.what)}</p>` : ''}
    <div class="nums" style="grid-template-columns:1fr 1fr"><div><b class="display">${esc(e.quality)}</b><span>qualidade</span></div><div><b class="display">${esc(e.intentDone)}</b><span>intenção cumprida</span></div></div>
    ${e.ai ? `<div class="panel ink mt"><p class="muted" style="margin:0 0 6px">Coach</p><p class="ai-text" style="margin:0 0 4px">${esc(e.ai.resumo || '')}</p>${aiSections(e.ai, [['a_trabalhar', 'A trabalhar'], ['exercicio', 'Próximo treino'], ['foco_proximo', 'Foco']])}</div>` : retry}
    ${skillsBars(e)}${e.learned ? `${secTitle('Aprendi')}<div class="panel"><p style="margin:0">${esc(e.learned)}</p></div>` : ''}`;
  return `${bar()}<p class="faint" style="margin:0">${fmtDate(e.ts)}</p>${body}
  <button class="btn danger mt" onclick="delEntry('${e.id}')">${ic('trash')}Apagar registo</button>`;
}
function delEntry(id) { confirmBox('Apagar este registo?', () => { deleteEntry(id); back(); }); }
async function retryAI(id) {
  const e = S.entries.find(x => x.id === id);
  await aiBtn('#retry', 'A pensar…', async () => {
    if (e.type === 'pre') e.ai = await askJSON(PRE_TASK(e));
    else if (e.type === 'post') { e.ai = await askJSON(POST_TASK(e, e.preId ? S.entries.find(x => x.id === e.preId) : null)); addMemory(e.ai.memoria); }
    else e.ai = await askJSON(`Reflexão de treino: ${entryLine(e)}. Chaves: "resumo", "a_trabalhar", "exercicio", "foco_proximo" (máx. 8 palavras).`, 'quick');
    saveEntry(e); render();
  });
}

export const views = { pre, post, practice, entry };
export const handlers = { openAdd, submitPre, submitPost, submitPractice, retryAI, delEntry };
