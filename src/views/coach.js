/* Coach: chat em streaming com contexto completo e memória editável */
import { S, saveChat, saveProfile, render } from '../core.js';
import { systemBlocks, chatStream, hasAI, aiErr, aiOff, addMemory, updateMemoryFromChat } from '../ai.js';
import { $, esc, J, ic, confirmBox, toast } from '../ui.js';

const SUGG = ['Que padrões vês nos meus jogos?', 'Como lido com a pressão a servir para o set?', 'Prepara-me para o próximo jogo', 'Perdi a cabeça depois de um erro. E agora?', 'O que devo treinar esta semana?', 'Dá-me uma rotina pré-jogo'];
let busy = false, openerTried = false;
const CHAT_RULES = 'Vais conversar com o jogador. Respostas curtas (normalmente até 120 palavras), texto simples sem markdown. Toma a iniciativa: propõe ideias e planos concretos em vez de fazer muitas perguntas; se faltar informação, assume o mais provável e diz o que assumiste. Se ele pedir um exercício que existe na app (respiração box, suspiro fisiológico, grelha de foco, visualização, reset em 3 passos, rotina entre pontos), sugere-o pelo nome. Quando citares investigação, só da biblioteca científica.';

function coach() {
  const mem = S.profile.coachMemory || [];
  return `<h1>Coach</h1><p class="lede">Conhece o teu perfil, os teus objetivos e os teus últimos registos.</p>
  ${hasAI() ? '' : `<div class="mb">${aiOff('o coach')}</div>`}
  <details class="more"><summary>O que o coach sabe sobre ti (${mem.length})</summary><div class="inner flush">
    ${mem.length ? mem.map((m, i) => `<div class="mem"><span>${esc(m.t)}</span><button onclick="memDel(${i})" aria-label="Apagar esta nota">${ic('x')}</button></div>`).join('') : '<p class="hint" style="margin:0 16px 8px">Ainda nada. O coach vai aprendendo com os teus jogos e conversas.</p>'}
    <div class="row" style="padding:8px 16px 8px"><input type="text" id="memIn" aria-label="Nova nota para o coach" placeholder="Algo que o coach deve saber"><button class="btn small" onclick="memAdd()" aria-label="Acrescentar nota">${ic('plus')}</button></div>
  </div></details>
  <div class="chat" id="chat" aria-live="polite">${S.chat.length ? S.chat.map(m => `<div class="msg ${m.role === 'user' ? 'u' : 'a'}">${esc(m.content)}</div>`).join('') : hasAI() ? '' : `<div class="msg a">Olá${S.profile.name ? ' ' + esc(S.profile.name) : ''}! Sou o teu coach mental e de estratégia. Ativa-me nas Definições e eu preparo os teus jogos, o teu dia e os teus torneios.</div>`}<div id="chatEnd"></div></div>
  <div class="scroller">${SUGG.map(s => `<button onclick="sendChat(${J(s)})">${esc(s)}</button>`).join('')}</div>
  <div class="composer"><textarea id="chatIn" rows="1" aria-label="Mensagem para o coach" placeholder="Escreve…" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,140)+'px'">${esc(S.chatDraft || '')}</textarea><button class="btn" id="sendBtn" onclick="sendChat()" aria-label="Enviar">${ic('send')}</button></div>
  ${S.chat.length ? `<button class="btn text" onclick="newChat()">Nova conversa</button>` : ''}`;
}
function coachAfter() {
  const draft = S.chatDraft; S.chatDraft = '';
  const c = $('#chatEnd'); if (c && S.chat.length) c.scrollIntoView({ block: 'end' });
  if (hasAI() && !S.chat.length && !openerTried && !draft) { openerTried = true; opener(); }
}
/* O coach começa a conversa: propõe ideias a partir dos dados, sem esperar por uma pergunta. */
async function opener() {
  if (busy) return; busy = true;
  $('#chatEnd')?.insertAdjacentHTML('beforebegin', `<div class="msg a" id="live"><span class="faint">O coach está a olhar para os teus dados…</span></div>`);
  const live = $('#live'), sb = $('#sendBtn'); if (sb) sb.disabled = true;
  try {
    const out = (await chatStream([{ role: 'user', content: '(O jogador acabou de abrir o chat e ainda não escreveu nada.) Começa tu: cumprimenta-o pelo nome numa frase, propõe 1 ou 2 ideias concretas para esta semana a partir dos dados dele (jogos, torneio, competência mais fraca, objetivos) e termina com uma pergunta curta. Máximo 80 palavras.' }], t => { if (live?.isConnected) live.textContent = t; }, { system: systemBlocks(CHAT_RULES, 15) })).trim();
    if (out) { S.chat.push({ role: 'assistant', content: out }); saveChat(); }
    if (live) { live.textContent = out || '…'; live.removeAttribute('id'); }
  } catch (e) { console.warn(e); if (live) { live.textContent = aiErr(e); live.classList.add('err'); live.removeAttribute('id'); } }
  busy = false; const b = $('#sendBtn'); if (b) b.disabled = false;
}
function memAdd() { const v = $('#memIn').value.trim(); if (!v) return; addMemory(v); render(); }
function memDel(i) { S.profile.coachMemory.splice(i, 1); saveProfile(); render(); }

async function sendChat(text) {
  if (busy) return;
  const inp = $('#chatIn'); text = (text || inp.value).trim(); if (!text) return;
  if (!hasAI()) return toast(aiErr({ code: 'no_key' }), 4000);
  busy = true; inp.value = ''; inp.style.height = '';
  S.chat.push({ role: 'user', content: text });
  $('#chatEnd').insertAdjacentHTML('beforebegin', `<div class="msg u">${esc(text)}</div><div class="msg a" id="live"><span class="faint">A pensar…</span></div>`);
  $('#chatEnd').scrollIntoView({ behavior: 'smooth', block: 'end' });
  const live = $('#live'), sb = $('#sendBtn'); sb.disabled = true;
  const system = systemBlocks(CHAT_RULES, 15);
  const msgs = [];
  S.chat.slice(-20).forEach(m => { const last = msgs[msgs.length - 1]; if (last && last.role === m.role) last.content += '\n' + m.content; else msgs.push({ role: m.role, content: m.content }); });
  if (msgs.length && msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: '(Abri o chat.)' });
  try {
    const out = (await chatStream(msgs, t => { if (live.isConnected) live.textContent = t; }, { system })).trim();
    live.textContent = out || '…'; live.removeAttribute('id');
    S.chat.push({ role: 'assistant', content: out }); saveChat();
    if (S.chat.length % 8 === 0) updateMemoryFromChat();
  } catch (e) {
    console.warn(e); live.textContent = aiErr(e); live.classList.add('err'); live.removeAttribute('id'); S.chat.pop(); saveChat();
  }
  busy = false; const b = $('#sendBtn'); if (b) b.disabled = false;
}
function newChat() {
  confirmBox('Começar uma nova conversa?', async () => { await updateMemoryFromChat(); S.chat = []; saveChat(); openerTried = false; render(); }, 'Nova conversa', { danger: false, detail: 'O coach guarda primeiro o que for importante na memória.' });
}
function onKey(e) { if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'chatIn') { e.preventDefault(); sendChat(); } }
document.addEventListener('keydown', onKey);

export const views = { coach, coach_after: coachAfter };
export const handlers = { sendChat, newChat, memAdd, memDel };
