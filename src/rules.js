/* Ponto a Ponto — coach de regras (grátis, offline, sem IA)
   Gera as mesmas estruturas JSON que o coach de IA, a partir dos dados do jogador,
   do conteúdo da app e da biblioteca científica. Ajusta-se a palavras-chave nas respostas. */
import { S, PK, PN, ofType, pillarScores, mentalIndex, activeDays, daysUntil, TODAY, trainingInfo, winLoss } from './core.js';
import { LESSONS, PILLAR_TRAINING } from './content.js';
import { SCIENCE } from './science.js';

const study = p => SCIENCE.find(s => s.p === p)?.id || '';
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const pick = (arr, seed = Date.now()) => arr[Math.abs(Math.floor(seed / 864e5)) % arr.length];
const cues = () => { const c = (S.profile.cues || []).filter(Boolean); return [...c, 'Respira', 'Pés', 'Agressivo'].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3); };
const weakest = (exclude = []) => { const sc = pillarScores(); return PK.filter(k => !exclude.includes(k)).sort((a, b) => (sc[a] ?? 6) - (sc[b] ?? 6))[0]; };
const has = (text, ...words) => words.some(w => text.includes(w));
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Frases por competência: o porquê e o foco curto. */
const WHY = {
  confianca: 'A confiança constrói-se com provas: hoje juntamos mais uma.',
  foco: 'O foco treina-se a voltar ao presente, ponto a ponto.',
  emocoes: 'Controlar a ativação é o que te deixa jogar o teu ténis quando aquece.',
  reset: 'O que fazes nos 10 segundos depois do erro decide o ponto seguinte.',
  pressao: 'Os pontos importantes jogam-se de outra maneira, e isso treina-se.',
  rotinas: 'Uma rotina estável segura o teu nível quando a pressão sobe.',
  corpo: 'O adversário lê a tua linguagem corporal entre pontos.',
  dialogo: 'O que dizes a ti próprio muda o ponto seguinte.',
};
const FOCUS = {
  confianca: 'Jogar a minha pancada forte sem hesitar', foco: 'Um ponto de cada vez', emocoes: 'Expirar longo antes de servir',
  reset: 'Largar, corrigir, comprometer', pressao: 'Rotina completa nos pontos grandes', rotinas: 'A mesma rotina em todos os pontos',
  corpo: 'Cabeça levantada depois de cada erro', dialogo: 'Falar comigo como um treinador',
};

/* ===== plano do dia ===== */
export function brief(d, flags = {}) {
  const md = flags.jogo ?? d.plan.matchDay;
  const p = flags.pilar || d.plan.pillar, lesson = LESSONS.find(l => l.id === d.plan.lesson) || LESSONS.find(l => l.p === p);
  const tr = trainingInfo(PILLAR_TRAINING[p]);
  let titulo = md ? 'Dia de jogo: rotina e plano A' : `Hoje: ${PN[p].toLowerCase()}`;
  let texto = md
    ? 'Hoje o objetivo não é treinar, é competir bem. Faz o cartão de jogo, aquece com a rotina completa e joga com objetivos de processo, não de resultado.'
    : `${WHY[p]} Escolhi esta competência porque é a que está mais baixa nos teus dados.`;
  let acao = md ? 'Antes de entrares em campo: 2 minutos de suspiro fisiológico e diz em voz baixa as tuas 3 palavras-chave.' : cap((lesson?.drill || 'Faz o loop de hoje.').replace(/^(hoje|no treino de hoje),?\s*/i, ''));
  if (flags.cansado) { titulo = 'Dia leve: recupera e mantém o hábito'; texto = 'Cansaço conta. Hoje fazemos o mínimo que mantém a série: check-in e uma sessão curta. Descansar também é treino.'; acao = 'Faz só o check-in e o suspiro fisiológico (1 minuto).'; }
  if (flags.curto) { acao = `Só 10 minutos: ${tr.n} (${tr.min} min) e o desafio no court no próximo treino.`; texto = `${WHY[p]} Com pouco tempo, vamos ao essencial.`; }
  return { titulo, texto, acao, pilar: p, dia_de_jogo: !!md, estudo: study(p), sugestoes: md ? ['Estou nervoso', 'Só tenho 10 minutos', 'Outra competência'] : ['Hoje tenho jogo', 'Estou cansado', 'Só tenho 10 minutos', 'Outra competência'] };
}
export function adjustBrief(cur, text, d) {
  const t = norm(text), f = { ...(cur._f || {}) };
  let resposta = '';
  if (has(t, 'tenho jogo', 'jogo hoje', 'vou jogar', 'competir')) { f.jogo = true; resposta = 'Mudei o dia para modo jogo: o loop passa a preparar-te para competir.'; }
  else if (has(t, 'nao tenho jogo', 'sem jogo', 'treino hoje')) { f.jogo = false; resposta = 'Voltámos ao modo treino.'; }
  else if (has(t, 'cansad', 'sem energia', 'dormi mal', 'exausto')) { f.cansado = true; resposta = 'Ajustei para um dia leve. Manter o hábito vale mais do que forçar.'; }
  else if (has(t, '10 minutos', 'pouco tempo', 'sem tempo', 'rapido')) { f.curto = true; resposta = 'Reduzi o dia ao essencial.'; }
  else if (has(t, 'nervos')) { f.pilar = 'emocoes'; resposta = 'Hoje treinamos o controlo dos nervos: respiração com expiração longa e reavaliação ("isto é energia").'; }
  else if (has(t, 'outra', 'diferente', 'ideia', 'mudar')) { f.pilar = weakest([cur.pilar]); resposta = `Troquei para ${PN[f.pilar].toLowerCase()}, a tua competência seguinte mais baixa.`; }
  else resposta = 'Anotei. Sem um modelo de IA ligado, consigo ajustar o dia a: jogo hoje, cansaço, pouco tempo, nervos ou outra competência.';
  return { ...brief(d, f), _f: f, resposta };
}

/* ===== cartão de jogo ===== */
const TACTICS = {
  'Defensivo': { a: 'Paciência com margem: bolas fundas e altas ao centro até teres a curta; aí entras com a {forte}.', p: 'Bola funda ao centro, à espera da curta' },
  'Muito consistente': { a: 'Não tentes ganhar o ponto cedo demais: constrói com profundidade e ataca só a bola curta. Ganhar-lhe exige mais uma bola, não mais risco.', p: 'Três bolas fundas e depois acelerar' },
  'Agressivo': { a: 'Tira-lhe tempo e ritmo: bolas altas e fundas, serviço ao corpo, e obriga-o a arriscar mais uma bola.', p: 'Serviço ao corpo e bola funda ao centro' },
  'Esquerda fraca': { a: 'Joga para a esquerda dele, sobretudo com bolas altas; abre-lhe a direita só para voltares à esquerda.', p: 'Bola alta para a esquerda dele' },
  'Direita forte': { a: 'Não lhe dês direitas no meio do court: serve e joga para a esquerda, e muda de direção só com bola cruzada funda.', p: 'Serviço para a esquerda e bola cruzada para a esquerda' },
  'Canhoto': { a: 'Contra um canhoto, a esquerda dele fica do lado oposto ao de um destro e o serviço dele abre para o outro lado: ajusta a posição na resposta e procura a esquerda dele.', p: 'Resposta e bola para a esquerda do canhoto' },
  'Bom serviço': { a: 'Na resposta ao 1.º serviço, um passo atrás e bola bloqueada funda ao centro; no 2.º serviço, entra e ataca.', p: 'Resposta funda ao centro no 1.º serviço' },
  'Serviço fraco': { a: 'Ataca o 2.º serviço: um passo dentro do court e resposta agressiva para a pancada mais fraca dele.', p: 'Atacar o 2.º serviço' },
  'Sobe à rede': { a: 'Quando ele subir, passa baixo aos pés e usa o balão; a primeira passagem não tem de ganhar o ponto.', p: 'Bola baixa aos pés e depois a passagem' },
  'Joga alto': { a: 'Não recues com as bolas altas: entra no court e apanha-as na subida, antes de chegarem ao ombro.', p: 'Entrar no court contra a bola alta' },
  'Rápido': { a: 'Joga para trás dele (contrapé) e varia alturas; não procures o ângulo impossível.', p: 'Contrapé depois de uma bola cruzada' },
};
const UNKNOWN = 'Nos primeiros 3 jogos faz de detetive: qual é a pancada mais fraca dele, onde serve sob pressão e como reage a bolas altas. Até lá, joga o teu jogo com margem.';
export function preCard(e, flags = {}) {
  const tags = [...(e.oppTags || []), ...(flags.canhoto && !(e.oppTags || []).includes('Canhoto') ? ['Canhoto'] : [])].filter(t => TACTICS[t]);
  const forte = (S.profile.strength || 'direita').toLowerCase();
  const tac = tags.map(t => TACTICS[t]);
  const plano_a = tac.length ? tac[0].a.replace('{forte}', forte) : UNKNOWN;
  let plano_b = tac[1] ? tac[1].a.replace('{forte}', forte) : 'Se o plano A não resultar em dois jogos seguidos: mais altura e profundidade, menos risco, e procura a rede depois de uma bola funda.';
  const padroes = [...tac.map(t => t.p), `Serviço e ${forte} para o espaço`].slice(0, 3);
  let se_correr_mal = 'Se perderes dois jogos seguidos com o plano A, muda para o plano B durante pelo menos três jogos antes de voltar a avaliar.';
  let primeiros_jogos = 'Serve com margem (primeiros serviços a 80%) e procura ritmo; não decidas o jogo nos primeiros pontos.';
  const n = +e.nerves || 5;
  let ativacao = n >= 7 ? 'Nervos altos: suspiro fisiológico (duas inspirações e uma expiração longa) antes de cada serviço e nas mudanças de lado. Diz "isto é energia para jogar".'
    : n <= 3 ? 'Pouca ativação: acelera os pés no aquecimento, salta no lugar entre pontos e usa a palavra-chave com energia.'
    : 'Ativação no ponto: mantém a respiração longa nas mudanças de lado e a rotina em todos os pontos.';
  const extra = [];
  if (flags.cansado) { plano_b = 'Com pouca energia: encurta os pontos com serviço e mais uma bola, e mais bolas ao centro para correres menos.'; extra.push('cansaço'); }
  if (flags.vento) { primeiros_jogos = 'Com vento: mais margem por cima da rede, lançamento de serviço mais baixo e menos ângulos; a favor do vento, mais efeito; contra, mais peso.'; extra.push('vento'); }
  if (flags.calor) { ativacao += ' Com calor: bebe em todas as mudanças de lado e usa a toalha para baixar o ritmo, sem pressa.'; extra.push('calor'); }
  if (flags.perdi) { se_correr_mal = 'Já perdeste com ele: muda pelo menos uma coisa desde o início (por exemplo, começa pelo plano B) e escreve no fim se funcionou.'; extra.push('já perdeste com ele'); }
  if (flags.nervos) { ativacao = 'Antes de entrar: 2 minutos de suspiro fisiológico. Entre pontos: expiração longa, olhar nas cordas, palavra-chave. Os nervos são o corpo a preparar-se.'; extra.push('nervos'); }
  const opp = e.opp ? ` contra ${e.opp}` : '';
  return {
    plano: tac.length ? `${cap(tac[0].p)}${opp}. ${tac[1] ? 'Se não resultar: ' + tac[1].p.toLowerCase() + '.' : 'Com margem e paciência.'}` : `Descobrir o adversário${opp} nos primeiros jogos e jogar o teu jogo com margem.`,
    plano_a, plano_b, padroes, chaves: cues(), primeiros_jogos, se_correr_mal,
    reset: 'Larga (vira-te para a rede e respira), corrige (uma instrução curta), compromete (alvo e palavra-chave).',
    ativacao,
    visualizacao: `Fecha os olhos e respira devagar três vezes. Vês-te a entrar no court${opp}. No primeiro jogo de serviço fazes a tua rotina e serves com margem. ${plano_a.split(':')[0].replace(/\.$/, '')}. Falhas uma bola fácil, viras-te para a rede, respiras e dizes "${cues()[0]}". Ganhas o ponto seguinte. Abre os olhos: estás pronto.`,
    estudo: n >= 7 ? 's_nervos' : 's_objetivos',
    sugestoes: ['Ele é canhoto', 'Estou cansado', 'Está muito vento', 'Já perdi com ele', 'Estou muito nervoso'].filter(s => !(s === 'Ele é canhoto' && tags.includes('Canhoto'))),
    _f: flags, _extra: extra,
  };
}
const PRE_KEYS = [['canhoto', ['canhot']], ['cansado', ['cansad', 'sem energia', 'dormi mal']], ['vento', ['vento']], ['calor', ['calor', 'quente', 'sol']], ['perdi', ['perdi', 'ja joguei', 'ganhou-me', 'ganhou me']], ['nervos', ['nervos', 'nervoso', 'ansios', 'tenso']]];
export function adjustPre(cur, text, e) {
  const t = norm(text), f = { ...(cur._f || {}) }, hit = PRE_KEYS.filter(([, ws]) => has(t, ...ws)).map(([k]) => k);
  hit.forEach(k => f[k] = true);
  const card = preCard(e, f);
  card.resposta = hit.length ? `Ajustei o plano para ${card._extra.length ? card._extra.join(', ') : 'o que disseste'}${hit.includes('canhoto') ? ' e para um adversário canhoto' : ''}.` : 'Anotei. Sem um modelo de IA ligado, consigo ajustar o cartão a: canhoto, cansaço, vento, calor, já ter perdido com ele ou nervos.';
  return card;
}

/* ===== análise do jogo ===== */
export function postAnalysis(e) {
  const sk = e.skills || {}, ks = PK.filter(k => +sk[k] > 0);
  const low = ks.slice().sort((a, b) => sk[a] - sk[b])[0] || weakest(), high = ks.slice().sort((a, b) => sk[b] - sk[a])[0];
  const won = e.result === 'vitória', tags = e.tags || [];
  const prev = ofType('post').filter(x => x.id !== e.id && x.skills).slice(0, 3);
  const repeat = prev.filter(x => PK.filter(k => +x.skills[k] > 0).sort((a, b) => x.skills[a] - x.skills[b])[0] === low).length;
  const lesson = LESSONS.find(l => l.p === low);
  const mi = mentalIndex(e);
  const tagLine = tags.length ? ` Marcaste: ${tags.join(', ').toLowerCase()}.` : '';
  return {
    resumo: `${won ? 'Vitória' : 'Derrota'} com índice mental ${mi ? mi.toFixed(1).replace('.', ',') : '–'}.${tagLine} A competência mais baixa neste jogo foi ${PN[low].toLowerCase()}${high && high !== low ? `, e a mais alta ${PN[high].toLowerCase()}` : ''}.`,
    padrao: repeat >= 1 ? `É a ${repeat + 1}.ª vez nos últimos jogos que ${PN[low].toLowerCase()} fica abaixo. É aqui que está o próximo salto.` : 'Ainda poucos dados para ver um padrão. Regista mais 2 ou 3 jogos.',
    ponto_forte: high ? `${PN[high]}: usa-a como âncora nos momentos difíceis.` : 'Terminaste o jogo, e isso já é material para aprender.',
    a_trabalhar: `${PN[low]}. ${lesson ? lesson.key : WHY[low]}`,
    exercicio: `${trainingInfo(PILLAR_TRAINING[low]).n} (${trainingInfo(PILLAR_TRAINING[low]).min} min) e, no próximo treino: ${lesson?.drill || 'o desafio do dia'}`,
    foco_proximo: FOCUS[low],
    estudo: study(low), memoria: [],
    sugestoes: ['Os nervos foram o problema', 'Ele jogou melhor', 'Perdi a concentração'],
  };
}
export function adjustPost(cur, text, e) {
  const t = norm(text);
  const map = [[['nervos', 'nervoso', 'ansios', 'tenso'], 'emocoes'], [['concentra', 'distra', 'foco'], 'foco'], [['irrit', 'raiva', 'erro'], 'reset'], [['servi', 'break', 'fechar', 'set'], 'pressao'], [['corpo', 'cabeca baixa', 'postura'], 'corpo'], [['critic', 'mau', 'disse'], 'dialogo']];
  const k = map.find(([ws]) => has(t, ...ws))?.[1];
  if (has(t, 'jogou melhor', 'mais forte', 'melhor do que eu')) return { ...cur, resposta: 'Acontece. Pergunta útil: o que ganhaste nos pontos que ganhaste? É isso que levas para o próximo jogo. Mantive o foco que tinhas.' };
  if (has(t, 'fisic', 'cansad')) return { ...cur, a_trabalhar: 'Gestão de energia: rotina curta entre pontos e respiração nas mudanças de lado poupam-te nos jogos longos.', exercicio: 'Suspiro fisiológico (1 min) e, no próximo treino, pontos com 20 segundos de rotina entre cada um.', resposta: 'Ajustei para a gestão de energia.' };
  if (!k) return { ...cur, resposta: 'Anotei. Sem um modelo de IA ligado, consigo reorientar a análise para: nervos, concentração, irritação com erros, pressão a servir, linguagem corporal ou diálogo interno.' };
  const lesson = LESSONS.find(l => l.p === k);
  return { ...cur, a_trabalhar: `${PN[k]}. ${lesson?.key || WHY[k]}`, exercicio: `${trainingInfo(PILLAR_TRAINING[k]).n} e, no próximo treino: ${lesson?.drill || ''}`, foco_proximo: FOCUS[k], estudo: study(k), resposta: `Reorientei a análise para ${PN[k].toLowerCase()}.` };
}

/* ===== reflexão de treino ===== */
export function practiceFeedback(e) {
  const q = +e.quality || 0, i = +e.intentDone || 0, low = e.skills ? PK.filter(k => +e.skills[k] > 0).sort((a, b) => e.skills[a] - e.skills[b])[0] : weakest();
  return {
    resumo: q >= 7 && i >= 7 ? 'Bom treino: qualidade e intenção alinhadas.' : i < q ? 'O treino teve qualidade, mas a intenção ficou pelo caminho. A intenção é o que transfere para o jogo.' : 'Treino difícil. Repara no que te tirou da intenção e escreve uma frase para o próximo.',
    a_trabalhar: PN[low] + '. ' + (LESSONS.find(l => l.p === low)?.key || ''),
    exercicio: LESSONS.find(l => l.p === low)?.drill || 'Repete a intenção de hoje no próximo treino.',
    foco_proximo: FOCUS[low], sugestoes: [],
  };
}

/* ===== plano do torneio ===== */
export function tournamentPlan(t) {
  const w1 = weakest(), w2 = weakest([w1]), surf = (t.surface || '').toLowerCase();
  return {
    foco_mental: FOCUS[w1],
    antes: ['Jogar 2 treinos com pontos a contar e pressão real', `Treinar ${PN[w1].toLowerCase()}: ${trainingInfo(PILLAR_TRAINING[w1]).n}`, surf.includes('terra') ? 'Pontos longos em terra: paciência e deslizes' : 'Treinar serviço e primeira bola, que contam mais em piso rápido', 'Definir 2 objetivos de processo para o torneio'],
    vespera: ['Saco pronto: raquetes encordoadas, garrafa, comida, toalha', 'Visualização de 5 minutos do primeiro jogo', 'Hora de deitar fixa e telemóvel fora do quarto'],
    dia_de_jogo: ['Chegar 60 min antes', 'Aquecimento físico de 15 min e 10 min de bolas', 'Rotina pré-jogo: 2 min de suspiro fisiológico e palavras-chave', 'Cartão de jogo lido 10 min antes de entrar'],
    entre_jogos: ['Comer nos primeiros 30 min depois do jogo', 'Hidratar e alongar 10 min', 'Escrever 1 coisa que funcionou e 1 a mudar', `Rever o foco: ${FOCUS[w2].toLowerCase()}`],
    depois_derrota: ['30 minutos para sentir, sem analisar', 'Escrever 3 aprendizagens concretas', 'Escolher uma para o próximo treino'],
    sugestoes: [],
  };
}

/* ===== passos de objetivos ===== */
export function goalSteps(g) {
  const base = g.kind === 'processo' ? ['Definir exatamente o que conta como cumprir', 'Praticar em todos os treinos durante 2 semanas', 'Registar no fim de cada jogo se cumpriste (sim/não)', 'Rever com o coach ao fim de 4 jogos']
    : g.kind === 'performance' ? ['Medir o valor atual em 2 jogos', 'Escolher o processo que mais influencia este número', 'Treinar esse processo 3 vezes por semana', 'Voltar a medir ao fim de 3 semanas']
    : ['Escolher 2 objetivos de processo que levam a este resultado', 'Marcar os torneios até ao prazo', 'Avaliar os processos depois de cada jogo, não o resultado'];
  return { passos: base };
}

/* ===== revisão semanal ===== */
export function weeklyReview() {
  const days = [...activeDays()].filter(k => daysUntil(k) >= -7).length, w1 = weakest(), [w, l] = winLoss();
  const week = ofType('post').filter(e => Date.now() - e.ts < 7 * 864e5);
  return {
    titulo: days >= 5 ? 'Semana consistente' : days >= 3 ? 'Semana a meio gás' : 'Semana para retomar o hábito',
    o_que_mudou: `Estiveste ativo em ${days} dos últimos 7 dias${week.length ? ` e jogaste ${week.length} ${week.length === 1 ? 'jogo' : 'jogos'}` : ''}. No total, levas ${w} vitórias e ${l} derrotas registadas.`,
    padroes: [`${PN[w1]} continua a ser a competência mais baixa`, days >= 4 ? 'A consistência do loop está a criar hábito' : 'Os dias sem registo quebram a evolução'],
    prioridade: `${PN[w1]}: ${WHY[w1]}`,
    plano: [`${trainingInfo(PILLAR_TRAINING[w1]).n} em 3 dias desta semana`, 'Check-in em todos os dias de treino', LESSONS.find(x => x.p === w1)?.drill || 'Fazer o desafio no court do dia'],
    foco_proximo: FOCUS[w1], memoria: [],
  };
}
