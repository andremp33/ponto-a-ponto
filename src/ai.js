/* Ponto a Ponto — coach de IA. Fornecedores: regras (grátis, sem IA), modelo no telemóvel (grátis),
   Ollama no computador do jogador (grátis) e API da Anthropic (paga, chave do próprio jogador). */
import { S, PK, PN, CHECK, dayKey, TODAY, pillarScores, currentFocus, upcomingTournament, saveProfile } from './core.js';
import { $, esc, toast, spin, item, group } from './ui.js';
import { scienceIndex } from './science.js';
import { DEFAULT_LOCAL, localComplete, LOCAL_MODELS } from './local-llm.js';

const API = 'https://api.anthropic.com/v1/messages';
const AI_LS = 'pap_ai';
export const DEFAULT_MODELS = { model: 'claude-sonnet-5-5', quickModel: 'claude-haiku-5-5' };

/* ===== definições ===== */
export function aiSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(AI_LS) || '{}') || {}; } catch { s = {}; }
  return { key: '', ...DEFAULT_MODELS, localModel: DEFAULT_LOCAL, localReady: false, ollamaUrl: '', ollamaModel: '', ...s, provider: s.provider || (s.key ? 'anthropic' : 'rules') };
}
export function saveAiSettings(patch) {
  const s = { ...aiSettings(), ...patch };
  try { localStorage.setItem(AI_LS, JSON.stringify(s)); } catch (e) { console.warn(e); }
  return s;
}
/** Há um modelo de linguagem ligado (não conta o coach de regras). */
export function hasAI(s = aiSettings()) {
  if (s.provider === 'anthropic') return !!s.key;
  if (s.provider === 'local') return !!s.localReady;
  if (s.provider === 'ollama') return !!(s.ollamaUrl && s.ollamaModel);
  return false;
}
export const PROVIDERS = [
  ['rules', 'Coach offline', 'Grátis e instantâneo. Propõe e ajusta com regras e a biblioteca científica. Sem conversa livre.'],
  ['local', 'IA no telemóvel', 'Grátis. Um modelo pequeno corre no teu iPhone, sem internet depois de descarregado.'],
  ['ollama', 'Ollama no computador', 'Grátis. Usa o Ollama do teu PC; o PC tem de estar ligado e acessível por HTTPS.'],
  ['anthropic', 'Claude (pago)', 'O mais inteligente. Precisa de uma chave da API da Anthropic com créditos.'],
];
export function providerName(s = aiSettings()) {
  if (s.provider === 'local') return `IA no telemóvel (${LOCAL_MODELS.find(m => m.id === s.localModel)?.n || 'modelo local'})`;
  if (s.provider === 'ollama') return `Ollama (${s.ollamaModel || 'sem modelo'})`;
  if (s.provider === 'anthropic') return 'Claude';
  return 'Coach offline';
}

export class AIError extends Error {
  constructor(code, detail = '', status = 0) { super(detail || code); this.code = code; this.status = status; }
}
export function aiErr(e) {
  switch (e?.code) {
    case 'no_key': return 'Não há nenhum modelo de IA ligado. Escolhe um nas Definições (há opções grátis).';
    case 'no_webgpu': return e.message || 'Este telemóvel não consegue correr IA local (falta o WebGPU).';
    case 'local': return 'A IA no telemóvel falhou. Experimenta o modelo mais leve nas Definições.';
    case 'ollama': return 'Não consegui falar com o Ollama. Confirma o endereço, o modelo e o OLLAMA_ORIGINS no PC.';
    case 'auth': return 'Chave inválida. Confirma-a nas Definições.';
    case 'rate': return 'Muitos pedidos, tenta daqui a um minuto.';
    case 'network': return 'Sem ligação. Tenta outra vez quando tiveres rede.';
    case 'overloaded': return 'O serviço está sobrecarregado. Tenta daqui a pouco.';
    case 'model': return 'Modelo não encontrado. Confirma os nomes nas Definições.';
    case 'credit': return 'Sem créditos na tua conta da API. Vê a faturação na Console da Anthropic.';
    case 'refusal': return 'O coach não pode responder a isto. Reformula o pedido.';
    case 'parse': return 'A resposta do coach veio num formato inesperado. Tenta outra vez.';
    default: return 'O coach não conseguiu responder. Tenta outra vez.';
  }
}

/* ===== pedido HTTP ===== */
function body(model, tier, extra) {
  const b = { model, max_tokens: tier === 'quick' ? 4000 : 8000, ...extra };
  // Respostas curtas e diretas: pouco raciocínio nas tarefas rápidas e no chat.
  b.output_config = { effort: tier === 'default' ? 'medium' : 'low' };
  return b;
}
// Se o modelo recusar um pedido, a API reencaminha-o sozinha para um modelo de recurso.
const FALLBACK = /^claude-(sonnet|opus)-5-5$/;
async function post(payload, key) {
  const headers = {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (FALLBACK.test(payload.model)) { headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; payload = { ...payload, fallbacks: 'default' }; }
  let r;
  try {
    r = await fetch(API, { method: 'POST', headers, body: JSON.stringify(payload) });
  } catch (e) { throw new AIError('network', e.message); }
  if (!r.ok) {
    let msg = '';
    try { msg = (await r.json())?.error?.message || ''; } catch {}
    const st = r.status;
    const code = st === 401 || st === 403 ? 'auth' : st === 429 ? 'rate' : st === 404 ? 'model'
      : st === 529 || st >= 500 ? 'overloaded' : /credit|billing/i.test(msg) ? 'credit' : 'http';
    throw new AIError(code, msg, st);
  }
  return r;
}
const modelFor = (tier, s = aiSettings()) => (tier === 'quick' ? s.quickModel : s.model) || DEFAULT_MODELS[tier === 'quick' ? 'quickModel' : 'model'];
const textOf = msg => (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

const PERSONA_SHORT = `És o coach mental e de estratégia de um tenista competitivo. Escreves sempre em português de Portugal, tratas o jogador por "tu", és direto, caloroso e prático. Tomas a iniciativa: propões tu o plano, sem pedir ao jogador para o escrever, e ajustas ao que ele responder. Frases curtas. Não inventes estudos, números nem citações.`;
/** Contexto curto para modelos pequenos (janela de 4096 tokens). */
function compactSystem(extra = '') {
  const sc = pillarScores(), p = S.profile, f = currentFocus(), d = S.state.days[TODAY()];
  return `${PERSONA_SHORT}

JOGADOR: ${p.name || 'Jogador'}, ${p.level}, ${p.hand}, estilo ${(p.style || []).join(', ') || '-'}, pancada mais forte ${p.strength}, superfície ${p.surface}. Desafios: ${(p.challenges || []).slice(0, 3).join('; ') || '-'}.
COMPETÊNCIAS (1-10): ${PK.map(k => `${PN[k]} ${sc[k] != null ? sc[k].toFixed(1) : '-'}`).join('; ')}
${d ? `HOJE: competência ${PN[d.plan.pillar]}${d.plan.matchDay ? ', dia de jogo' : ''}. ` : ''}Foco: ${f ? f.text : '-'}. Palavras-chave: ${(p.cues || []).join(', ')}
MEMÓRIA: ${(p.coachMemory || []).slice(-5).map(m => m.t).join(' | ') || '-'}
ÚLTIMOS REGISTOS:
${S.entries.slice(0, 4).map(entryLine).map(l => l.slice(0, 300)).join('\n') || '-'}${extra ? '\n\n' + extra : ''}`;
}
const blocksText = sys => Array.isArray(sys) ? sys.map(b => b.text).join('\n\n') : String(sys || '');
let lastProgress = 0;
const showProgress = r => { const pct = Math.round((r.progress || 0) * 100); if (pct !== lastProgress) { lastProgress = pct; toast(`A preparar a IA no telemóvel… ${pct}%`, 4000); } };

/* ===== Ollama (API nativa) ===== */
async function ollamaChat(s, messages, { json = false, onText } = {}) {
  const url = s.ollamaUrl.replace(/\/+$/, '') + '/api/chat';
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: s.ollamaModel, messages, stream: !!onText, ...(json ? { format: 'json' } : {}), options: { num_ctx: 8192 } }) });
  } catch (e) { throw new AIError('ollama', e.message); }
  if (!r.ok) { let m = ''; try { m = (await r.json()).error || ''; } catch {} throw new AIError(r.status === 404 ? 'model' : 'ollama', m, r.status); }
  if (!onText) return (await r.json()).message?.content || '';
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', acc = '';
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; try { acc += JSON.parse(line).message?.content || ''; onText(acc); } catch {} }
  }
  return acc;
}

/** Pedido genérico a qualquer fornecedor. system: blocos (Anthropic) ou texto. */
async function ask({ system, messages, tier = 'default', json = false, onText, extra = '' }) {
  const s = aiSettings();
  if (!hasAI(s)) throw new AIError('no_key');
  if (s.provider === 'local') {
    try { return await localComplete(s.localModel, { messages: [{ role: 'system', content: compactSystem(extra) }, ...messages], json, onText, maxTokens: onText ? 450 : 800, onProgress: showProgress }); }
    catch (e) { console.warn(e); throw e.code ? new AIError(e.code, e.message) : new AIError('local', e.message); }
  }
  if (s.provider === 'ollama') return ollamaChat(s, [{ role: 'system', content: blocksText(system) }, ...messages], { json, onText });
  return null; // Anthropic: tratado por quem chama
}

/** System em blocos: a parte estável primeiro (persona + biblioteca) para poder ficar em cache. */
export function systemBlocks(extra = '', n = 12) {
  return [
    { type: 'text', text: `${PERSONA}\n\nBIBLIOTECA CIENTÍFICA (estudos na app; cita pelo autor e ano):\n${scienceIndex()}`, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: context(n) + (extra ? '\n\n' + extra : '') },
  ];
}
export async function complete({ system, messages, tier = 'default', json = false }) {
  const s = aiSettings();
  if (s.provider !== 'anthropic') return ask({ system, messages, tier, json });
  if (!s.key) throw new AIError('no_key');
  const r = await post(body(modelFor(tier, s), tier, { system, messages }), s.key);
  const msg = await r.json();
  if (msg.stop_reason === 'refusal') throw new AIError('refusal');
  return textOf(msg);
}

export function parseJSON(t) {
  const m = String(t).match(/\{[\s\S]*\}/);
  if (!m) throw new AIError('parse', 'sem JSON');
  try { return JSON.parse(m[0]); } catch (e) { throw new AIError('parse', e.message); }
}

/** Pede um objeto JSON ao coach, com o contexto completo do jogador. */
export async function askJSON(task, tier = 'default') {
  const system = systemBlocks();
  const text = await complete({ system, tier, json: true, messages: [{ role: 'user', content: `TAREFA:\n${task}\n\nResponde APENAS com um objeto JSON válido, sem texto à volta, em português de Portugal.` }] });
  return parseJSON(text);
}

/** Chat em streaming (SSE). onText recebe o texto acumulado. Devolve o texto final. */
export async function chatStream(messages, onText, { system, tier = 'chat', extra = '' } = {}) {
  const s = aiSettings();
  if (s.provider !== 'anthropic') return ask({ system, messages, tier, onText, extra });
  if (!s.key) throw new AIError('no_key');
  const r = await post(body(modelFor('default', s), tier, { system, messages, stream: true, max_tokens: 8000 }), s.key);
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '', acc = '', refused = false;
  const handle = line => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim(); if (!data) return;
    let ev; try { ev = JSON.parse(data); } catch { return; }
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { acc += ev.delta.text; onText(acc); }
    else if (ev.type === 'message_delta' && ev.delta?.stop_reason === 'refusal') refused = true;
    else if (ev.type === 'error') throw new AIError(ev.error?.type === 'overloaded_error' ? 'overloaded' : ev.error?.type === 'rate_limit_error' ? 'rate' : 'http', ev.error?.message || '');
  };
  for (;;) {
    let chunk;
    try { chunk = await reader.read(); } catch (e) { throw new AIError('network', e.message); }
    if (chunk.done) break;
    buf += dec.decode(chunk.value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i).replace(/\r$/, '')); buf = buf.slice(i + 1); }
  }
  if (buf) handle(buf.trim());
  if (refused && !acc) throw new AIError('refusal');
  return acc;
}

/** Verifica a chave e os dois modelos com pedidos mínimos. */
export async function testConnection(key, models) {
  const out = [];
  for (const [tier, model] of [['default', models.model], ['quick', models.quickModel]]) {
    try {
      const r = await post({ model, max_tokens: 64, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Responde só: ok' }] }, key);
      await r.json(); out.push({ tier, model, ok: true });
    } catch (e) { out.push({ tier, model, ok: false, code: e.code, detail: e.message }); }
  }
  return out;
}

/* ===== persona e contexto ===== */
export const PERSONA = `És o coach mental e de estratégia pessoal deste jogador de ténis competitivo: psicólogo do desporto e treinador tático ao mesmo tempo. Falas português de Portugal e tratas o jogador por "tu". És direto, caloroso e prático, sem frases feitas nem motivação vazia.
Tomas a iniciativa: nunca pedes ao jogador para escrever um plano. Propões tu primeiro uma ideia ou um plano concreto (tática, rotinas, foco mental), com base nos dados dele, e depois ajustas ao que ele responder. Quando faltar informação, assumes o mais provável, dizes o que assumiste e fazes no máximo uma ou duas perguntas curtas.
Baseias-te em métodos com evidência: rotinas entre pontos (reagir, recuperar, preparar, ritual), reset após o erro (largar, corrigir, comprometer), planos se-então, objetivos de processo, palavras-chave, foco externo, respiração com expiração longa, reavaliação da ansiedade, diálogo interno na 2.ª pessoa, visualização, padrões táticos (serviço + 1, direção da bola, altura e profundidade, jogar para a pancada fraca), preparação com plano A e B.
Quando citares investigação, usa apenas os estudos da BIBLIOTECA CIENTÍFICA abaixo, pelo autor e ano; não inventes estudos, números nem citações. Exemplos de jogadores profissionais só com factos verificáveis.
És conciso e acionável: no máximo um ou dois exercícios de cada vez. Não dás conselhos médicos.`;

export function profileText() {
  const p = S.profile;
  return `${p.name || 'Jogador'}; nível: ${p.level}; ${p.ranking || 'sem ranking indicado'}; ${p.years || '?'} anos de ténis; ${p.hand}, esquerda a ${p.backhand}; estilo: ${(p.style || []).join(', ') || '-'}; pancada mais forte: ${p.strength}; superfície preferida: ${p.surface}. ${p.extra || ''}\nDesafios mentais que identificou: ${(p.challenges || []).join('; ') || '-'}\nObjetivo da época: ${p.seasonGoal || '-'}\nTreina ${p.days} dias/semana; sessões mentais de ${p.duration} min.`;
}
export function entryLine(e) {
  const d = dayKey(e.ts);
  const sk = e.skills ? ' Notas: ' + PK.filter(k => e.skills[k]).map(k => `${PN[k]} ${e.skills[k]}`).join(', ') + '.' : '';
  if (e.type === 'checkin') return `${d} CHECK-IN (${e.plan || '-'}): ${CHECK.map(([k, l]) => l.toLowerCase() + ' ' + e[k]).join(', ')}${e.sleep ? `, sono ${e.sleep}h` : ''}${e.intent ? `. Intenção: "${e.intent}"` : ''}`;
  if (e.type === 'pre') return `${d} PRÉ-JOGO vs ${e.opp || '?'} (${e.surface || '-'}${e.round ? ', ' + e.round : ''}; sabe do adversário: ${(e.oppTags || []).join(', ') || '-'}; estilo: ${e.oppStyle || '-'}), nervos ${e.nerves}/10. Plano A: ${e.planA || e.ai?.plano_a || '-'}. Plano B: ${e.planB || e.ai?.plano_b || '-'}. Riscos: ${e.threats || '-'}`;
  if (e.type === 'post') return `${d} JOGO vs ${e.opp || '?'} — ${e.result || ''} ${e.score || ''}${e.round ? ' (' + e.round + ')' : ''}.${sk} Estatísticas: 1.º serv ${e.fs || '-'}%, duplas ${e.df || '-'}, BP ganhos ${e.bpw || '-'}/${e.bpt || '-'}. Bem: ${e.good || '-'}. Mal: ${e.bad || '-'}. Momento-chave: ${e.key || '-'}. Emoção: ${e.emotion || '-'}. O que pesou: ${(e.tags || []).join(', ') || '-'}${e.ai?.resumo ? `. Análise do coach: ${e.ai.resumo}` : ''}`;
  if (e.type === 'practice') return `${d} TREINO (${e.what || '-'}): qualidade ${e.quality}/10, intenção cumprida ${e.intentDone || '-'}/10.${sk} Aprendi: ${e.learned || '-'}`;
  return '';
}
export function context(n = 12) {
  const sc = pillarScores(), p = S.profile, f = currentFocus(), d = S.state.days[TODAY()], t = upcomingTournament();
  const goals = S.state.goals.filter(g => !g.done).map(g => `- [${g.area}] ${g.title} (${g.kind}${g.deadline ? ', até ' + g.deadline : ''}, ${g.progress || 0}%)`).join('\n');
  return `PERFIL:\n${profileText()}\n\nPERFIL MENTAL ATUAL (1-10): ${PK.map(k => `${PN[k]} ${sc[k] != null ? sc[k].toFixed(1) : '-'}`).join('; ')}\nFoco atual: ${f ? f.text : '-'}. Palavras-chave: ${(p.cues || []).join(', ')}\n${d ? `Plano de hoje: competência ${PN[d.plan.pillar]}${d.plan.matchDay ? ' (dia de jogo)' : ''}.` : ''}\n${t ? `Próximo torneio: ${t.name} (${t.start}, ${t.surface || ''}). Objetivo: ${t.goal || '-'}` : ''}\n\nOBJETIVOS ATIVOS:\n${goals || '-'}\n\nO QUE JÁ SABES DESTE JOGADOR (memória do coach):\n${(p.coachMemory || []).map(m => '- ' + m.t).join('\n') || '-'}\n\nREGISTOS RECENTES (mais recente primeiro):\n${S.entries.slice(0, n).map(entryLine).join('\n') || '(sem registos)'}\n\nHoje é ${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`;
}

/** Ajusta uma proposta anterior (JSON) ao que o jogador respondeu. Devolve o mesmo formato + "resposta". */
export async function adjustJSON(what, current, history, text, tier = 'default') {
  const clean = { ...current }; delete clean.resposta; delete clean.sugestoes;
  const conv = (history || []).map(m => (m.r === 'u' ? 'Jogador: ' : 'Coach: ') + m.t).join('\n');
  return askJSON(`Propuseste isto (${what}), em JSON:\n${JSON.stringify(clean)}\n${conv ? `\nConversa sobre a proposta até agora:\n${conv}\n` : ''}\nO jogador responde: "${text}"\n\nAjusta a proposta ao que ele disse, mantendo o que continua válido. Devolve o MESMO objeto JSON com as mesmas chaves (todas preenchidas), mais "resposta" (1-2 frases a dizer o que mudaste e porquê; se fizer sentido, termina com uma pergunta curta) e "sugestoes" (array de 2-3 respostas curtas que o jogador pode tocar, até 6 palavras cada, na voz do jogador).`, tier);
}

/* ===== ajudas de interface ===== */
/** Corre fn com o botão em estado "a carregar"; mostra o erro num toast. */
export async function aiBtn(btn, label, fn) {
  const b = typeof btn === 'string' ? $(btn) : btn;
  const old = b?.innerHTML;
  if (b) { b.disabled = true; b.innerHTML = spin(label); }
  let ok = true;
  try { await fn(); } catch (e) { ok = false; console.warn(e); toast(aiErr(e), 4500); }
  if (b && document.body.contains(b)) { b.disabled = false; b.innerHTML = old; }
  return ok;
}
/** Linha que leva às Definições quando não há chave. */
export const aiOff = (what = 'o coach') => group([item({ lead: 'spark', title: 'Precisa de um modelo de IA', sub: `Para ${what}, liga a IA no telemóvel (grátis) nas Definições.`, onclick: "go('settings')" })]);

/** Pede ao modelo; sem modelo (ou se o modelo grátis falhar) usa o coach de regras. */
export async function coachJSON(task, rules, tier = 'default') {
  const s = aiSettings();
  if (!hasAI(s)) return rules();
  try { return await askJSON(task, tier); }
  catch (e) {
    if (s.provider === 'anthropic' || !rules) throw e;
    console.warn(e); toast(`${aiErr(e)} Usei o coach offline.`, 4500); return rules();
  }
}
/** Blocos de texto de uma resposta JSON do coach. */
export function aiSections(ai, map) {
  return map.filter(([k]) => ai && ai[k] && (!Array.isArray(ai[k]) || ai[k].length)).map(([k, t]) => `<div class="ai-sect"><div class="t">${t}</div>${Array.isArray(ai[k]) ? `<ul>${ai[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<div class="ai-text">${esc(ai[k])}</div>`}</div>`).join('');
}

/* ===== memória do coach ===== */
export function addMemory(list) {
  if (!list) return;
  const arr = (Array.isArray(list) ? list : [list]).map(s => String(s).trim()).filter(Boolean);
  const mem = S.profile.coachMemory || [];
  arr.forEach(t => { if (!mem.some(m => m.t === t)) mem.push({ t, ts: Date.now() }); });
  S.profile.coachMemory = mem.slice(-20); saveProfile();
}
export async function updateMemoryFromChat() {
  if (!hasAI() || S.chat.length < 2) return;
  try {
    const conv = S.chat.slice(-12).map(m => (m.role === 'user' ? 'Jogador: ' : 'Coach: ') + m.content).join('\n');
    const r = await askJSON(`Conversa recente:\n${conv}\n\nExtrai 0-3 notas novas e duradouras sobre o jogador (factos que ele disse, preferências, padrões confirmados) que ainda não estejam na memória. Nada de conselhos teus. Chave: "memoria" (array de strings até 20 palavras).`, 'quick');
    addMemory(r.memoria);
  } catch (e) { console.warn('memória', e); }
}
