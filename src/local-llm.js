/* Ponto a Ponto — modelo de IA a correr no próprio telemóvel (WebLLM + WebGPU).
   Só é carregado se o jogador escolher "IA no telemóvel" nas Definições. Grátis e offline depois de descarregado. */

// Versão fixa (publicada a 2026-10-11). Os pesos do modelo ficam na Cache Storage do navegador.
const WEBLLM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm';

export const LOCAL_MODELS = [
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', f32: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', n: 'Qwen2.5 1.5B', size: 'cerca de 1 GB', note: 'Recomendado: melhor português. Precisa de um iPhone recente (2021 ou mais novo).' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', f32: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', n: 'Llama 3.2 1B', size: 'cerca de 0,7 GB', note: 'Mais leve e mais rápido, para iPhones com menos memória. Respostas mais simples.' },
];
export const DEFAULT_LOCAL = LOCAL_MODELS[0].id;

let lib = null, engine = null, engineId = null, loading = null;

export async function webgpuInfo() {
  if (!('gpu' in navigator)) return { ok: false, reason: 'O teu navegador não tem WebGPU. No iPhone precisas do iOS 26 ou mais recente.' };
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return { ok: false, reason: 'O WebGPU está desligado ou não há placa gráfica disponível.' };
    return { ok: true, f16: a.features.has('shader-f16') };
  } catch (e) { return { ok: false, reason: 'Não consegui aceder ao WebGPU.' }; }
}
async function loadLib() {
  if (!lib) {
    try { lib = await import(WEBLLM); }
    catch (e) { throw Object.assign(new Error('Não consegui descarregar o motor de IA. Precisas de rede na primeira vez.'), { code: 'network' }); }
  }
  return lib;
}
async function resolveId(base) {
  const m = LOCAL_MODELS.find(x => x.id === base) || LOCAL_MODELS[0];
  const g = await webgpuInfo();
  if (!g.ok) throw Object.assign(new Error(g.reason), { code: 'no_webgpu' });
  return g.f16 ? m.id : m.f32;
}

/** Carrega o modelo (descarrega na primeira vez). onProgress recebe {progress: 0..1, text}. */
export async function getEngine(base, onProgress) {
  const id = await resolveId(base);
  if (engine && engineId === id) return engine;
  if (loading) return loading;
  loading = (async () => {
    const L = await loadLib();
    if (engine) { try { await engine.unload(); } catch {} engine = null; }
    // Marca para detetar, no próximo arranque, se o iOS fechou a app por falta de memória.
    try { localStorage.setItem('pap_llm_loading', String(Date.now())); } catch {}
    try {
      engine = await L.CreateMLCEngine(id, { initProgressCallback: r => onProgress?.(r) });
      engineId = id; return engine;
    } finally { try { localStorage.removeItem('pap_llm_loading'); } catch {} }
  })();
  try { return await loading; } finally { loading = null; }
}
export const crashedLastTime = () => { try { return !!localStorage.getItem('pap_llm_loading'); } catch { return false; } };
export const clearCrashFlag = () => { try { localStorage.removeItem('pap_llm_loading'); } catch {} };

export async function isCached(base) {
  try { const L = await loadLib(); return await L.hasModelInCache(await resolveId(base)); } catch { return false; }
}
export async function removeModel(base) {
  const L = await loadLib();
  if (engine) { try { await engine.unload(); } catch {} engine = null; engineId = null; }
  for (const id of [base, LOCAL_MODELS.find(x => x.id === base)?.f32].filter(Boolean)) { try { await L.deleteModelAllInfoInCache(id); } catch {} }
}

/** Pedido ao modelo local, no formato de mensagens do chat (OpenAI). */
export async function localComplete(base, { messages, json = false, onText, maxTokens = 700, onProgress }) {
  const eng = await getEngine(base, onProgress);
  if (onText) {
    const chunks = await eng.chat.completions.create({ messages, stream: true, max_tokens: maxTokens });
    let acc = '';
    for await (const c of chunks) { acc += c.choices?.[0]?.delta?.content || ''; onText(acc); }
    return acc;
  }
  const r = await eng.chat.completions.create({ messages, max_tokens: maxTokens, ...(json ? { response_format: { type: 'json_object' } } : {}) });
  return r.choices?.[0]?.message?.content || '';
}
