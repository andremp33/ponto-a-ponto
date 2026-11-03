/* Player das sessões guiadas: ecrã inteiro, voz pt-PT, círculo de respiração */
import { S, plan, markDone, saveState, saveProfile, render } from '../core.js';
import { SESSIONS } from '../content.js';
import { $, esc, ic, closeLayer } from '../ui.js';

let PL = null, wake = null;

function pickVoice() {
  try { const v = speechSynthesis.getVoices(); return v.find(x => /pt[-_]PT/i.test(x.lang)) || v.find(x => /^pt/i.test(x.lang)) || null; } catch { return null; }
}
function speak(t) {
  if (!S.profile.voice || !('speechSynthesis' in window) || !t) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'pt-PT';
    const v = pickVoice(); if (v) u.voice = v;
    u.rate = 0.92; speechSynthesis.speak(u);
  } catch {}
}
const hush = () => { try { speechSynthesis.cancel(); } catch {} };
const voiceBtn = () => `${ic(S.profile.voice ? 'vol' : 'volOff')}${S.profile.voice ? 'Voz ligada' : 'Sem voz'}`;
async function keepAwake(on) {
  try {
    if (on && !wake && navigator.wakeLock) wake = await navigator.wakeLock.request('screen');
    if (!on && wake) { await wake.release(); wake = null; }
  } catch { wake = null; }
}

export function openPlayer(id, obj) {
  const s = obj || SESSIONS[id] || S.state.customSessions.find(x => x.id === id); if (!s) return;
  const breath = s.kind === 'breath';
  let steps;
  if (breath) {
    steps = [[6, s.intro]];
    for (let c = 0; c < s.cycles; c++) s.pattern.forEach(p => steps.push([p[1], p[0], p[2]]));
    steps.push([5, 'Muito bem. Repara como te sentes agora.']);
  } else steps = s.steps.map(x => [x[0], x[1]]);
  const total = steps.reduce((a, x) => a + x[0], 0);
  $('#layer').innerHTML = `<div class="player" role="dialog" aria-modal="true" aria-label="${esc(s.n)}"><div class="in">
    <div class="row between"><button class="back" onclick="stopPlayer()">${ic('x')}Fechar</button><button class="btn ghost small" id="vbtn" aria-pressed="${!!S.profile.voice}" onclick="toggleVoice()">${voiceBtn()}</button></div>
    <div class="ttl">${esc(s.n)}</div><div class="pbar" role="progressbar" aria-label="Progresso da sessão"><i id="pb"></i></div>
    <div class="stage">${breath ? `<div class="breath" id="circ">Pronto</div>` : ''}<div class="txt" id="ptxt" aria-live="polite">${breath ? '' : 'Toca em começar quando estiveres pronto. Usa auriculares.'}</div><div class="faint" id="pcount"></div></div>
    <div class="grid2"><button class="btn ghost" id="pskip" onclick="plSkip()">${ic('skip')}Saltar</button><button class="btn" id="pplay" onclick="plToggle()">${ic('play')}Começar</button></div>
  </div></div>`;
  PL = { id, steps, i: -1, total, elapsed: 0, paused: true, t: null, breath, tmp: !!obj, name: s.n, cycles: s.cycles, per: breath ? s.pattern.length : 0 };
  $('#pplay').focus();
}
function plRun() {
  if (!PL || PL.paused) return;
  PL.i++;
  if (PL.i >= PL.steps.length) return plFinish();
  const [sec, txt, ph] = PL.steps[PL.i];
  if (PL.breath) {
    const c = $('#circ');
    if (c) {
      c.textContent = PL.i === 0 || PL.i === PL.steps.length - 1 ? '' : txt;
      c.style.transition = `transform ${sec}s ease-in-out`;
      if (ph === 'in') c.style.transform = 'scale(1)'; else if (ph === 'out') c.style.transform = 'scale(.55)';
    }
    const edge = PL.i === 0 || PL.i === PL.steps.length - 1;
    $('#ptxt').textContent = edge ? txt : '';
    speak(txt);
    $('#pcount').textContent = edge ? '' : `Ciclo ${Math.floor((PL.i - 1) / PL.per) + 1} de ${PL.cycles}`;
  } else {
    $('#ptxt').textContent = txt; speak(txt);
    $('#pcount').textContent = `${PL.i + 1} de ${PL.steps.length}`;
  }
  PL.elapsed += sec; $('#pb').style.width = Math.min(100, PL.elapsed / PL.total * 100) + '%';
  PL.t = setTimeout(plRun, sec * 1000);
}
function setPlayBtn() { const b = $('#pplay'); if (b && PL) b.innerHTML = PL.paused ? `${ic('play')}${PL.i < 0 ? 'Começar' : 'Continuar'}` : `${ic('pause')}Pausa`; }
function plToggle() {
  if (!PL) return;
  PL.paused = !PL.paused;
  if (PL.paused) { clearTimeout(PL.t); hush(); keepAwake(false); }
  else { keepAwake(true); if (PL.i >= 0) { PL.elapsed -= PL.steps[PL.i][0]; PL.i--; } plRun(); }
  setPlayBtn();
}
function plSkip() {
  if (!PL) return;
  clearTimeout(PL.t);
  if (PL.paused) { PL.paused = false; keepAwake(true); }
  plRun(); setPlayBtn();
}
function plFinish() {
  const { id, tmp, name } = PL; clearTimeout(PL.t); PL = null; keepAwake(false);
  S.state.sessionsLog.push({ id, ts: Date.now() });
  const d = plan();
  if (d.plan.training === id || (!d.done.training && id !== 'suspiro' && !tmp)) markDone('training');
  saveState();
  $('#layer').innerHTML = `<div class="player" role="dialog" aria-modal="true" aria-label="Sessão concluída"><div class="in"><div class="stage">
    <div class="done-mark">${ic('check')}</div><h1>Sessão concluída</h1><p class="faint">${esc(name)}</p></div>
    <button class="btn" onclick="closeLayer();render()">Fechar</button></div></div>`;
  speak('Sessão concluída. Bom trabalho.');
}
export function stopPlayer() {
  if (PL) { clearTimeout(PL.t); PL = null; }
  hush(); keepAwake(false);
  if ($('.player')) closeLayer();
}
function toggleVoice() {
  S.profile.voice = !S.profile.voice; saveProfile();
  const b = $('#vbtn'); if (b) { b.innerHTML = voiceBtn(); b.setAttribute('aria-pressed', S.profile.voice); }
  if (!S.profile.voice) hush();
}
/** Lê um texto livre (ex.: visualização do cartão de jogo) como sessão temporária. */
export function playText(txt, name = 'Visualização pré-jogo') {
  const parts = String(txt).split(/(?<=[.!?])\s+/).filter(Boolean);
  openPlayer('tmp', { n: name, steps: parts.map(p => [Math.max(6, Math.round(p.length / 14)), p]) });
}

try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch {}

export const views = {};
export const handlers = { openPlayer, stopPlayer, plToggle, plSkip, toggleVoice, playText };
