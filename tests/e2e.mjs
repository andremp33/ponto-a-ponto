// Teste ponta a ponta: node tests/e2e.mjs  (screenshots em tests/out/)
// iPhone 390×844 @2x, API da Anthropic simulada (JSON e SSE). Falha com erros na consola.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'tests', 'out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const data = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

/* ---------- API simulada ---------- */
const calls = [];
function answer(task) {
  if (/visualização guiada/.test(task)) return { titulo: 'Servir para fechar', descricao: 'Ensaio do momento de fechar o set.', passos: Array.from({ length: 8 }, (_, i) => ({ texto: `Passo ${i + 1}. Respira e sente a raquete.`, segundos: 8 })) };
  if (/Divide este objetivo/.test(task)) return { passos: ['Fazer a rotina em todos os pontos do treino', 'Registar 3 jogos com nota de rotina', 'Rever a rotina com o treinador'] };
  if (/torneio "/.test(task)) return { antes: ['Dormir 8 horas', 'Treinar pontos a partir do serviço'], vespera: ['Preparar o saco', 'Visualização de 5 minutos'], dia_de_jogo: ['Aquecer 20 min', 'Rotina pré-jogo 10 min'], entre_jogos: ['Comer e hidratar', 'Rever 2 notas'], depois_derrota: ['Escrever 3 aprendizagens'], foco_mental: 'Um ponto de cada vez' };
  if (/revisão dos últimos/.test(task)) return { titulo: 'Semana consistente', o_que_mudou: 'Fizeste o loop quase todos os dias.', padroes: ['Mais calma depois do check-in', 'Pressão a servir'], prioridade: 'Rotina antes do serviço', plano: ['Box breathing nas mudanças de lado', 'Rotina em todos os serviços', 'Rever 1 jogo'], foco_proximo: 'Rotina antes de cada serviço', memoria: ['Responde bem a rotinas'] };
  if (/frase de treinador/.test(task)) return { frase: 'Pés antes, mais altura, tu sabes esta bola' };
  if (/insight curto/.test(task)) return { titulo: 'Hoje, a 2.ª bola', texto: 'Nos teus jogos, os pontos longos correm melhor quando atacas a 2.ª bola. Hoje, faz 10 minutos disso.' };
  if (/onboarding/.test(task) || /Conversa recente/.test(task)) return { memoria: ['Joga melhor em terra batida', 'Fica nervoso no início'] };
  if (/Pré-jogo|Cartão de jogo/.test(task)) return { plano: 'Servir aberto no deuce e atacar a direita inside-in. Mais altura se ele devolver tudo.', chaves: ['Pés', 'Respira', 'Agressivo'], primeiros_jogos: 'Serve com margem e procura ritmo.', se_correr_mal: 'Mais altura e peso; sobe à rede.', reset: 'Larga, corrige, compromete.', ativacao: 'Suspiro fisiológico antes de servir.', visualizacao: 'Fecha os olhos. Vês o court. Respiras. Serves aberto. Sentes a bola sair.' };
  if (/registou este jogo|Analisa este jogo/.test(task)) return { resumo: 'Começaste nervoso mas encontraste a rotina no 2.º set.', padrao: 'Ainda poucos dados', ponto_forte: 'Resiliência depois do break.', a_trabalhar: 'Pressão a servir para o set.', exercicio: 'Servir para o set 10 vezes, 15 min.', foco_proximo: 'Rotina antes de servir', memoria: ['Perde o 1.º set por nervos'] };
  if (/Reflexão de treino/.test(task)) return { resumo: 'Treino de qualidade.', a_trabalhar: 'Manter a intenção nos pontos.', exercicio: 'Pontos a partir do serviço.', foco_proximo: 'Intenção em cada bola' };
  return { ok: true };
}
const sse = text => {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const parts = text.match(/.{1,12}/g);
  return ev('message_start', { message: { id: 'msg_1', role: 'assistant', content: [] } })
    + ev('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } })
    + ev('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: '' } })
    + ev('content_block_stop', { index: 0 })
    + ev('content_block_start', { index: 1, content_block: { type: 'text', text: '' } })
    + parts.map(t => ev('content_block_delta', { index: 1, delta: { type: 'text_delta', text: t } })).join('')
    + ev('content_block_stop', { index: 1 }) + ev('message_delta', { delta: { stop_reason: 'end_turn' } }) + ev('message_stop', {});
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };

/* ---------- arranque ---------- */
await rm(OUT, { recursive: true, force: true }); await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-PT', acceptDownloads: true });
await ctx.route('https://api.anthropic.com/**', async route => {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const body = JSON.parse(req.postData()); calls.push({ headers: req.headers(), body });
  if (body.stream) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: sse('Boa pergunta. Nos teus jogos, a pressão aparece a servir para o set. Experimenta a rotina de 4 fases: respira, escolhe o alvo, diz a palavra-chave e serve.') });
  const task = body.messages.at(-1).content;
  return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(answer(task)) }], stop_reason: 'end_turn' }) });
});
await ctx.addInitScript(() => { if (!localStorage.getItem('pap_ai')) localStorage.setItem('pap_ai', JSON.stringify({ key: 'sk-ant-teste' })); });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
// Os diálogos speechSynthesis não existem no headless; o player tem de funcionar na mesma.

const problems = [];
let n = 0;
async function shot(name) {
  await page.waitForTimeout(250);
  const file = `${String(++n).padStart(2, '0')}-${name}.png`;
  // Na captura de página inteira a tab bar fixa ficaria a meio; põe-na no fim e esconde os toasts.
  await page.evaluate(() => { const s = document.createElement('style'); s.id = 'shotcss'; s.textContent = '#tabbar{position:relative!important}.toast{display:none!important}'; document.head.append(s); });
  await page.screenshot({ path: join(OUT, file), fullPage: true });
  await page.evaluate(() => document.getElementById('shotcss')?.remove());
  const issues = await page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`scroll horizontal: ${document.documentElement.scrollWidth}px`);
    document.querySelectorAll('#main *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > innerWidth + 1 && !el.closest('.scroller')) out.push(`sai do ecrã: <${el.tagName.toLowerCase()} class="${el.className?.baseVal ?? el.className}"> right=${Math.round(r.right)}`);
    });
    const bar = document.querySelector('#tabbar');
    if (bar && !bar.hidden) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const last = [...document.querySelectorAll('#main > *')].pop();
      const top = bar.getBoundingClientRect().top;
      if (last && last.getBoundingClientRect().bottom > top + 1) out.push(`tab bar tapa o último elemento (${last.tagName.toLowerCase()}.${last.className})`);
      window.scrollTo(0, 0);
    }
    return [...new Set(out)].slice(0, 6);
  });
  if (issues.length) problems.push(`${file}: ${issues.join('; ')}`);
  console.log('  ', file, issues.length ? '⚠ ' + issues.join('; ') : '');
}
const click = async sel => { await page.locator(sel).first().click(); await page.waitForTimeout(120); };
const step = t => console.log(t);
const views = () => page.evaluate(() => S.view);

try {
  /* Onboarding */
  step('Onboarding');
  await page.goto(BASE); await page.waitForSelector('.obdots');
  await shot('onboarding-0');
  await click('button:has-text("Começar")');
  await page.fill('#ob_name', 'Rita'); await click('.seg[data-name=ob_level] button:has-text("Competição regional")');
  await page.fill('#ob_ranking', 'Top 300 nacional'); await page.fill('#ob_years', '9');
  await shot('onboarding-1');
  await click('button:has-text("Continuar")');
  await click('.chipset button:has-text("Agressivo")'); await click('.chipset button:has-text("All-court")');
  await click('button:has-text("Continuar")');
  await click('.chipset button:has-text("Fechar sets e jogos")'); await click('.chipset button:has-text("Perder a concentração")');
  await shot('onboarding-3');
  await click('button:has-text("Continuar")');
  await page.locator('input[name=ob_pressao]').fill('3'); await page.locator('input[name=ob_confianca]').fill('7');
  await shot('onboarding-4');
  await click('button:has-text("Continuar")');
  await page.fill('#ob_goal', 'Ganhar mais jogos de 3 sets');
  await click('button:has-text("Ver o meu perfil")');
  await page.waitForSelector('#obRadar svg'); await shot('onboarding-6');
  await click('button:has-text("Começar o programa")');
  await page.waitForSelector('.court');
  await shot('hoje');

  /* Lição */
  step('Lição');
  await click('.group .item:nth-child(2)'); await page.waitForSelector('.prose');
  await shot('licao');
  await click('button:has-text("Marcar como lida")');

  /* Sessão guiada */
  step('Sessão guiada');
  await click('.group .item:nth-child(3)');
  if (await views() === 'neuro' || await views() === 'reframe') await page.evaluate(() => { back(); openPlayer('vis_confianca'); });
  await page.waitForSelector('.player');
  await click('#pplay'); await shot('player');
  for (let i = 0; i < 40 && await page.locator('#pskip').count(); i++) await page.locator('#pskip').click();
  await page.waitForSelector('.done-mark'); await shot('player-fim');
  await click('.player .btn:has-text("Fechar")');
  step('Respiração');
  await page.evaluate(() => startTraining('respiracao_box')); await click('#pplay'); await page.waitForTimeout(700); await shot('player-respiracao');
  await page.evaluate(() => stopPlayer());

  /* Check-in pela folha Registar */
  step('Check-in');
  await click('.tabbar .plus'); await page.waitForSelector('.sheet'); await shot('folha-registar');
  await click('.sheet .item:has-text("Check-in")');
  await page.locator('input[name=confianca]').fill('8'); await page.fill('#ciIntent', 'Atacar a 2.ª bola');
  await shot('checkin');
  await click('button:has-text("Guardar check-in")');

  /* Preparar jogo */
  step('Preparar jogo');
  await page.evaluate(() => go('pre'));
  await page.fill('#pOpp', 'João'); await page.fill('#pStyle', 'Defensivo'); await page.fill('#pA', 'Servir aberto');
  await click('#preBtn'); await page.waitForSelector('.cues'); await shot('cartao-de-jogo');
  await click('button:has-text("Ouvir")'); await page.waitForSelector('.player'); await page.evaluate(() => stopPlayer());

  /* Rever jogo */
  step('Rever jogo');
  await click('button:has-text("Rever este jogo")');
  await click('.seg[data-name=result] button:has-text("Derrota")'); await page.fill('#oScore', '4-6 6-3 8-10');
  await click('summary:has-text("Estatísticas")'); await page.fill('#sFs', '61'); await page.fill('#sDf', '4'); await page.fill('#sBw', '2'); await page.fill('#sBt', '7');
  await click('.chipset button:has-text("Nervos")');
  await page.fill('#oGood', 'Reação ao break'); await shot('rever-jogo-form');
  await click('#postBtn'); await page.waitForSelector('.panel.ink'); await shot('rever-jogo');

  /* Reflexão de treino */
  step('Reflexão');
  await page.evaluate(() => go('practice'));
  await page.fill('#prWhat', 'Cesto de direitas'); await click('summary:has-text("Avaliar competências")');
  await page.fill('#prLearned', 'Pés antes'); await click('#prBtn'); await page.waitForSelector('.panel.ink'); await shot('reflexao');

  /* Desafio */
  step('Desafio');
  await page.evaluate(() => go('challenge')); await page.fill('#chNote', 'Correu bem'); await shot('desafio');
  await click('button:has-text("Fiz o desafio")');

  /* Schulte */
  step('Schulte');
  await page.evaluate(() => go('neuro', 'neuro_schulte')); await shot('schulte-inicio');
  await click('#nzStart');
  for (let i = 1; i <= 25; i++) await page.locator('#grid button', { hasText: new RegExp(`^${i}$`) }).click();
  await page.waitForTimeout(1200); await shot('schulte-fim');

  /* Reação */
  step('Reação');
  await page.evaluate(() => go('neuro', 'neuro_react'));
  for (let i = 0; i < 5; i++) {
    await page.locator('#rx').dispatchEvent('pointerdown');
    await page.waitForSelector('#rx.go', { timeout: 6000 });
    await page.locator('#rx').dispatchEvent('pointerdown');
  }
  await page.waitForTimeout(1600); await shot('reacao');

  /* Reframe */
  step('Reframe');
  await page.evaluate(() => go('reframe'));
  await page.fill('#rfC', 'Falhas sempre esta bola'); await click('#rfAi');
  await page.waitForFunction(() => document.querySelector('#rfT')?.value);
  await click('button:has-text("Guardar")'); await shot('reframe');

  /* Objetivo */
  step('Objetivo');
  await click('.tabbar .plus'); await click('.sheet .item:has-text("Objetivo")');
  await page.fill('#gTitle', 'Rotina em todos os pontos'); await click('button:has-text("Guardar")');
  await click('#gStepsAi'); await page.waitForSelector('.check'); await click('.check');
  await shot('objetivo');

  /* Torneio */
  step('Torneio');
  await page.evaluate(() => go('tournamentEdit'));
  const d = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await page.fill('#tName', 'Open de Lisboa'); await page.fill('#tStart', d); await page.fill('#tGoal', 'Chegar aos quartos');
  await click('button:has-text("Guardar")'); await click('#tpBtn'); await page.waitForSelector('.check');
  await click('.check'); await shot('torneio');

  /* Coach */
  step('Coach');
  await click('.tabbar button:has-text("Coach")');
  await click('.scroller button:has-text("Que padrões")');
  await page.waitForFunction(() => document.querySelectorAll('.msg.a').length >= 1 && !document.querySelector('#live'));
  await page.fill('#chatIn', 'E a pressão a servir?'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#live'));
  await click('summary:has-text("O que o coach sabe")');
  await shot('coach');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, `${String(++n).padStart(2, '0')}-coach-ecra.png`) });

  /* Insight */
  step('Insight');
  await click('.tabbar button:has-text("Hoje")');
  await click('.item:has-text("Insight do dia")'); await page.waitForSelector('.panel.ink h3');
  await shot('hoje-depois');

  /* Treinar */
  step('Treinar');
  await click('.tabbar button:has-text("Treinar")'); await shot('treinar-sessoes');
  await click('.scroller button:has-text("Biblioteca")'); await click('.scroller button:has-text("Pressão")'); await shot('treinar-biblioteca');
  await click('.scroller button:has-text("Neuro")'); await shot('treinar-neuro');
  await click('.scroller button:has-text("Personalizado")');
  await click('#visBtn'); await page.waitForSelector('.player'); await page.evaluate(() => stopPlayer());
  await shot('treinar-personalizado');

  /* Eu, progresso, diário */
  step('Eu');
  await click('.tabbar button:has-text("Eu")'); await page.waitForSelector('#meRadar svg'); await shot('eu');
  await click('.item:has-text("Progresso")'); await click('#weekBtn'); await page.waitForSelector('#weekOut .panel');
  await page.locator('#c1 rect[data-i]').last().click(); await shot('progresso');
  await page.evaluate(() => go('history')); await shot('diario');
  await page.evaluate(() => go('tournaments')); await shot('torneios');
  await page.evaluate(() => go('goals')); await shot('objetivos');

  /* Definições */
  step('Definições');
  await page.evaluate(() => go('settings'));
  await click('#aiTest'); await page.waitForSelector('#aiTestOut .group'); await shot('definicoes');
  const [dl] = await Promise.all([page.waitForEvent('download'), click('button:has-text("Exportar")')]);
  const exported = await readFile(await dl.path(), 'utf8');
  if (/sk-ant/.test(exported)) problems.push('A cópia exportada contém a chave da API');
  await page.evaluate(() => { S.profile.name = 'Outra'; S.entries = []; saveProfile(); go('settings'); });
  await click('summary:has-text("Colar JSON")'); await page.fill('#impTxt', exported);
  await click('.inner button:has-text("Importar")'); await click('#yes');
  const after = await page.evaluate(() => ({ name: S.profile.name, entries: S.entries.length, view: S.view }));
  if (after.name !== 'Rita' || after.entries < 4 || after.view !== 'home') problems.push('Importação falhou: ' + JSON.stringify(after));
  step(`  importação: ${JSON.stringify(after)}`);

  /* Sem chave: tudo funciona e as funções de IA levam às Definições */
  step('Sem chave');
  await page.evaluate(() => { localStorage.setItem('pap_ai', JSON.stringify({ key: '' })); go('coach'); });
  await shot('coach-sem-chave');

  /* Pedidos à API */
  const h = calls[0]?.headers || {};
  if (h['anthropic-dangerous-direct-browser-access'] !== 'true' || h['anthropic-version'] !== '2023-06-01' || !h['x-api-key']) problems.push('Headers da API em falta');
  if (calls.some(c => 'temperature' in c.body)) problems.push('Pedido com temperature');
  if (calls.some(c => c.body.messages?.some(m => m.role === 'system'))) problems.push('system enviado como mensagem');
  step(`  ${calls.length} pedidos à API simulada (${calls.filter(c => c.body.stream).length} em streaming)`);
} catch (e) {
  problems.push('Falhou: ' + e.message.split('\n')[0]);
  await page.screenshot({ path: join(OUT, 'zz-falha.png'), fullPage: true }).catch(() => {});
}

await browser.close(); server.close();
const errs = [...new Set(errors)];
console.log(`\nErros na consola: ${errs.length}`); errs.forEach(e => console.log('  ' + e));
console.log(`Problemas: ${problems.length}`); problems.forEach(p => console.log('  ' + p));
process.exit(errs.length || problems.length ? 1 : 0);
