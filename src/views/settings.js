/* Definições: perfil, foco, voz, lembrete, coach de IA e dados */
import { S, clone, uid, render, go, saveProfile, exportJSON, parseBackup, importBackup, resetData, hasUndo, restoreUndo, getMeta, setMeta, storageInfo, requestPersist, daysSinceBackup, shortDate, TODAY } from '../core.js';
import { aiSettings, saveAiSettings, testConnection, aiErr, profileText, DEFAULT_MODELS, PROVIDERS } from '../ai.js';
import { LOCAL_MODELS, webgpuInfo, getEngine, localComplete, removeModel, crashedLastTime, clearCrashFlag } from '../local-llm.js';
import { $, esc, ic, bar, seg, group, secTitle, toast, confirmBox, downloadFile, spin } from '../ui.js';

export const APP_VERSION = '3.2.0';

function aiSection() {
  const s = aiSettings(), pv = s.provider;
  const choose = group(PROVIDERS.map(([k, n, d]) => `<button type="button" class="item ${pv === k ? 'done' : ''}" role="radio" aria-checked="${pv === k}" onclick="setProvider('${k}')"><span class="lead">${pv === k ? ic('check') : ''}</span><span class="tx"><b>${n}</b><small>${d}</small></span></button>`));
  let body = '';
  if (pv === 'rules') body = `<p class="muted" style="margin:0">O coach offline prepara o dia, o cartão de jogo, a análise e o plano do torneio a partir dos teus dados, das lições e dos estudos da biblioteca, e ajusta-se quando tocas nas respostas. Não tem conversa livre: para isso, liga a IA no telemóvel.</p>`;
  if (pv === 'local') body = `<div id="gpuInfo" class="hint" style="margin:0 0 10px">A verificar se este telemóvel aguenta…</div>
    ${crashedLastTime() ? `<p class="msg err" style="max-width:none">Da última vez, a IA não terminou de carregar (o iPhone pode ter fechado a app por falta de memória). Experimenta o modelo mais leve.</p>` : ''}
    <label class="f" style="margin-top:0">Modelo</label>
    ${group(LOCAL_MODELS.map(m => `<button type="button" class="item ${s.localModel === m.id ? 'done' : ''}" role="radio" aria-checked="${s.localModel === m.id}" onclick="setLocalModel('${m.id}')"><span class="lead">${s.localModel === m.id ? ic('check') : ''}</span><span class="tx"><b>${m.n}</b><small>${m.size}. ${m.note}</small></span></button>`), 'flat')}
    <div id="dlWrap" class="mt" hidden><div class="progress"><i id="dlBar" style="width:0%"></i></div><p class="hint" id="dlTxt" aria-live="polite">A começar…</p></div>
    ${s.localReady
      ? `<p class="hint mt" style="margin-bottom:0">${ic('check')} Modelo guardado neste telemóvel. Funciona sem internet.</p><div class="grid2 mt"><button class="btn secondary" id="locTest" onclick="localTest()">Testar</button><button class="btn secondary" onclick="localRemove()">Apagar modelo</button></div><div id="locOut" aria-live="polite"></div>`
      : `<button class="btn mt" id="dlBtn" onclick="localDownload()">${ic('download')}Descarregar e ativar</button><p class="hint" style="margin-bottom:0">Usa Wi-Fi: é um download grande, feito uma só vez. As respostas são mais simples do que as do Claude e as primeiras podem demorar alguns segundos.</p>`}`;
  if (pv === 'ollama') body = `<p class="muted" style="margin-top:0">Usa um modelo do Ollama que corre no teu computador. O PC tem de estar ligado e o endereço tem de ser <b>https://</b> (o Safari bloqueia http a partir desta app).</p>
    <label class="f" for="olUrl">Endereço do Ollama</label><input type="text" id="olUrl" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://o-meu-pc.ts.net" value="${esc(s.ollamaUrl)}">
    <label class="f" for="olModel">Modelo</label><input type="text" id="olModel" autocapitalize="off" spellcheck="false" placeholder="ex.: llama3.2, qwen2.5:7b" value="${esc(s.ollamaModel)}">
    <div class="grid2 mt"><button class="btn secondary" id="olTest" onclick="ollamaTest()">Testar ligação</button><button class="btn" onclick="ollamaSave()">Guardar</button></div><div id="olOut" aria-live="polite"></div>
    <details class="more" style="background:var(--chalk)"><summary>Como preparar o PC</summary><div class="inner"><ol class="install-steps" style="color:var(--ink)">
      <li>No PC, define a variável <code>OLLAMA_ORIGINS=https://andremp33.github.io</code> e reinicia o Ollama.</li>
      <li>Instala o Tailscale (grátis) no PC e no iPhone, e no PC corre <code>tailscale serve --bg 11434</code>.</li>
      <li>Cola aqui o endereço https que o Tailscale te mostrar.</li></ol></div></details>`;
  if (pv === 'anthropic') body = `<p class="muted" style="margin-top:0">Usa a API da Anthropic com a tua própria chave (paga, com créditos pré-pagos). A chave fica só neste telemóvel e só é enviada diretamente à Anthropic.</p>
    <label class="f" for="aiKey">Chave da API</label>
    <input type="password" id="aiKey" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(s.key)}">
    <details class="more" style="background:var(--chalk)"><summary>Modelos</summary><div class="inner">
      <label class="f" for="aiModel" style="margin-top:0">Análises e conversa</label>
      <input type="text" id="aiModel" autocapitalize="off" spellcheck="false" value="${esc(s.model)}" placeholder="${DEFAULT_MODELS.model}">
      <label class="f" for="aiQuick">Tarefas rápidas (plano do dia, memória, frases)</label>
      <input type="text" id="aiQuick" autocapitalize="off" spellcheck="false" value="${esc(s.quickModel)}" placeholder="${DEFAULT_MODELS.quickModel}">
      <p class="hint">Para gastar o mínimo, põe ${DEFAULT_MODELS.quickModel} nos dois campos.</p>
    </div></details>
    <div class="grid2 mt"><button class="btn secondary" id="aiTest" onclick="aiTestConn()">Testar ligação</button><button class="btn" onclick="aiSave()">Guardar</button></div>
    <div id="aiTestOut" aria-live="polite"></div>
    <p class="hint mt">Define um limite de gastos mensal na <a href="https://console.anthropic.com/settings/limits" target="_blank" rel="noopener">Console da Anthropic</a>.</p>
    ${s.key ? `<button class="btn danger" onclick="aiForget()">Remover a chave deste telemóvel</button>` : ''}`;
  return `${secTitle('Coach')}${choose}<div class="panel mt">${body}</div>`;
}
function setProvider(k) {
  const s = aiSettings();
  if (k === 'local' && !s.localReady) toast('Descarrega o modelo para o ativar.');
  saveAiSettings({ provider: k }); render();
}
function setLocalModel(id) {
  const s = aiSettings(); if (s.localModel === id) return;
  saveAiSettings({ localModel: id, localReady: false }); clearCrashFlag(); render();
}
async function localDownload() {
  const s = aiSettings(), g = await webgpuInfo();
  if (!g.ok) return toast(g.reason, 5000);
  await requestPersist();
  const b = $('#dlBtn'); b.disabled = true; b.innerHTML = spin('A descarregar…'); $('#dlWrap').hidden = false;
  try {
    await getEngine(s.localModel, r => {
      const pct = Math.round((r.progress || 0) * 100);
      const bar = $('#dlBar'), txt = $('#dlTxt');
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = `${pct}%. ${pct < 100 ? 'Não feches a app.' : 'A preparar…'}`;
    });
    saveAiSettings({ localReady: true, provider: 'local' }); clearCrashFlag();
    toast('IA no telemóvel pronta'); render();
  } catch (e) {
    console.warn(e); toast(e.code === 'no_webgpu' || e.code === 'network' ? e.message : aiErr({ code: 'local' }), 5000);
    if (document.body.contains(b)) { b.disabled = false; b.innerHTML = `${ic('download')}Tentar outra vez`; }
  }
}
async function localTest() {
  const s = aiSettings(), b = $('#locTest'), out = $('#locOut');
  b.disabled = true; b.innerHTML = spin('A pensar…'); const t0 = performance.now();
  try {
    const txt = await localComplete(s.localModel, { messages: [{ role: 'system', content: 'Responde em português de Portugal, numa frase curta.' }, { role: 'user', content: 'Dá-me uma dica mental para o próximo ponto de ténis.' }], maxTokens: 60 });
    out.innerHTML = `<div class="msg a mt" style="max-width:none">${esc(txt.trim())}</div><p class="hint">Respondeu em ${((performance.now() - t0) / 1000).toFixed(1).replace('.', ',')} s.</p>`;
  } catch (e) { console.warn(e); out.innerHTML = `<p class="msg err mt" style="max-width:none">${esc(e.code === 'no_webgpu' ? e.message : aiErr({ code: 'local' }))}</p>`; }
  b.disabled = false; b.textContent = 'Testar';
}
function localRemove() {
  confirmBox('Apagar o modelo deste telemóvel?', async () => {
    await removeModel(aiSettings().localModel); saveAiSettings({ localReady: false, provider: 'rules' }); toast('Modelo apagado. Ficou o coach offline.'); render();
  }, 'Apagar', { detail: 'Liberta o espaço. Podes voltar a descarregá-lo quando quiseres.' });
}
async function fillGpu() {
  const el = $('#gpuInfo'); if (!el) return;
  const g = await webgpuInfo();
  el.innerHTML = g.ok ? `${ic('check')} Este telemóvel tem WebGPU${g.f16 ? '' : ' (sem f16: o modelo ocupa um pouco mais)'}.` : `${ic('x')} ${esc(g.reason)} Usa o coach offline.`;
}
function readOllama() { return { ollamaUrl: $('#olUrl').value.trim().replace(/\/+$/, ''), ollamaModel: $('#olModel').value.trim() }; }
function ollamaSave() { const f = readOllama(); saveAiSettings({ ...f, provider: 'ollama' }); toast('Ollama guardado'); render(); }
async function ollamaTest() {
  const f = readOllama(), out = $('#olOut'), b = $('#olTest');
  if (!/^https:\/\//.test(f.ollamaUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(f.ollamaUrl)) { out.innerHTML = '<p class="hint mt">O endereço tem de começar por https://.</p>'; return; }
  b.disabled = true; b.innerHTML = spin('A testar…');
  try {
    const r = await fetch(f.ollamaUrl + '/api/tags');
    const models = ((await r.json()).models || []).map(m => m.name);
    const ok = !f.ollamaModel || models.some(m => m === f.ollamaModel || m.startsWith(f.ollamaModel + ':'));
    out.innerHTML = `<p class="hint mt">${ok ? `${ic('check')} Ligado. ` : `${ic('x')} O modelo "${esc(f.ollamaModel)}" não está instalado. `}Modelos no PC: ${esc(models.join(', ') || 'nenhum')}.</p>`;
    if (ok && f.ollamaModel) saveAiSettings({ ...f, provider: 'ollama' });
  } catch (e) { out.innerHTML = `<p class="msg err mt" style="max-width:none">${esc(aiErr({ code: 'ollama' }))}</p>`; }
  b.disabled = false; b.textContent = 'Testar ligação';
}
function readAiForm() {
  return { key: $('#aiKey').value.trim(), model: $('#aiModel').value.trim() || DEFAULT_MODELS.model, quickModel: $('#aiQuick').value.trim() || DEFAULT_MODELS.quickModel };
}
function aiSave() { saveAiSettings({ ...readAiForm(), provider: 'anthropic' }); toast('Definições do coach guardadas'); render(); }
function aiForget() { confirmBox('Remover a chave da API?', () => { saveAiSettings({ key: '' }); render(); toast('Chave removida'); }, 'Remover'); }
async function aiTestConn() {
  const f = readAiForm(), out = $('#aiTestOut'), b = $('#aiTest');
  if (!f.key) { out.innerHTML = `<p class="hint mt">Cola primeiro a chave.</p>`; return; }
  b.disabled = true; b.innerHTML = spin('A testar…');
  const res = await testConnection(f.key, f);
  b.disabled = false; b.textContent = 'Testar ligação';
  const ok = res.every(r => r.ok);
  if (ok) saveAiSettings({ ...f, provider: 'anthropic' });
  out.innerHTML = `<div class="group mt">${res.map(r => `<div class="item static ${r.ok ? 'done' : ''}"><span class="lead">${ic(r.ok ? 'check' : 'x')}</span><span class="tx"><b>${esc(r.model)}</b><small>${r.ok ? 'Ligação a funcionar' : esc(aiErr(r)) + (r.detail && r.code !== 'network' ? ' ' + esc(r.detail) : '')}</small></span></div>`).join('')}</div>${ok ? '<p class="hint mt">Tudo certo. A chave ficou guardada.</p>' : ''}`;
}

function setVoice(v) { S.profile.voice = v === '1'; saveProfile(); }
function saveWeekFocus() { S.profile.weekFocus = $('#wf').value.trim(); saveProfile(); toast('Foco guardado'); }
function saveCues() { S.profile.cues = $('#cuesIn').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5); saveProfile(); toast('Palavras-chave guardadas'); }
function redoProfile() { S.ob = clone(S.profile); S.obStep = 1; go('onboarding'); }

function makeReminder() {
  const t = $('#remT').value || '19:00'; S.profile.reminder = t; saveProfile();
  const [hh, mm] = t.split(':'); const ymd = TODAY().replace(/-/g, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ponto a Ponto//PT', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:pap-' + uid() + '@pontoaponto',
    'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z', `DTSTART:${ymd}T${hh}${mm}00`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
    'SUMMARY:Ponto a Ponto: treino mental', 'DESCRIPTION:Check-in\\, lição e treino mental do dia.',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Treino mental', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  downloadFile('ponto-a-ponto-lembrete.ics', ics, 'text/calendar');
  toast('Abre o ficheiro para o adicionar ao calendário.', 4000);
}

/** Cópia de segurança: no iPhone abre a folha de partilha (Guardar em Ficheiros / iCloud); senão descarrega. */
async function backupNow() {
  const name = `ponto-a-ponto-backup-${TODAY()}.json`, json = exportJSON();
  let file = null; try { file = new File([json], name, { type: 'application/json' }); } catch {}
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Cópia do Ponto a Ponto' });
      setMeta({ lastBackup: Date.now() }); toast('Cópia guardada'); render(); return;
    } catch (e) { if (e?.name === 'AbortError') return; console.warn(e); }
  }
  downloadFile(name, json); setMeta({ lastBackup: Date.now() }); toast('Cópia descarregada'); render();
}
function exportData() { downloadFile(`ponto-a-ponto-backup-${TODAY()}.json`, exportJSON()); setMeta({ lastBackup: Date.now() }); toast('Cópia descarregada'); render(); }
function undoImport() {
  confirmBox('Voltar aos dados anteriores?', () => { restoreUndo(); S.stack = []; go(S.profile.onboarded ? 'home' : 'onboarding'); toast('Dados anteriores repostos'); }, 'Repor', { danger: false, detail: 'Repõe os dados que estavam no telemóvel antes da última importação ou de apagar tudo.' });
}
async function fillStorage() {
  const el = $('#storeInfo'); if (!el) return;
  let info = await storageInfo();
  if (info.persisted === false) { await requestPersist(); info = await storageInfo(); }
  const since = daysSinceBackup(), kb = Math.max(1, Math.round(info.bytes / 1024));
  el.innerHTML = `<div class="group">
    <div class="item static"><span class="lead">${ic(info.persisted ? 'check' : 'x')}</span><span class="tx"><b>${info.persisted ? 'Armazenamento persistente' : 'Armazenamento normal'}</b><small>${info.persisted ? 'O sistema não apaga estes dados para libertar espaço.' : 'O sistema pode apagar dados se o telemóvel ficar sem espaço. Instala a app no ecrã principal e faz cópias.'}</small></span></div>
    <div class="item static"><span class="lead">${ic('list')}</span><span class="tx"><b>${S.entries.length} ${S.entries.length === 1 ? 'registo' : 'registos'}</b><small>${kb} KB guardados neste telemóvel</small></span></div>
    <div class="item static ${since != null && since < 14 ? 'done' : ''}"><span class="lead">${ic(since != null && since < 14 ? 'check' : 'download')}</span><span class="tx"><b>Última cópia</b><small>${since == null ? 'Ainda nenhuma' : since === 0 ? 'Hoje' : `Há ${since} ${since === 1 ? 'dia' : 'dias'} (${shortDate(getMeta().lastBackup)})`}</small></span></div>
  </div>`;
}
function askImport(text) {
  let r;
  try { r = parseBackup(text); } catch (e) { toast(e.message, 4000); return; }
  confirmBox('Substituir os dados deste telemóvel?', () => {
    importBackup(r.data);
    S.stack = []; S.ob = null; S.obStep = 0;
    go(S.profile.onboarded ? 'home' : 'onboarding');
    toast('Dados importados');
  }, 'Importar', { danger: false, detail: `A cópia tem ${r.entries} ${r.entries === 1 ? 'registo' : 'registos'}${r.name ? ' de ' + r.name : ''}. Os dados atuais deste telemóvel são substituídos.` });
}
async function importFile(input) {
  const f = input.files?.[0]; if (!f) return;
  try { askImport(await f.text()); } catch { toast('Não consegui ler o ficheiro.'); }
  input.value = '';
}
function importPaste() {
  const v = $('#impTxt').value.trim();
  if (!v) return toast('Cola primeiro o JSON da cópia.');
  askImport(v);
}
function resetAll() {
  confirmBox('Apagar todos os dados?', () => {
    resetData(); S.view = 'onboarding'; S.obStep = 0; S.ob = null; S.stack = []; render(); toast('Dados apagados');
  }, 'Apagar tudo', { detail: 'Perfil, registos, objetivos, torneios e conversa. Não dá para desfazer. A chave da API mantém-se.' });
}

export const views = {
  settings_after: () => { fillStorage(); fillGpu(); },
  settings: () => `${bar()}<h1>Definições</h1>
  ${secTitle('Os teus dados')}
  <div class="panel"><p class="muted" style="margin-top:0">Os teus dados ficam guardados só neste telemóvel, sem conta nem servidor. Uma cópia no iCloud protege-te se trocares de telemóvel ou apagares a app.</p>
    <div id="storeInfo" class="mb"></div>
    <button class="btn" onclick="backupNow()">${ic('share')}Guardar cópia no iCloud ou Ficheiros</button>
    <button class="btn secondary mt" onclick="exportData()">${ic('download')}Descarregar cópia (JSON)</button>
    <label class="btn secondary mt" style="cursor:pointer">${ic('upload')}Importar de ficheiro<input type="file" accept="application/json,.json,text/plain" onchange="importFile(this)" style="position:absolute;width:1px;height:1px;opacity:0"></label>
    <details class="more" style="background:var(--chalk)"><summary>Colar JSON</summary><div class="inner">
      <p class="hint" style="margin-top:0">Aceita também a cópia da versão antiga (no artifact: Definições, Copiar cópia).</p>
      <textarea id="impTxt" aria-label="JSON da cópia" placeholder='{"profile": …, "state": …, "entries": […]}'></textarea>
      <button class="btn secondary mt" onclick="importPaste()">Importar</button></div></details>
    ${hasUndo() ? `<button class="btn text" onclick="undoImport()">Repor os dados anteriores</button><br>` : ''}
    <button class="btn danger mt" onclick="resetAll()">Apagar todos os dados</button></div>
  ${aiSection()}
  ${secTitle('Perfil')}
  <div class="panel"><p class="muted" style="margin:0 0 12px;white-space:pre-line">${esc(profileText())}</p><button class="btn secondary" onclick="redoProfile()">Refazer perfil e avaliação</button></div>
  ${secTitle('Foco da semana')}
  <div class="panel"><input type="text" id="wf" aria-label="Foco da semana" value="${esc(S.profile.weekFocus || '')}" placeholder="Vazio: o coach sugere"><button class="btn secondary mt" onclick="saveWeekFocus()">Guardar foco</button></div>
  ${secTitle('Palavras-chave')}
  <div class="panel"><input type="text" id="cuesIn" aria-label="Palavras-chave separadas por vírgulas" value="${esc((S.profile.cues || []).join(', '))}"><p class="hint">Até 5, separadas por vírgulas.</p><button class="btn secondary" onclick="saveCues()">Guardar palavras-chave</button></div>
  ${secTitle('Voz nas sessões guiadas')}
  <div class="panel">${seg('voice', [['1', 'Ligada'], ['0', 'Desligada']], S.profile.voice ? '1' : '0', 'setVoice')}<p class="hint" style="margin-bottom:0">Usa a voz em português do teu telemóvel.</p></div>
  ${secTitle('Lembrete diário')}
  <div class="panel"><p class="muted" style="margin-top:0">O iPhone não deixa esta app agendar notificações. Em alternativa, adiciona um evento diário ao teu calendário.</p>
    <div class="row"><input type="time" id="remT" aria-label="Hora do lembrete" value="${esc(S.profile.reminder || '19:00')}" style="flex:1"><button class="btn small" onclick="makeReminder()">${ic('calendar')}Adicionar</button></div></div>
  <p class="hint" style="text-align:center;margin-top:28px">Ponto a Ponto ${APP_VERSION}</p>`,
};

export const handlers = { setProvider, setLocalModel, localDownload, localTest, localRemove, ollamaSave, ollamaTest, backupNow, undoImport, aiSave, aiForget, aiTestConn, setVoice, saveWeekFocus, saveCues, redoProfile, makeReminder, exportData, importFile, importPaste, resetAll };
