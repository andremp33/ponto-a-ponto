/* Ponto a Ponto — componentes de interface, ícones e gráficos */
import { PILLARS } from './content.js';

const PK = PILLARS.map(p => p.k);
const PN = Object.fromEntries(PILLARS.map(p => [p.k, p.n]));
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Valor JS seguro para usar dentro de um atributo onclick="..." */
export const J = v => esc(JSON.stringify(v));

/* ===== ícones (traço, 24×24) ===== */
const P = {
  ball: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6c3.2 3.4 3.2 9.4 0 12.8M18.4 5.6c-3.2 3.4-3.2 9.4 0 12.8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  coach: '<path d="M20 12.5c0 4-3.6 7-8 7-1.2 0-2.4-.2-3.4-.6L4 20l1.2-3.6C4.4 15.2 4 13.9 4 12.5c0-4 3.6-7 8-7s8 3 8 7z"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M7 5v14l12-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skip: '<path d="M6 5l9 7-9 7z"/><path d="M18 5v14"/>',
  vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 010 6M18 6.5a8 8 0 010 11"/>',
  volOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M6 11H5v10h14V11h-1"/>',
  addSquare: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  spark: '<path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
  chart: '<path d="M4 19h16"/><path d="M5 15l4.5-4.5 3.5 3L19 7"/><path d="M15 7h4v4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
  wind: '<path d="M3 9h11a3 3 0 10-3-3M3 15h15a3 3 0 11-3 3M3 12h7"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
  zap: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  quote: '<path d="M9.5 7C6.5 8 5 10.5 5 14v3h5v-5H7.5M19 7c-3 1-4.5 3.5-4.5 7v3h5v-5H17"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  book: '<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/>',
};
export const ic = (name, label = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${P[name] || ''}</svg>`;

/* ===== blocos de layout ===== */
export const bar = (right = '') => `<div class="bar"><button class="back" onclick="back()">${ic('back')}Voltar</button>${right}</div>`;
/** Linha de lista agrupada. lead: número, ícone (nome) ou HTML. */
export function item({ title, sub = '', lead = '', onclick = '', cls = '', val = '', chev = true, clip = false, attrs = '' }) {
  const leadHtml = lead === '' ? '' : `<span class="lead">${P[lead] ? ic(lead) : lead}</span>`;
  const tag = onclick ? 'button' : 'div';
  return `<${tag} class="item ${onclick ? '' : 'static'} ${cls}" ${onclick ? `type="button" onclick="${onclick}"` : ''} ${attrs}>${leadHtml}<span class="tx"><b>${title}</b>${sub ? `<small class="${clip ? 'clip' : ''}">${sub}</small>` : ''}</span>${val ? `<span class="val">${val}</span>` : ''}${onclick && chev ? `<span class="chev">${ic('chev')}</span>` : ''}</${tag}>`;
}
export const group = (rows, cls = '') => `<div class="group ${cls}">${rows.join('')}</div>`;
export const secTitle = t => `<h2 class="sec-title">${t}</h2>`;
export const spin = (t = '') => `<span class="spin" aria-hidden="true"></span>${t ? ' ' + t : ''}`;
export const checkRow = (on, text, onclick) => `<div class="check ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" tabindex="0" onclick="${onclick}" onkeydown="if(event.key===' '||event.key==='Enter'){event.preventDefault();this.click()}"><span class="bx">${on ? ic('check') : ''}</span><span>${text}</span></div>`;

/* ===== formulários ===== */
/** Número com uma casa decimal, à portuguesa (6,4). */
export const f1 = v => v == null || isNaN(v) ? '–' : (+v).toFixed(1).replace('.', ',');
export function slider(name, label, val = 5, sub = '', { min = 1, max = 10, step = 1, suffix = '', onchange = '' } = {}) {
  const p = ((val - min) / (max - min)) * 100;
  return `<div class="slider"><div class="lab"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="v" id="v_${name}">${val}${suffix}</span></div><input type="range" min="${min}" max="${max}" step="${step}" name="${name}" value="${val}" aria-label="${esc(label)}" style="--p:${p}%" ${suffix ? `data-suffix="${suffix}"` : ''} oninput="sliderInput(this)" ${onchange ? `onchange="${onchange}"` : ''}></div>`;
}
export function sliderInput(el) {
  const min = +el.min, max = +el.max, v = +el.value;
  el.style.setProperty('--p', ((v - min) / (max - min)) * 100 + '%');
  const out = document.getElementById('v_' + el.name);
  if (out) out.textContent = el.dataset.suffix ? v + el.dataset.suffix : v;
}
export const seg = (name, opts, val, cb = '') => `<div class="seg" role="radiogroup" data-name="${name}" data-cb="${cb}">${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<button type="button" role="radio" aria-checked="${v === val}" class="${v === val ? 'on' : ''}" data-v="${esc(v)}" onclick="segPick(this)">${esc(l)}</button>`; }).join('')}</div><input type="hidden" name="${name}" value="${esc(val)}">`;
export function segPick(b) {
  const s = b.parentElement;
  s.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
  s.nextElementSibling.value = b.dataset.v;
  if (s.dataset.cb && typeof window[s.dataset.cb] === 'function') window[s.dataset.cb](b.dataset.v);
}
export const chipset = (name, opts, vals = []) => `<div class="chipset" data-name="${name}">${opts.map(o => `<button type="button" aria-pressed="${vals.includes(o)}" class="${vals.includes(o) ? 'on' : ''}" onclick="chipToggle(this)">${esc(o)}</button>`).join('')}</div>`;
export function chipToggle(b) { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); }
export const chipVals = name => [...document.querySelectorAll(`.chipset[data-name="${name}"] button.on`)].map(b => b.textContent);
export const formData = f => Object.fromEntries(new FormData(f).entries());
export const pillarSliders = (vals = {}, prefix = '') => `<div class="group">${PILLARS.map(p => slider(prefix + p.k, p.n, vals[p.k] || 5, p.s)).join('')}</div>`;

/* ===== camadas ===== */
export function toast(m, ms = 2600) {
  const t = $('#toast'); if (!t) return;
  t.textContent = m; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}
let lastFocus = null;
export function sheet(html, label = 'Opções') {
  lastFocus = document.activeElement;
  $('#layer').innerHTML = `<div class="modal" onclick="if(event.target===this)closeLayer()"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><div class="grab"></div>${html}</div></div>`;
  $('#layer .sheet').focus();
}
export function closeLayer() {
  $('#layer').innerHTML = '';
  if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}
export function confirmBox(msg, onYes, yes = 'Apagar', { danger = true, detail = '' } = {}) {
  sheet(`<h2>${esc(msg)}</h2>${detail ? `<p class="muted">${esc(detail)}</p>` : ''}<div class="grid2 mt"><button class="btn secondary" onclick="closeLayer()">Cancelar</button><button class="btn ${danger ? 'clay' : ''}" id="yes">${esc(yes)}</button></div>`, msg);
  $('#yes').onclick = () => { closeLayer(); onYes(); };
}
export function downloadFile(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ===== gráficos (SVG inline) =====
   Paleta validada (daltonismo + contraste em #FFF e #F2F3EF): series-1 azul, series-2 terra. */
export const C = { s1: '#2a78d6', s2: '#B9502F', rule: '#DCDFD8', grid: '#E8EAE4', ink: '#17332B', ink2: '#4F5E58', ink3: '#7E8A85', paper: '#FFFFFF' };
const SHORT = { emocoes: 'Emoções', reset: 'Reset', corpo: 'Corpo', dialogo: 'Diálogo' };

export function radar(el, series) {
  if (!el) return;
  const W = Math.min(el.clientWidth || 320, 360), H = W - 30, cx = W / 2, cy = H / 2, R = Math.min(W / 2 - 64, H / 2 - 26), n = PK.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / 10, cy + Math.sin(a) * R * v / 10]; };
  let g = '';
  [2.5, 5, 7.5, 10].forEach(v => { g += `<polygon points="${PK.map((_, i) => pt(i, v).join(',')).join(' ')}" fill="none" stroke="${C.grid}" stroke-width="1"/>`; });
  PK.forEach((k, i) => {
    const [x, y] = pt(i, 10); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${C.grid}"/>`;
    const [lx, ly] = pt(i, 12); const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
    g += `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" fill="${C.ink2}" font-size="12" font-weight="600">${SHORT[k] || PN[k]}</text>`;
  });
  const desc = [];
  series.forEach(s => {
    const vals = PK.map(k => +s.values?.[k] || 0); if (!vals.some(Boolean)) return;
    desc.push(`${s.name}: ${PK.map((k, i) => `${PN[k]} ${vals[i] ? f1(vals[i]) : '–'}`).join(', ')}`);
    const pts = vals.map((v, i) => pt(i, v).join(',')).join(' ');
    g += `<polygon points="${pts}" fill="${s.dash ? 'none' : s.color}" fill-opacity="${s.dash ? 0 : 0.1}" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="4 4"' : ''} stroke-linejoin="round"/>`;
    if (!s.dash) vals.forEach((v, i) => { const [x, y] = pt(i, v); g += `<circle cx="${x}" cy="${y}" r="4.5" fill="${s.color}" stroke="${C.paper}" stroke-width="2"><title>${PN[PK[i]]}: ${f1(v)}</title></circle>`; });
  });
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:0 auto;overflow:visible" role="img" aria-label="${esc('Perfil mental. ' + desc.join('. '))}">${g}</svg>`;
}

export function lineChart(el, series, opts = {}) {
  if (!el) return;
  const W = el.clientWidth || 320, H = 180, pl = 30, pr = 14, pt = 16, pb = 26;
  const n = Math.max(...series.map(s => s.values.length)); if (n < 1) return;
  const mn = opts.min ?? 1, mx = opts.max ?? 10, fmt = opts.fmt || f1;
  const x = i => n === 1 ? pl + (W - pl - pr) / 2 : pl + i * (W - pl - pr) / (n - 1);
  const y = v => pt + (mx - v) * (H - pt - pb) / (mx - mn);
  const ticks = [mn, mn + (mx - mn) / 3, mn + 2 * (mx - mn) / 3, mx].map(v => Math.round(v * 10) / 10);
  let g = '';
  ticks.forEach(v => { g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${pl - 8}" y="${y(v) + 4}" fill="${C.ink3}" font-size="11" text-anchor="end">${(mx - mn) < 6 ? f1(v) : Math.round(v)}</text>`; });
  const labels = opts.labels || [];
  [0, n - 1].forEach(i => { if (labels[i] && !(i === n - 1 && n === 1 && i !== 0)) g += `<text x="${x(i)}" y="${H - 6}" fill="${C.ink3}" font-size="11" text-anchor="${n === 1 ? 'middle' : i === 0 ? 'start' : 'end'}">${esc(labels[i])}</text>`; });
  let p = '';
  series.forEach(s => {
    const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
    if (pts.length > 1) p += `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(q => q.join(',')).join(' ')}"/>`;
    pts.forEach(([a, b]) => { p += `<circle cx="${a}" cy="${b}" r="4" fill="${s.color}" stroke="${C.paper}" stroke-width="2"/>`; });
  });
  let hits = ''; const w = (W - pl - pr) / Math.max(1, n - 1);
  for (let i = 0; i < n; i++) hits += `<rect x="${x(i) - w / 2}" y="0" width="${n === 1 ? W : w}" height="${H}" fill="transparent" data-i="${i}"/>`;
  const summary = series.map(s => `${s.name}: ${s.values.map((v, i) => `${labels[i] || i + 1} ${v != null ? fmt(v) : '–'}`).join(', ')}`).join('. ');
  el.innerHTML = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(summary)}">${g}${p}<line class="xh" y1="${pt}" y2="${H - pb}" stroke="${C.ink3}" style="display:none"/>${hits}</svg><div class="tip" role="presentation"></div>`;
  const tip = el.querySelector('.tip'), xh = el.querySelector('.xh');
  const show = i => {
    xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.style.display = '';
    tip.style.display = 'block';
    tip.style.left = Math.min(Math.max(x(i), 76), W - 76) + 'px';
    tip.style.top = Math.max(40, Math.min(...series.map(s => s.values[i] != null ? y(s.values[i]) : H))) + 'px';
    tip.innerHTML = `<b>${esc(labels[i] || '')}</b><br>` + series.map(s => `${esc(s.name)}: ${s.values[i] != null ? fmt(s.values[i]) : '–'}`).join('<br>') + (opts.extra ? opts.extra(i) : '');
  };
  el.querySelectorAll('rect[data-i]').forEach(r => { r.addEventListener('pointerenter', () => show(+r.dataset.i)); r.addEventListener('click', () => show(+r.dataset.i)); });
  el.addEventListener('pointerleave', () => { tip.style.display = 'none'; xh.style.display = 'none'; });
}

/* Sequencial numa só cor (azul), do vazio ao forte. */
export const heatColor = l => [C.grid, '#BCD3F1', '#79A8E5', C.s1][l];
export function heatmap(el, counts, dayKey) {
  if (!el) return;
  const today = new Date(); const start = new Date(today);
  start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - 49);
  let cols = '', active = 0;
  for (let w = 0; w < 8; w++) {
    let c = '';
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
      const k = dayKey(dt), v = counts[k] || 0, lvl = v === 0 ? 0 : v < 2 ? 1 : v < 4 ? 2 : 3;
      if (v && dt <= today) active++;
      const label = dt.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) + `: ${v} ${v === 1 ? 'atividade' : 'atividades'}`;
      c += `<i style="background:${dt > today ? 'transparent' : heatColor(lvl)}" title="${label}"></i>`;
    }
    cols += `<div class="col">${c}</div>`;
  }
  el.innerHTML = `<div class="heatwrap" role="img" aria-label="${active} dias com atividade nas últimas 8 semanas"><div class="dl"><span>S</span><span></span><span>Q</span><span></span><span>S</span><span></span><span>D</span></div><div class="heat">${cols}</div></div>`;
}
