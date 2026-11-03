/* Hoje: court com placar do loop diário, check-in e desafio no court */
import { S, PK, PN, CHECK, plan, loopStatus, daysSinceBackup, getMeta, setMeta, pillarScores, streak, overallScore, winLoss, upcomingTournament, currentFocus, daysUntil, TODAY, trainingInfo, saveState, saveEntry, markDone, isMatchDay, uid, longDate, go, back, render } from '../core.js';
import { LESSONS } from '../content.js';
import { askJSON, hasAI, aiErr } from '../ai.js';
import { adjustBlock } from './adjust.js';
import { studyRow } from './science.js';
import { $, esc, ic, f1, item, group, secTitle, slider, seg, formData, bar, toast, spin } from '../ui.js';

const STEPS = [['checkin', 'Check-in'], ['lesson', 'Lição'], ['training', 'Treino'], ['challenge', 'Desafio'], ['reflection', 'Reflexão']];
const COURT = `<svg class="lines" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2"><rect x="16" y="14" width="328" height="192"/><path d="M16 38H344M16 182H344M100 38V182M260 38V182M100 110H260M16 110h8M336 110h8"/><path d="M180 2V218" stroke-width="3"/></g></svg>`;

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
function installCard() {
  let hidden = false; try { hidden = localStorage.getItem('pap_install_hide') === '1'; } catch {}
  if (isStandalone() || hidden) return '';
  return `<div class="install mb"><div class="row between"><h3>Instalar no iPhone</h3><button class="icon-btn" onclick="hideInstall()" aria-label="Esconder">${ic('x')}</button></div>
    <ol class="install-steps"><li>No Safari, toca em Partilhar <span class="kbd">${ic('share')}</span></li><li>Escolhe Adicionar ao ecrã principal <span class="kbd">${ic('addSquare')}</span></li><li>Abre o Ponto a Ponto a partir do ícone</li></ol>
    <p class="muted" style="margin:10px 0 0;font-size:14px">A app instalada guarda os dados à parte do Safari. Se já começaste aqui, exporta uma cópia nas Definições e importa-a na app.</p></div>`;
}
function hideInstall() { try { localStorage.setItem('pap_install_hide', '1'); } catch {} render(); }

/* ===== plano do coach para hoje (gerado sozinho, ajustável) ===== */
const BRIEF_TASK = d => `Prepara o plano do coach para hoje. Toma a iniciativa: com base nos dados, propõe o foco do dia e uma ideia concreta (mental ou tática) para o treino ou jogo de hoje. O loop de hoje já tem: competência ${PN[d.plan.pillar]}, lição "${LESSONS.find(l => l.id === d.plan.lesson)?.t}", treino "${trainingInfo(d.plan.training).n}".${d.plan.matchDay ? ' Hoje é dia de jogo.' : ''}
Chaves: "titulo" (até 8 palavras), "texto" (2-3 frases: o que propões hoje e porquê, ligado aos dados), "acao" (uma ação concreta para hoje, 1 frase), "pilar" (a competência a treinar hoje, uma destas chaves: ${PK.join(', ')}), "dia_de_jogo" (true ou false), "estudo" (id de um estudo da biblioteca relevante, ou ""), "sugestoes" (array de 3 respostas curtas que o jogador pode tocar para ajustar, na voz dele, ex.: "Hoje tenho jogo", "Estou cansado", "Só tenho 10 minutos").`;
let briefLoading = false, briefFailed = false;
async function loadBrief() {
  if (briefLoading || briefFailed || !hasAI() || S.state.briefs[TODAY()]) return;
  briefLoading = true;
  try {
    const d = plan(), r = await askJSON(BRIEF_TASK(d), 'quick');
    S.state.briefs[TODAY()] = { ...r, ts: Date.now(), thread: [] }; saveState();
  } catch (e) { console.warn(e); briefFailed = aiErr(e); }
  briefLoading = false;
  if (S.view === 'home') render();
}
function retryBrief() { briefFailed = false; render(); }
function briefCard() {
  if (!hasAI()) return group([item({ lead: 'key', title: 'Ativar o coach', sub: 'Com a tua chave da API, o coach prepara o teu dia, os jogos e os torneios por ti.', onclick: "go('settings')" })]);
  const b = S.state.briefs[TODAY()];
  if (!b) return briefFailed
    ? group([item({ lead: 'spark', title: 'O coach não conseguiu preparar o dia', sub: esc(briefFailed), onclick: 'retryBrief()' })])
    : `<div class="panel ink brief" aria-busy="true"><p class="muted" style="margin:0">${spin('O coach está a preparar o teu dia…')}</p></div>`;
  return `<div class="panel ink brief"><p class="muted" style="margin:0 0 4px">O coach propõe</p><h2>${esc(b.titulo || '')}</h2>
    <p style="margin:8px 0 0">${esc(b.texto || '')}</p>
    ${b.acao ? `<p class="brief-act"><b>Hoje:</b> ${esc(b.acao)}</p>` : ''}
    ${adjustBlock('brief', TODAY(), { title: '', compact: true, onInk: true, defaults: ['Hoje tenho jogo', 'Estou cansado', 'Só tenho 10 minutos', 'Outra ideia'] })}</div>
    ${b.estudo && studyRow(b.estudo) ? `<div class="group mt">${studyRow(b.estudo)}</div>` : ''}`;
}
function backupCard() {
  const n = S.entries.length, since = daysSinceBackup(), snooze = getMeta().backupSnooze || 0;
  if (n < 3 || Date.now() < snooze || (since != null && since < 14)) return '';
  return `${group([item({ lead: 'download', title: 'Faz uma cópia de segurança', sub: since == null ? 'Ainda não guardaste nenhuma cópia. Guarda no iCloud ou em Ficheiros, leva 5 segundos.' : `A última cópia foi há ${since} dias.`, onclick: 'backupNow()' })], 'mt')}
    <button class="btn text" onclick="snoozeBackup()">Lembrar daqui a uma semana</button>`;
}
function snoozeBackup() { setMeta({ backupSnooze: Date.now() + 7 * 864e5 }); render(); }

function home() {
  const h = new Date().getHours(), hello = h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
  const d = plan(), ls = loopStatus(), lesson = LESSONS.find(l => l.id === d.plan.lesson), tr = trainingInfo(d.plan.training);
  const md = d.plan.matchDay || isMatchDay();
  // Só anima a célula que acabou de ficar concluída desde a última vez que o ecrã foi desenhado.
  const seen = S.seenLoop?.day === TODAY() ? S.seenLoop.st : ls;
  S.seenLoop = { day: TODAY(), st: { ...ls } };
  const doneN = STEPS.filter(([k]) => ls[k]).length, nextI = STEPS.findIndex(([k]) => !ls[k]);
  const sc = pillarScores(), t = upcomingTournament(), f = currentFocus();
  const activeGoal = S.state.goals.find(g => !g.done);
  const [w, l] = winLoss(), ov = overallScore(), st = streak();
  const why = md ? 'Programa ajustado para competires hoje.'
    : S.profile.focusPillar ? 'Escolheste treinar esta competência.'
    : d.plan.forced ? 'O coach ajustou o foco de hoje contigo.'
    : `É a tua competência mais baixa agora${sc[d.plan.pillar] != null ? ` (${f1(sc[d.plan.pillar])} em 10)` : ''}.`;
  const rows = [
    ['checkin', 'Check-in', 'Como chegas hoje, em 30 segundos', "go('checkin')"],
    ['lesson', esc(lesson.t), `Lição de ${lesson.min} min`, `go('lesson','${lesson.id}')`],
    ['training', esc(tr.n), `Treino mental de ${tr.min} min`, `startTraining('${d.plan.training}')`],
    ['challenge', 'Desafio no court', esc(lesson.drill), "go('challenge')"],
    ['reflection', 'Reflexão', md ? 'Rever o jogo de hoje' : 'Depois de treinar ou jogar', `go('${md ? 'post' : 'practice'}')`],
  ];
  return `<p class="faint" style="margin:0">${esc(longDate().replace(/^./, c => c.toUpperCase()))}</p>
  <h1 style="margin:2px 0 14px">${hello}${S.profile.name ? ', ' + esc(S.profile.name) : ''}.</h1>
  ${installCard()}
  <section class="court" aria-label="Plano de hoje">${COURT}
    <div class="kicker">${md ? 'Dia de jogo' : 'Treino de hoje'}</div>
    <h1>${esc(PN[d.plan.pillar])}</h1><p>${why}</p>
    <div class="score" role="list" aria-label="Loop de hoje: ${doneN} de 5 concluídos">${STEPS.map(([k, lab], i) => `<div role="listitem" aria-label="${lab}: ${ls[k] ? 'feito' : 'por fazer'}" class="cell ${ls[k] ? 'done' : ''} ${ls[k] && !seen[k] ? 'pop' : ''}">${ls[k] ? ic('check') : i + 1}</div>`).join('')}</div>
    <div class="score-label" aria-hidden="true">${STEPS.map(([, lab]) => `<span>${lab}</span>`).join('')}</div>
  </section>
  ${briefCard()}
  ${backupCard()}
  ${secTitle(doneN === 5 ? 'Loop completo' : 'O loop de hoje')}
  ${doneN === 5 ? `<div class="panel ink mb"><h3>Loop completo hoje.</h3><p class="muted" style="margin-bottom:0">${st === 1 ? 'Primeiro dia da série.' : `${st} dias seguidos.`} Amanhã há mais.</p></div>` : ''}
  ${group(rows.map(([k, title, sub, fn], i) => item({ lead: ls[k] ? ic('check') : String(i + 1), title, sub, onclick: fn, cls: ls[k] ? 'done' : i === nextI ? 'next' : '', clip: k === 'challenge' })))}
  <div class="nums mt"><div><b class="display">${st}</b><span>${st === 1 ? 'dia seguido' : 'dias seguidos'}</span></div><div><b class="display">${f1(ov)}</b><span>índice mental</span></div><div><b class="display">${w}–${l}</b><span>vitórias e derrotas</span></div></div>
  ${t ? `${secTitle('Próximo torneio')}${group([item({ lead: 'trophy', title: esc(t.name), sub: esc([t.surface, t.place].filter(Boolean).join(', ')), val: daysUntil(t.start) <= 0 ? 'A decorrer' : `${daysUntil(t.start)} ${daysUntil(t.start) === 1 ? 'dia' : 'dias'}`, onclick: `go('tournament','${t.id}')` })])}` : ''}
  ${f ? `<div class="panel mt"><p class="faint" style="margin:0">Foco da semana. ${esc(f.src)}</p><h3 style="margin-top:4px">${esc(f.text)}</h3></div>` : ''}
  ${(S.profile.cues || []).length ? `${secTitle('Palavras-chave')}<div class="cues">${S.profile.cues.map(c => `<span class="cue">${esc(c)}</span>`).join('')}</div>` : ''}
  ${activeGoal ? `${secTitle('Objetivo')}${group([item({ lead: 'target', title: esc(activeGoal.title), sub: `<span class="progress" role="progressbar" aria-valuenow="${activeGoal.progress || 0}" aria-valuemin="0" aria-valuemax="100"><i style="width:${activeGoal.progress || 0}%"></i></span>`, val: `${activeGoal.progress || 0}%`, onclick: `go('goal','${activeGoal.id}')` })])}` : ''}
  ${secTitle('Atalhos')}
  ${group([item({ lead: 'flag', title: 'Tenho jogo', sub: 'O coach prepara o plano por ti', onclick: "go('pre')" }), item({ lead: 'wind', title: 'Acalmar já', sub: 'Suspiro fisiológico, 1 minuto', onclick: "startTraining('suspiro')" })])}`;
}

const checkin = () => `${bar()}<h1>Check-in</h1><p class="lede">Como chegas hoje?</p>
  <form onsubmit="submitCheckin(event)">
  <div class="group">${CHECK.map(([k, l]) => slider(k, l, 6)).join('')}</div>
  <label class="f">Horas de sono</label>${seg('sleep', ['<6', '6', '7', '8', '9+'], '7')}
  <label class="f">Hoje é dia de</label>${seg('plan', [['treino', 'Treino'], ['jogo', 'Jogo'], ['descanso', 'Descanso']], isMatchDay() ? 'jogo' : 'treino')}
  <label class="f" for="ciIntent">Intenção para hoje, numa frase</label><input type="text" id="ciIntent" name="intent" placeholder="Ex.: atacar a 2.ª bola com a direita, sem pressa">
  <button class="btn mt">Guardar check-in</button></form>`;
function submitCheckin(ev) {
  ev.preventDefault(); const d = formData(ev.target);
  const e = { id: uid(), type: 'checkin', ts: Date.now(), plan: d.plan, intent: (d.intent || '').trim(), sleep: d.sleep };
  CHECK.forEach(([k]) => e[k] = +d[k]);
  saveEntry(e); plan(); toast('Check-in guardado'); go('home');
}

function challenge() {
  const d = plan(), l = LESSONS.find(x => x.id === d.plan.lesson);
  return `${bar()}<p class="faint" style="margin:0">Desafio no court. ${esc(PN[l.p])}</p><h1>Para o treino de hoje</h1>
  <div class="panel mt"><p style="margin:0;font-size:18px;line-height:1.45">${esc(l.drill)}</p></div>
  <div class="panel ink mt"><p class="muted" style="margin:0 0 4px">Lembra-te</p><p class="display takeaway" style="margin:0">${esc(l.key)}</p></div>
  <label class="f" for="chNote">Como correu? (opcional)</label><textarea id="chNote">${esc(d.challengeNote || '')}</textarea>
  <button class="btn mt" onclick="saveChallenge()">${d.done.challenge ? 'Guardar nota' : 'Fiz o desafio'}</button>`;
}
function saveChallenge() {
  const d = plan(); d.challengeNote = $('#chNote').value; const was = !!d.done.challenge;
  markDone('challenge'); saveState(); toast(was ? 'Nota guardada' : 'Desafio feito'); back();
}

export const views = { home, home_after: loadBrief, checkin, challenge };
export const handlers = { hideInstall, retryBrief, snoozeBackup, submitCheckin, saveChallenge };
