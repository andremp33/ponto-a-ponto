/* Definições: perfil, foco, voz, lembrete, coach de IA e dados */
import { S, clone, uid, render, go, saveProfile, exportJSON, parseBackup, importBackup, resetData, hasUndo, restoreUndo, getMeta, setMeta, storageInfo, requestPersist, daysSinceBackup, shortDate, TODAY } from '../core.js';
import { aiSettings, saveAiSettings, testConnection, aiErr, profileText, DEFAULT_MODELS } from '../ai.js';
import { $, esc, ic, bar, seg, secTitle, toast, confirmBox, downloadFile, spin } from '../ui.js';

export const APP_VERSION = '3.1.0';

function aiSection() {
  const s = aiSettings();
  return `${secTitle('Coach de IA')}
  <div class="panel">
    <p class="muted" style="margin-top:0">O coach usa a API da Anthropic com a tua própria chave. A chave fica guardada só neste telemóvel e só sai daqui para ser enviada diretamente à Anthropic.</p>
    <label class="f" for="aiKey">Chave da API</label>
    <input type="password" id="aiKey" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(s.key)}">
    <details class="more" style="background:var(--chalk)"><summary>Modelos</summary><div class="inner">
      <label class="f" for="aiModel" style="margin-top:0">Análises e conversa</label>
      <input type="text" id="aiModel" autocapitalize="off" spellcheck="false" value="${esc(s.model)}" placeholder="${DEFAULT_MODELS.model}">
      <label class="f" for="aiQuick">Tarefas rápidas (insight, memória, frases)</label>
      <input type="text" id="aiQuick" autocapitalize="off" spellcheck="false" value="${esc(s.quickModel)}" placeholder="${DEFAULT_MODELS.quickModel}">
      <p class="hint">Por omissão: ${DEFAULT_MODELS.model} e ${DEFAULT_MODELS.quickModel}.</p>
    </div></details>
    <div class="grid2 mt"><button class="btn secondary" id="aiTest" onclick="aiTestConn()">Testar ligação</button><button class="btn" onclick="aiSave()">Guardar</button></div>
    <div id="aiTestOut" aria-live="polite"></div>
    <p class="hint mt">Recomendado: define um limite de gastos mensal na <a href="https://console.anthropic.com/settings/limits" target="_blank" rel="noopener">Console da Anthropic</a>.</p>
    ${s.key ? `<button class="btn danger" onclick="aiForget()">Remover a chave deste telemóvel</button>` : ''}
  </div>`;
}
function readAiForm() {
  return { key: $('#aiKey').value.trim(), model: $('#aiModel').value.trim() || DEFAULT_MODELS.model, quickModel: $('#aiQuick').value.trim() || DEFAULT_MODELS.quickModel };
}
function aiSave() { saveAiSettings(readAiForm()); toast('Definições do coach guardadas'); render(); }
function aiForget() { confirmBox('Remover a chave da API?', () => { saveAiSettings({ key: '' }); render(); toast('Chave removida'); }, 'Remover'); }
async function aiTestConn() {
  const f = readAiForm(), out = $('#aiTestOut'), b = $('#aiTest');
  if (!f.key) { out.innerHTML = `<p class="hint mt">Cola primeiro a chave.</p>`; return; }
  b.disabled = true; b.innerHTML = spin('A testar…');
  const res = await testConnection(f.key, f);
  b.disabled = false; b.textContent = 'Testar ligação';
  const ok = res.every(r => r.ok);
  if (ok) saveAiSettings(f);
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
  settings_after: fillStorage,
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

export const handlers = { backupNow, undoImport, aiSave, aiForget, aiTestConn, setVoice, saveWeekFocus, saveCues, redoProfile, makeReminder, exportData, importFile, importPaste, resetAll };
