/* Neuro: grelha de Schulte e tempo de reação */
import { S, plan, markDone, saveState, trainingInfo, fmtDate, avg, render } from '../core.js';
import { $, esc, bar, group, item, secTitle, toast } from '../ui.js';

let NZ = null, NZIV = null;

function neuro() {
  const id = S.param, info = trainingInfo(id), schulte = id === 'neuro_schulte';
  const hist = S.state.neuro.filter(x => x.t === (schulte ? 'schulte' : 'react')).slice(-8);
  const unit = schulte ? fmtS : (v => v + ' ms');
  return `${bar()}<h1>${esc(info.n)}</h1><p class="lede">${esc(info.d)}</p>
  ${schulte
    ? `<div class="row between" aria-live="polite"><b id="nzNext">Próximo: 1</b><b id="nzTime" class="display" style="font-size:26px">0,0 s</b></div><div class="schulte" id="grid"></div><button class="btn" id="nzStart" onclick="schulteStart()">Começar</button>`
    : `<div class="react" id="rx" role="button" tabindex="0" aria-live="assertive" onpointerdown="reactTap()" onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();reactTap()}">Toca para começar</div><p class="hint">5 tentativas. Espera pela cor terra. Tocar antes conta como falsa partida.</p>`}
  ${hist.length ? `${secTitle('Últimos resultados')}${group(hist.slice().reverse().map(x => item({ title: fmtDate(x.ts), val: unit(x.ms) })))}` : ''}`;
}
const fmtS = ms => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
function drawSchulte(active) {
  const g = $('#grid'); if (!g) return;
  const nums = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
  g.innerHTML = nums.map(n => `<button ${active ? '' : 'disabled aria-hidden="true"'} onclick="schulteTap(this,${n})">${active ? n : ''}</button>`).join('');
}
function schulteStart() {
  drawSchulte(true); NZ = { next: 1, t0: performance.now() };
  $('#nzStart').hidden = true;
  clearInterval(NZIV);
  NZIV = setInterval(() => { const el = $('#nzTime'); if (!el || !NZ || NZ.next == null) { clearInterval(NZIV); return; } el.textContent = fmtS(performance.now() - NZ.t0); }, 100);
}
function schulteTap(b, n) {
  if (!NZ) return;
  if (n !== NZ.next) { b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 250); return; }
  b.classList.add('ok'); NZ.next++;
  $('#nzNext').textContent = 'Próximo: ' + Math.min(NZ.next, 25);
  if (NZ.next > 25) {
    const ms = Math.round(performance.now() - NZ.t0); clearInterval(NZIV); NZ = null;
    S.state.neuro.push({ t: 'schulte', ms, ts: Date.now() });
    if (plan().plan.training === 'neuro_schulte') markDone('training');
    saveState(); toast(`Feito em ${fmtS(ms)}`); setTimeout(render, 900);
  }
}
function reactArm() {
  const el = $('#rx'); NZ.state = 'wait'; el.textContent = 'Espera…'; el.classList.remove('go');
  NZ.to = setTimeout(() => { if (!NZ || !$('#rx')) return; NZ.state = 'go'; NZ.t0 = performance.now(); el.classList.add('go'); el.textContent = 'Toca!'; }, 1200 + Math.random() * 2600);
}
function reactTap() {
  const el = $('#rx'); if (!el) return;
  if (!NZ) { NZ = { times: [], state: 'wait' }; return reactArm(); }
  if (NZ.state === 'wait') { clearTimeout(NZ.to); el.classList.remove('go'); el.textContent = 'Cedo demais! Toca para repetir'; NZ.state = 'false'; return; }
  if (NZ.state === 'false' || NZ.state === 'between') return reactArm();
  if (NZ.state === 'go') {
    const ms = Math.round(performance.now() - NZ.t0); NZ.times.push(ms); el.classList.remove('go');
    if (NZ.times.length >= 5) {
      const a = Math.round(avg(NZ.times)); el.textContent = `Média: ${a} ms`;
      S.state.neuro.push({ t: 'react', ms: a, ts: Date.now() });
      if (plan().plan.training === 'neuro_react') markDone('training');
      saveState(); NZ = null; setTimeout(render, 1400); return;
    }
    el.textContent = `${ms} ms. Toca para a próxima (${NZ.times.length} de 5)`; NZ.state = 'between';
  }
}
function neuroAfter() { NZ = null; clearInterval(NZIV); if (S.param === 'neuro_schulte') drawSchulte(false); }

export const views = { neuro, neuro_after: neuroAfter };
export const handlers = { schulteStart, schulteTap, reactTap };
