/* Hoje: court com placar do loop diário, check-in e desafio no court */
import { S, PN, CHECK, plan, loopStatus, pillarScores, streak, overallScore, winLoss, upcomingTournament, currentFocus, daysUntil, TODAY, trainingInfo, saveState, saveEntry, markDone, isMatchDay, uid, longDate, go, back, render } from '../core.js';
import { LESSONS } from '../content.js';
import { askJSON, hasAI, aiBtn } from '../ai.js';
import { $, esc, ic, f1, item, group, secTitle, slider, seg, formData, bar, toast } from '../ui.js';

const STEPS = [['checkin', 'Check-in'], ['lesson', 'Lição'], ['training', 'Treino'], ['challenge', 'Desafio'], ['reflection', 'Reflexão']];
const COURT = `<svg class="lines" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2"><rect x="16" y="14" width="328" height="192"/><path d="M16 38H344M16 182H344M100 38V182M260 38V182M100 110H260M16 110h8M336 110h8"/><path d="M180 2V218" stroke-width="3"/></g></svg>`;

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
function installCard() {
  let hidden = false; try { hidden = localStorage.getItem('pap_install_hide') === '1'; } catch {}
  if (isStandalone() || hidden) return '';
  return `<div class="install mb"><div class="row between"><h3>Instalar no iPhone</h3><button class="icon-btn" onclick="hideInstall()" aria-label="Esconder">${ic('x')}</button></div>
    <ol class="install-steps"><li>No Safari, toca em Partilhar <span class="kbd">${ic('share')}</span></li><li>Escolhe Adicionar ao ecrã principal <span class="kbd">${ic('addSquare')}</span></li><li>Abre o Ponto a Ponto a partir do ícone</li></ol></div>`;
}
function hideInstall() { try { localStorage.setItem('pap_install_hide', '1'); } catch {} render(); }

function home() {
  const h = new Date().getHours(), hello = h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
  const d = plan(), ls = loopStatus(), lesson = LESSONS.find(l => l.id === d.plan.lesson), tr = trainingInfo(d.plan.training);
  // Só anima a célula que acabou de ficar concluída desde a última vez que o ecrã foi desenhado.
  const seen = S.seenLoop?.day === TODAY() ? S.seenLoop.st : ls;
  S.seenLoop = { day: TODAY(), st: { ...ls } };
  const doneN = STEPS.filter(([k]) => ls[k]).length, nextI = STEPS.findIndex(([k]) => !ls[k]);
  const sc = pillarScores(), t = upcomingTournament(), f = currentFocus(), ins = S.state.insights[TODAY()];
  const activeGoal = S.state.goals.find(g => !g.done);
  const [w, l] = winLoss(), ov = overallScore(), st = streak();
  const why = d.plan.matchDay ? 'Programa ajustado para competires hoje.'
    : S.profile.focusPillar ? 'Escolheste treinar esta competência.'
    : `É a tua competência mais baixa agora${sc[d.plan.pillar] != null ? ` (${f1(sc[d.plan.pillar])} em 10)` : ''}.`;
  const rows = [
    ['checkin', 'Check-in', 'Como chegas hoje, em 30 segundos', "go('checkin')"],
    ['lesson', esc(lesson.t), `Lição de ${lesson.min} min`, `go('lesson','${lesson.id}')`],
    ['training', esc(tr.n), `Treino mental de ${tr.min} min`, `startTraining('${d.plan.training}')`],
    ['challenge', 'Desafio no court', esc(lesson.drill), "go('challenge')"],
    ['reflection', 'Reflexão', d.plan.matchDay ? 'Rever o jogo de hoje' : 'Depois de treinar ou jogar', `go('${d.plan.matchDay ? 'post' : 'practice'}')`],
  ];
  return `<p class="faint" style="margin:0">${esc(longDate().replace(/^./, c => c.toUpperCase()))}</p>
  <h1 style="margin:2px 0 14px">${hello}${S.profile.name ? ', ' + esc(S.profile.name) : ''}.</h1>
  ${installCard()}
  <section class="court" aria-label="Plano de hoje">${COURT}
    <div class="kicker">${d.plan.matchDay ? 'Dia de jogo' : 'Treino de hoje'}</div>
    <h1>${esc(PN[d.plan.pillar])}</h1><p>${why}</p>
    <div class="score" role="list" aria-label="Loop de hoje: ${doneN} de 5 concluídos">${STEPS.map(([k, lab], i) => `<div role="listitem" aria-label="${lab}: ${ls[k] ? 'feito' : 'por fazer'}" class="cell ${ls[k] ? 'done' : ''} ${ls[k] && !seen[k] ? 'pop' : ''}">${ls[k] ? ic('check') : i + 1}</div>`).join('')}</div>
    <div class="score-label" aria-hidden="true">${STEPS.map(([, lab]) => `<span>${lab}</span>`).join('')}</div>
  </section>
  ${secTitle(doneN === 5 ? 'Loop completo' : 'O loop de hoje')}
  ${doneN === 5 ? `<div class="panel ink mb"><h3>Loop completo hoje.</h3><p class="muted" style="margin-bottom:0">${st === 1 ? 'Primeiro dia da série.' : `${st} dias seguidos.`} Amanhã há mais.</p></div>` : ''}
  ${group(rows.map(([k, title, sub, fn], i) => item({ lead: ls[k] ? ic('check') : String(i + 1), title, sub, onclick: fn, cls: ls[k] ? 'done' : i === nextI ? 'next' : '', clip: k === 'challenge' })))}
  <div class="nums mt"><div><b class="display">${st}</b><span>${st === 1 ? 'dia seguido' : 'dias seguidos'}</span></div><div><b class="display">${f1(ov)}</b><span>índice mental</span></div><div><b class="display">${w}–${l}</b><span>vitórias e derrotas</span></div></div>
  ${t ? `${secTitle('Próximo torneio')}${group([item({ lead: 'trophy', title: esc(t.name), sub: esc([t.surface, t.place].filter(Boolean).join(', ')), val: daysUntil(t.start) <= 0 ? 'A decorrer' : `${daysUntil(t.start)} ${daysUntil(t.start) === 1 ? 'dia' : 'dias'}`, onclick: `go('tournament','${t.id}')` })])}` : ''}
  ${secTitle('Coach')}
  ${ins ? `<div class="panel ink"><p class="muted" style="margin:0 0 4px">Insight de hoje</p><h3>${esc(ins.titulo || '')}</h3><p style="margin-bottom:0">${esc(ins.texto || '')}</p></div>`
    : group([hasAI() ? item({ lead: 'spark', title: 'Insight do dia', sub: 'Uma ideia para hoje, a partir dos teus dados', onclick: 'getInsight(this)' })
      : item({ lead: 'key', title: 'Ativar o coach', sub: 'Cola a tua chave da API nas Definições', onclick: "go('settings')" })])}
  ${f ? `<div class="panel mt"><p class="faint" style="margin:0">Foco da semana. ${esc(f.src)}</p><h3 style="margin-top:4px">${esc(f.text)}</h3></div>` : ''}
  ${(S.profile.cues || []).length ? `${secTitle('Palavras-chave')}<div class="cues">${S.profile.cues.map(c => `<span class="cue">${esc(c)}</span>`).join('')}</div>` : ''}
  ${activeGoal ? `${secTitle('Objetivo')}${group([item({ lead: 'target', title: esc(activeGoal.title), sub: `<span class="progress" role="progressbar" aria-valuenow="${activeGoal.progress || 0}" aria-valuemin="0" aria-valuemax="100"><i style="width:${activeGoal.progress || 0}%"></i></span>`, val: `${activeGoal.progress || 0}%`, onclick: `go('goal','${activeGoal.id}')` })])}` : ''}
  ${secTitle('Atalhos')}
  ${group([item({ lead: 'flag', title: 'Preparar jogo', sub: 'Plano A e B e cartão de jogo', onclick: "go('pre')" }), item({ lead: 'wind', title: 'Acalmar já', sub: 'Suspiro fisiológico, 1 minuto', onclick: "startTraining('suspiro')" })])}`;
}
async function getInsight(el) {
  await aiBtn(el, 'A pensar…', async () => {
    const r = await askJSON(`Dá ao jogador um insight curto para hoje, ligado aos dados dele (padrões, competência do dia, próximo jogo ou torneio, objetivos). Chaves: "titulo" (até 8 palavras), "texto" (2-3 frases, termina com uma ação concreta para hoje).`, 'quick');
    S.state.insights[TODAY()] = r; saveState(); render();
  });
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

export const views = { home, checkin, challenge };
export const handlers = { hideInstall, getInsight, submitCheckin, saveChallenge };
