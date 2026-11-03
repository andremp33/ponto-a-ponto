/* Ponto a Ponto — app */
'use strict';
const P = window.PILLARS, PK = P.map(p=>p.k), PN = Object.fromEntries(P.map(p=>[p.k,p.n]));
const LESSONS = window.LESSONS, SESSIONS = window.SESSIONS;
const CHECK = [['energia','Energia'],['confianca','Confiança'],['foco','Foco'],['calma','Calma']];
const CH_MAP = {'Ficar nervoso no início dos jogos':'emocoes','Fechar sets e jogos':'pressao','Irritar-me com erros não forçados':'reset','Perder a concentração':'foco','Adversários que devolvem tudo':'foco','Pensar no resultado':'foco','Linguagem corporal negativa':'corpo','Perder vantagens':'pressao','Jogar contra quem tem ranking pior':'pressao','Duplas faltas sob pressão':'rotinas','Recuperar depois de perder um set':'reset','Batotas e bolas duvidosas':'emocoes'};
const LS = 'pap_v2';

const DEFAULT_PROFILE = {
  onboarded:false, name:'', level:'Clube', ranking:'', years:'',
  style:[], strength:'Direita', surface:'Terra batida', hand:'Destro', backhand:'Duas mãos',
  extra:'', challenges:[], baseline:{}, seasonGoal:'', days:'4', duration:'10',
  cues:['Respira','Pés','Agressivo'], focusPillar:'', coachMemory:[], voice:true, reminder:'19:00'
};
const DEFAULT_STATE = { goals:[], tournaments:[], lessonsDone:{}, neuro:[], days:{}, insights:{}, reframes:[], sessionsLog:[], customSessions:[], reviews:[] };
const S = { profile:{...DEFAULT_PROFILE}, state:JSON.parse(JSON.stringify(DEFAULT_STATE)), entries:[], chat:[], view:'home', param:null, stack:[], mode:'local', ai:undefined, ob:null, obStep:0, trainTab:'hoje', libFilter:'' };
let DB=null, UID=null, SAMPLE=null, DOWNLOADS=null;

/* ===== utils ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const J = v => esc(JSON.stringify(v));
const dayKey = d => { d=new Date(d); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const TODAY = () => dayKey(Date.now());
const fmtDate = ts => new Date(ts).toLocaleDateString('pt-PT',{weekday:'short',day:'numeric',month:'short'});
const shortDate = ts => new Date(ts).toLocaleDateString('pt-PT',{day:'numeric',month:'short'});
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const clone = o => JSON.parse(JSON.stringify(o));
const daysUntil = d => Math.round((new Date(d+'T12:00').getTime() - new Date(TODAY()+'T12:00').getTime())/864e5);
function toast(m,ms=2600){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms);}
function withTimeout(p,ms){return Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),ms))]);}
const spin = t => `<span class="spin"></span> ${t}`;

/* ===== storage ===== */
function cacheLocal(){ try{ localStorage.setItem(LS, JSON.stringify({profile:S.profile,state:S.state,entries:S.entries,chat:S.chat})); }catch(e){} }
function loadLocal(){ try{ const d=JSON.parse(localStorage.getItem(LS)||'null'); if(d){ S.profile={...DEFAULT_PROFILE,...d.profile}; S.state={...clone(DEFAULT_STATE),...d.state}; S.entries=d.entries||[]; S.chat=d.chat||[]; } }catch(e){} }
const queues={}, timers={};
function enqueue(key,fn){ queues[key]=(queues[key]||Promise.resolve()).then(fn).catch(e=>{ console.warn(e); if(e&&e.code==='quota_exceeded') toast('Espaço cheio na sincronização.'); else toast('Não consegui sincronizar — ficou guardado neste dispositivo.'); }); return queues[key]; }
function debounced(key,fn,ms=600){ clearTimeout(timers[key]); timers[key]=setTimeout(()=>enqueue(key,fn),ms); }
const profileRef = () => DB.doc('data/users/'+UID+'/profile');
const stateRef = () => DB.doc('data/users/'+UID+'/state');
const chatRef = () => DB.doc('data/users/'+UID+'/chat');
const entriesCol = () => profileRef().collection('entries');
function setSync(){ $('#sync').textContent = S.mode==='cloud' ? 'sincronizado na tua conta' : 'guardado neste dispositivo'; }
function trimState(){
  const st=S.state; st.neuro=st.neuro.slice(-200); st.sessionsLog=st.sessionsLog.slice(-300); st.customSessions=st.customSessions.slice(-10); st.reviews=st.reviews.slice(-12);
  const dk=Object.keys(st.days).sort(); if(dk.length>150) dk.slice(0,dk.length-150).forEach(k=>delete st.days[k]);
  const ik=Object.keys(st.insights).sort(); if(ik.length>14) ik.slice(0,ik.length-14).forEach(k=>delete st.insights[k]);
}
function saveState(){ trimState(); cacheLocal(); if(S.mode==='cloud') debounced('state',()=>stateRef().set(clone(S.state))); }
function saveProfile(){ cacheLocal(); if(S.mode==='cloud') debounced('profile',()=>profileRef().set(clone(S.profile))); }
function saveChat(){ S.chat=S.chat.slice(-40); cacheLocal(); if(S.mode==='cloud') debounced('chat',()=>chatRef().set({messages:clone(S.chat)})); }
function saveEntry(e){
  const i=S.entries.findIndex(x=>x.id===e.id); if(i>=0) S.entries[i]=e; else S.entries.unshift(e);
  S.entries.sort((a,b)=>b.ts-a.ts); cacheLocal();
  if(S.mode==='cloud') enqueue('e'+e.id,()=>entriesCol().doc(e.id).set(clone(e)));
}
function deleteEntry(id){ S.entries=S.entries.filter(x=>x.id!==id); cacheLocal(); if(S.mode==='cloud') enqueue('e'+id,()=>entriesCol().doc(id).delete()); }

async function initStore(){
  loadLocal(); render();
  const c=window.claude;
  if(c && typeof c.use==='function'){
    c.use('sample').then(s=>{ SAMPLE=s; S.ai=!!s; render(); }).catch(()=>{ S.ai=false; render(); });
    c.use('downloads').then(d=>{ DOWNLOADS=d; }).catch(()=>{});
    try{
      const [db,user]=await Promise.all([c.use('db'),c.use('user')]);
      const id=user? await user.id() : null;
      if(db && id){
        DB=db; UID=id;
        const [p,st,es,ch]=await withTimeout(Promise.all([profileRef().get(),stateRef().get(),entriesCol().orderBy('ts','desc').limit(1000).get(),chatRef().get()]),10000);
        const cloudEntries=es.docs.map(d=>({...d.data(),id:d.id}));
        const cloudEmpty=!st.exists && !cloudEntries.length && !(p.exists && p.data().onboarded);
        S.mode='cloud';
        if(cloudEmpty && (S.profile.onboarded || S.entries.length)){
          await profileRef().set(clone(S.profile)); await stateRef().set(clone(S.state));
          for(const e of S.entries) await entriesCol().doc(e.id).set(clone(e));
          if(S.chat.length) await chatRef().set({messages:clone(S.chat)});
        } else {
          if(p.exists) S.profile={...DEFAULT_PROFILE,...p.data()};
          if(st.exists) S.state={...clone(DEFAULT_STATE),...st.data()};
          S.state=clone(S.state);
          S.entries=cloudEntries.map(e=>e.type==='post'&&e.kind==='treino'?{...e,type:'practice',what:'Treino',quality:'–',intentDone:'–'}:e); if(ch.exists) S.chat=(ch.data().messages||[]).slice();
          S.profile=clone(S.profile);
        }
        cacheLocal();
      }
    }catch(e){ console.warn('db',e); S.mode='local'; }
  } else S.ai=false;
  setSync(); render();
}

/* ===== engine ===== */
const ofType = (...t) => S.entries.filter(e=>t.includes(e.type));
const reflections = () => ofType('post','practice').filter(e=>e.skills);
function pillarScores(){
  const base=S.profile.baseline||{}, refl=reflections().slice(0,6), checks=ofType('checkin').slice(0,5), out={};
  PK.forEach(k=>{
    const r=avg(refl.map(e=>+e.skills[k]).filter(x=>x>0)); const n=refl.filter(e=>+e.skills[k]>0).length; const b=+base[k]||null;
    let v = r==null ? b : b==null ? r : b*(1-Math.min(n,5)/5*.8) + r*(Math.min(n,5)/5*.8);
    const ck = k==='confianca'?'confianca':k==='foco'?'foco':k==='emocoes'?'calma':null;
    if(ck && v!=null && checks.length){ const c=avg(checks.map(e=>+e[ck]).filter(Boolean)); if(c) v=v*.85+c*.15; }
    out[k]=v;
  });
  return out;
}
function mentalIndex(e){ const v=PK.map(k=>+e.skills?.[k]).filter(x=>x>0); return v.length? avg(v):null; }
function overallScore(){ const s=pillarScores(); const v=PK.map(k=>s[k]).filter(x=>x!=null); return v.length?avg(v):null; }
function choosePillar(exclude){
  if(S.profile.focusPillar) return S.profile.focusPillar;
  const sc=pillarScores(), bias={}; (S.profile.challenges||[]).forEach(c=>{ const k=CH_MAP[c]; if(k) bias[k]=(bias[k]||0)+.4; });
  const ranked=PK.map(k=>({k,v:(sc[k]??6)-(bias[k]||0)})).sort((a,b)=>a.v-b.v);
  if(exclude && ranked[0].k===exclude && ranked[1] && ranked[1].v-ranked[0].v<1) return ranked[1].k;
  return ranked[0].k;
}
function lastDone(id){ return S.state.lessonsDone[id]||0; }
function chooseLesson(pillar,matchDay){
  const pool = matchDay ? ['e3','pr3','ro3','pr1','f1','r3','pr2'].map(id=>LESSONS.find(l=>l.id===id)) : LESSONS.filter(l=>l.p===pillar);
  return pool.slice().sort((a,b)=>lastDone(a.id)-lastDone(b.id))[0].id;
}
function isMatchDay(){
  const t=TODAY(); const ci=ofType('checkin').find(e=>dayKey(e.ts)===t);
  if(ci && ci.plan==='jogo') return true;
  if(ofType('pre').some(e=>dayKey(e.ts)===t)) return true;
  return S.state.tournaments.some(x=>x.start && x.start<=t && (x.end||x.start)>=t);
}
function plan(force){
  const t=TODAY(); let d=S.state.days[t];
  const md=isMatchDay();
  if(!d || !d.plan || (force && !d.done?.lesson) || (d.plan.matchDay!==md && !d.done?.lesson && !d.done?.training)){
    const yk=dayKey(Date.now()-864e5), y=S.state.days[yk];
    const pillar=choosePillar(y?.plan?.pillar);
    const lesson=chooseLesson(pillar,md);
    const lp=LESSONS.find(l=>l.id===lesson).p;
    d={ plan:{pillar:md?lp:pillar, lesson, training: md?'vis_prejogo':window.PILLAR_TRAINING[pillar], matchDay:md}, done:{...(d?.done||{})} };
    S.state.days[t]=d; saveState();
  }
  return d;
}
function markDone(step){ const d=plan(); if(!d.done[step]){ d.done[step]=Date.now(); saveState(); } }
function loopStatus(){
  const d=plan(), t=TODAY();
  const ci=ofType('checkin').some(e=>dayKey(e.ts)===t);
  const refl=ofType('post','practice').some(e=>dayKey(e.ts)===t);
  return {checkin:ci, lesson:!!d.done.lesson, training:!!d.done.training, challenge:!!d.done.challenge, reflection:refl};
}
function activeDays(){ const s=new Set(S.entries.map(e=>dayKey(e.ts))); Object.entries(S.state.days).forEach(([k,d])=>{ if(d.done && Object.keys(d.done).length) s.add(k); }); return s; }
function streak(){ const days=activeDays(); let d=new Date(), n=0; if(!days.has(dayKey(d))) d.setDate(d.getDate()-1); while(days.has(dayKey(d))){ n++; d.setDate(d.getDate()-1); } return n; }
function currentFocus(){
  if(S.profile.weekFocus) return {text:S.profile.weekFocus,src:'definido por ti'};
  const r=S.state.reviews.slice(-1)[0]; if(r && Date.now()-r.ts<8*864e5 && r.foco_proximo) return {text:r.foco_proximo,src:'revisão semanal'};
  const last=ofType('post','practice').find(e=>e.ai?.foco_proximo); if(last) return {text:last.ai.foco_proximo,src:'sugerido pelo coach'};
  return null;
}
const upcomingTournament = () => S.state.tournaments.filter(t=>t.start && (t.end||t.start)>=TODAY()).sort((a,b)=>a.start.localeCompare(b.start))[0];

/* ===== AI ===== */
const PERSONA = `És um psicólogo do desporto especializado em ténis competitivo e és o coach mental pessoal deste jogador. Falas português de Portugal e tratas o jogador por "tu". És direto, caloroso e prático — sem frases feitas nem motivação vazia. Baseias-te em métodos com evidência: rotinas entre pontos (reagir, recuperar, preparar, ritual), reset após o erro (largar, corrigir, comprometer), objetivos de processo, palavras-chave, controlo da ativação pela respiração, reavaliação da ansiedade, diálogo interno instrucional, visualização, preparação tática com plano A/B. Quando ajuda, dás exemplos verídicos de jogadores profissionais, sem inventar citações nem factos. Ligas sempre o conselho aos dados concretos do jogador. És conciso e acionável: no máximo um ou dois exercícios de cada vez. Não dás conselhos médicos.`;
function profileText(){
  const p=S.profile;
  return `${p.name||'Jogador'}; nível: ${p.level}; ${p.ranking}; ${p.years} anos de ténis; ${p.hand}, esquerda a ${p.backhand}; estilo: ${(p.style||[]).join(', ')}; pancada mais forte: ${p.strength}; superfície preferida: ${p.surface}. ${p.extra||''}\nDesafios mentais que identificou: ${(p.challenges||[]).join('; ')||'-'}\nObjetivo da época: ${p.seasonGoal||'-'}\nTreina ${p.days} dias/semana; sessões mentais de ${p.duration} min.`;
}
function entryLine(e){
  const d=dayKey(e.ts);
  const sk=e.skills? ' Notas: '+PK.filter(k=>e.skills[k]).map(k=>`${PN[k]} ${e.skills[k]}`).join(', ')+'.':'';
  if(e.type==='checkin') return `${d} CHECK-IN (${e.plan||'-'}): ${CHECK.map(([k,l])=>l.toLowerCase()+' '+e[k]).join(', ')}${e.sleep?`, sono ${e.sleep}h`:''}${e.intent?`. Intenção: "${e.intent}"`:''}`;
  if(e.type==='pre') return `${d} PRÉ-JOGO vs ${e.opp||'?'} (${e.surface||'-'}${e.round?', '+e.round:''}; estilo: ${e.oppStyle||'-'}), nervos ${e.nerves}/10. Plano A: ${e.planA||'-'}. Plano B: ${e.planB||'-'}. Riscos: ${e.threats||'-'}`;
  if(e.type==='post') return `${d} JOGO vs ${e.opp||'?'} — ${e.result||''} ${e.score||''}${e.round?' ('+e.round+')':''}.${sk} Estatísticas: 1.º serv ${e.fs||'-'}%, duplas ${e.df||'-'}, BP ganhos ${e.bpw||'-'}/${e.bpt||'-'}. Bem: ${e.good||'-'}. Mal: ${e.bad||'-'}. Momento-chave: ${e.key||'-'}. Emoção: ${e.emotion||'-'}`;
  if(e.type==='practice') return `${d} TREINO (${e.what||'-'}): qualidade ${e.quality}/10, intenção cumprida ${e.intentDone||'-'}/10.${sk} Aprendi: ${e.learned||'-'}`;
  return '';
}
function context(n=12){
  const sc=pillarScores(), p=S.profile, f=currentFocus(), d=S.state.days[TODAY()], t=upcomingTournament();
  const goals=S.state.goals.filter(g=>!g.done).map(g=>`- [${g.area}] ${g.title} (${g.kind}${g.deadline?', até '+g.deadline:''}, ${g.progress||0}%)`).join('\n');
  return `PERFIL:\n${profileText()}\n\nPERFIL MENTAL ATUAL (1-10): ${PK.map(k=>`${PN[k]} ${sc[k]!=null?sc[k].toFixed(1):'-'}`).join('; ')}\nFoco atual: ${f?f.text:'-'}. Palavras-chave: ${(p.cues||[]).join(', ')}\n${d?`Plano de hoje: competência ${PN[d.plan.pillar]}${d.plan.matchDay?' (dia de jogo)':''}.`:''}\n${t?`Próximo torneio: ${t.name} (${t.start}, ${t.surface||''}). Objetivo: ${t.goal||'-'}`:''}\n\nOBJETIVOS ATIVOS:\n${goals||'-'}\n\nO QUE JÁ SABES DESTE JOGADOR (memória do coach):\n${(p.coachMemory||[]).map(m=>'- '+m.t).join('\n')||'-'}\n\nREGISTOS RECENTES (mais recente primeiro):\n${S.entries.slice(0,n).map(entryLine).join('\n')||'(sem registos)'}\n\nHoje é ${new Date().toLocaleDateString('pt-PT',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}.`;
}
function parseJSON(t){ const m=String(t).match(/\{[\s\S]*\}/); if(!m) throw new Error('sem JSON'); return JSON.parse(m[0]); }
async function askJSON(task,tier='default'){
  if(!SAMPLE) throw {code:'no_ai'};
  const prompt=`${PERSONA}\n\n${context()}\n\nTAREFA:\n${task}\n\nResponde APENAS com um objeto JSON válido, sem texto à volta, em português de Portugal.`;
  try{ if(typeof SAMPLE.json==='function') return await SAMPLE.json(prompt,{modelTier:tier}); }catch(e){ if(e && ['not_granted','rate_limited'].includes(e.code)) throw e; }
  const r=await SAMPLE(prompt,{modelTier:tier}); return parseJSON(r.text);
}
function aiErr(e){
  if(e?.code==='no_ai') return 'O coach de IA não está disponível nesta vista. Abre a app no claude.ai.';
  if(e?.code==='not_granted') return 'Não deste permissão ao coach de IA.';
  if(e?.code==='rate_limited') return 'Muitos pedidos seguidos — tenta daqui a um minuto.';
  return 'O coach não conseguiu responder. Tenta outra vez.';
}
function addMemory(list){
  if(!list) return; const arr=(Array.isArray(list)?list:[list]).map(s=>String(s).trim()).filter(Boolean);
  const mem=S.profile.coachMemory||[]; arr.forEach(t=>{ if(!mem.some(m=>m.t===t)) mem.push({t,ts:Date.now()}); });
  S.profile.coachMemory=mem.slice(-20); saveProfile();
}
async function aiBtn(btn,label,fn){
  const b=typeof btn==='string'?$(btn):btn; if(!b) return;
  const old=b.innerHTML; b.disabled=true; b.innerHTML=spin(label);
  try{ await fn(); }catch(e){ console.warn(e); toast(aiErr(e),4000); }
  if(document.body.contains(b)){ b.disabled=false; b.innerHTML=old; }
}
function aiBlocks(ai,map){ return map.filter(([k])=>ai && ai[k] && (!Array.isArray(ai[k])||ai[k].length)).map(([k,t])=>`<div class="ai-block"><div class="t">${t}</div>${Array.isArray(ai[k])?`<ul>${ai[k].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<div class="ai">${esc(ai[k])}</div>`}</div>`).join(''); }

/* ===== navegação ===== */
const TABS=[['home','◐','Hoje'],['train','◎','Treinar'],['add','+','Registar'],['coach','✦','Coach'],['me','◆','Eu']];
const ROOT={home:1,train:1,coach:1,me:1};
function go(v,param=null,{push=true}={}){
  stopPlayer();
  if(push && !ROOT[v]) S.stack.push([S.view,S.param]); else if(ROOT[v]) S.stack=[];
  S.view=v; S.param=param; render(); window.scrollTo(0,0);
}
function replace(v,param=null){ stopPlayer(); S.view=v; S.param=param; render(); window.scrollTo(0,0); }
function back(){ const p=S.stack.pop(); if(p){ S.view=p[0]; S.param=p[1]; } else S.view='home'; stopPlayer(); render(); window.scrollTo(0,0); }
const backBtn = (label='Voltar') => `<button class="back" onclick="back()">‹ ${label}</button>`;
function renderNav(){
  const show=S.profile.onboarded; $('#navwrap').style.display=show?'':'none';
  const tabOf={home:'home',train:'train',coach:'coach',me:'me',lesson:'train',session:'train',neuro:'train',reframe:'train',challenge:'home',checkin:'home',goals:'me',goal:'me',tournaments:'me',tournament:'me',progress:'me',history:'me',entry:'me',settings:'me',profile:'me'};
  const cur=tabOf[S.view]||'home';
  $('#nav').innerHTML=TABS.map(([v,i,l])=>`<button class="${v==='add'?'plus':''} ${cur===v?'on':''}" onclick="${v==='add'?'openAdd()':`go('${v}')`}"><span class="i">${i}</span>${l}</button>`).join('');
}
function openAdd(){
  sheet(`<div class="eyebrow">Registar</div>
    <button class="action" onclick="closeLayer();go('checkin')"><span class="ic">☀︎</span><b>Check-in diário</b><small>30 segundos: como chegas hoje</small></button>
    <button class="action" onclick="closeLayer();go('pre')"><span class="ic">⚑</span><b>Preparar jogo</b><small>Plano A/B e cartão de jogo</small></button>
    <button class="action" onclick="closeLayer();go('post')"><span class="ic">✎</span><b>Rever jogo</b><small>Resultado, estatísticas, mental e feedback</small></button>
    <button class="action" onclick="closeLayer();go('practice')"><span class="ic">◷</span><b>Reflexão de treino</b><small>Intenção vs. execução</small></button>
    <div class="grid2"><button class="action" onclick="closeLayer();go('goalEdit')"><span class="ic">◎</span><b>Objetivo</b></button><button class="action" onclick="closeLayer();go('tournamentEdit')"><span class="ic">🏆︎</span><b>Torneio</b></button></div>`);
}
function sheet(html){ $('#layer').innerHTML=`<div class="modal" onclick="if(event.target===this)closeLayer()"><div class="sheet">${html}</div></div>`; }
function closeLayer(){ $('#layer').innerHTML=''; }
function confirmBox(msg,onYes,yes='Apagar'){ sheet(`<h3 style="margin-bottom:14px">${esc(msg)}</h3><div class="grid2"><button class="btn ghost" onclick="closeLayer()">Cancelar</button><button class="btn" id="yes">${yes}</button></div>`); $('#yes').onclick=()=>{ closeLayer(); onYes(); }; }

/* ===== componentes de formulário ===== */
const slider=(name,label,val=5,sub='')=>`<div class="slider"><div class="lab"><span>${label}${sub?`<small>${sub}</small>`:''}</span><b id="v_${name}">${val}</b></div><input type="range" min="1" max="10" step="1" name="${name}" value="${val}" oninput="document.getElementById('v_${name}').textContent=this.value"></div>`;
const seg=(name,opts,val,cb='')=>`<div class="seg" data-name="${name}" data-cb="${cb}">${opts.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<button type="button" class="${v===val?'on':''}" data-v="${esc(v)}" onclick="segPick(this)">${esc(l)}</button>`;}).join('')}</div><input type="hidden" name="${name}" value="${esc(val)}">`;
function segPick(b){ const s=b.parentElement; s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); s.nextElementSibling.value=b.dataset.v; if(s.dataset.cb) window[s.dataset.cb](b.dataset.v); }
const chipset=(name,opts,vals=[])=>`<div class="chipset" data-name="${name}">${opts.map(o=>`<button type="button" class="${vals.includes(o)?'on':''}" onclick="this.classList.toggle('on')">${esc(o)}</button>`).join('')}</div>`;
const chipVals = name => [...document.querySelectorAll(`.chipset[data-name="${name}"] button.on`)].map(b=>b.textContent);
const formData = f => Object.fromEntries(new FormData(f).entries());
const pillarSliders=(vals={},prefix='')=>P.map(p=>slider(prefix+p.k,p.n,vals[p.k]||5,p.s)).join('');

/* ===== render ===== */
const VIEWS = {};
function render(){
  if(!S.profile.onboarded && S.view!=='onboarding'){ S.view='onboarding'; }
  renderNav();
  const fn=VIEWS[S.view]||VIEWS.home;
  $('#main').innerHTML=fn();
  if(VIEWS[S.view+'_after']) VIEWS[S.view+'_after']();
}

/* ===== ONBOARDING ===== */
const OB_STEPS=7;
VIEWS.onboarding=()=>{
  if(!S.ob) S.ob=clone(S.profile);
  const o=S.ob, st=S.obStep;
  const dots=`<div class="obdots">${Array.from({length:OB_STEPS},(_,i)=>`<i class="${i<=st?'on':''}"></i>`).join('')}</div>`;
  const nav=(next='Continuar')=>`<div class="grid2 mt">${st>0?`<button class="btn ghost" onclick="obBack()">Voltar</button>`:'<span></span>'}<button class="btn" onclick="obNext()">${next}</button></div>`;
  let body='';
  if(st===0) body=`<h1>O teu treino mental de ténis.</h1><p class="sec">Um programa diário que se adapta a ti: lições curtas, treino mental guiado, preparação e revisão de jogos, e um coach de IA que conhece o teu jogo.</p>
    <div class="card mt"><div class="li"><div class="num">1</div><div><b>Perfil mental</b><br><span class="muted small">Avalias 8 competências. O plano começa pelas mais fracas.</span></div></div>
    <div class="li"><div class="num">2</div><div><b>Loop diário</b><br><span class="muted small">Check-in, lição, treino mental, desafio no court, reflexão.</span></div></div>
    <div class="li"><div class="num">3</div><div><b>Jogos e torneios</b><br><span class="muted small">Preparação, revisão e um coach que aprende contigo.</span></div></div></div>
    <p class="muted small">Leva 3 minutos. Já preenchi o que sei do teu jogo — confirma ou corrige.</p>${nav('Começar')}`;
  if(st===1) body=`<h1>Quem és em campo</h1>
    <label class="f">Nome</label><input type="text" id="ob_name" value="${esc(o.name)}" placeholder="como queres que o coach te trate">
    <label class="f">Nível</label>${seg('ob_level',['Clube','Competição regional','Competição nacional','Internacional'],o.level)}
    <label class="f">Ranking / classificação</label><input type="text" id="ob_ranking" value="${esc(o.ranking)}">
    <div class="grid2"><div><label class="f">Anos de ténis</label><input type="number" id="ob_years" value="${esc(o.years)}"></div><div><label class="f">Mão</label>${seg('ob_hand',['Destro','Canhoto'],o.hand)}</div></div>
    <label class="f">Esquerda</label>${seg('ob_backhand',['Uma mão','Duas mãos'],o.backhand)}${nav()}`;
  if(st===2) body=`<h1>O teu jogo</h1>
    <label class="f">Estilo (escolhe vários)</label>${chipset('ob_style',['Agressivo','All-court','Contra-atacante','Defensivo','Serviço-rede','Consistente'],o.style)}
    <label class="f">Pancada mais forte</label>${seg('ob_strength',['Serviço','Direita','Esquerda','Rede'],o.strength)}
    <label class="f">Superfície preferida</label>${seg('ob_surface',['Terra batida','Rápido','Indoor'],o.surface)}
    <label class="f">Mais alguma coisa sobre o teu jogo?</label><textarea id="ob_extra">${esc(o.extra)}</textarea>${nav()}`;
  if(st===3) body=`<h1>Onde o mental te falha?</h1><p class="muted">Escolhe tudo o que se aplica. É o ponto de partida do teu plano.</p>${chipset('ob_ch',window.CHALLENGES,o.challenges)}${nav()}`;
  if(st===4) body=`<h1>Avaliação inicial</h1><p class="muted">Sê honesto: 1 = é o meu maior problema, 10 = sou muito forte nisto.</p>${P.map(p=>slider('ob_'+p.k,p.n,o.baseline?.[p.k]||5,p.s)).join('')}${nav()}`;
  if(st===5) body=`<h1>Objetivos e rotina</h1>
    <label class="f">Objetivo principal para esta época</label><textarea id="ob_goal" placeholder="ex.: entrar no top 200 nacional; ganhar mais jogos de 3 sets">${esc(o.seasonGoal)}</textarea>
    <label class="f">Dias de treino por semana</label>${seg('ob_days',['2','3','4','5','6'],o.days)}
    <label class="f">Tempo para o treino mental diário</label>${seg('ob_duration',[['5','5 min'],['10','10 min'],['15','15 min']],o.duration)}
    <label class="f">Palavras-chave (separadas por vírgulas)</label><input type="text" id="ob_cues" value="${esc((o.cues||[]).join(', '))}">${nav('Ver o meu perfil')}`;
  if(st===6){
    const b=o.baseline||{}, bias={}; (o.challenges||[]).forEach(c=>{const k=CH_MAP[c]; if(k) bias[k]=(bias[k]||0)+.4;}); const ranked=PK.slice().sort((a,c)=>((b[a]||5)-(bias[a]||0))-((b[c]||5)-(bias[c]||0)));
    body=`<h1>O teu perfil mental</h1><div class="card"><div class="chartwrap" id="obRadar"></div></div>
    <div class="card accent"><div class="eyebrow">O teu plano começa por</div><h2>${PN[ranked[0]]} e ${PN[ranked[1]]}</h2><p class="sec small">Todos os dias recebes uma lição, um treino mental e um desafio para o court, escolhidos pelas competências mais fracas. O plano ajusta-se com cada jogo e treino que registas.</p></div>
    ${nav('Começar o programa')}`;
  }
  return dots+body;
};
VIEWS.onboarding_after=()=>{ if(S.obStep===6) radar($('#obRadar'),[{name:'Inicial',values:S.ob.baseline,color:'var(--series-1)'}]); };
function obCollect(){
  const o=S.ob, v=id=>{const el=document.getElementById(id)||document.querySelector(`[name="${id}"]`); return el?el.value:undefined;};
  if(S.obStep===1){ o.name=v('ob_name').trim(); o.level=v('ob_level'); o.ranking=v('ob_ranking'); o.years=v('ob_years'); o.hand=v('ob_hand'); o.backhand=v('ob_backhand'); }
  if(S.obStep===2){ o.style=chipVals('ob_style'); o.strength=v('ob_strength'); o.surface=v('ob_surface'); o.extra=v('ob_extra'); }
  if(S.obStep===3){ o.challenges=chipVals('ob_ch'); }
  if(S.obStep===4){ o.baseline={}; PK.forEach(k=>o.baseline[k]=+v('ob_'+k)); }
  if(S.obStep===5){ o.seasonGoal=v('ob_goal').trim(); o.days=v('ob_days'); o.duration=v('ob_duration'); o.cues=v('ob_cues').split(',').map(s=>s.trim()).filter(Boolean).slice(0,5); }
}
function obBack(){ obCollect(); S.obStep=Math.max(0,S.obStep-1); render(); window.scrollTo(0,0); }
function obNext(){
  obCollect();
  if(S.obStep<OB_STEPS-1){ S.obStep++; render(); window.scrollTo(0,0); return; }
  const wasOnboarded=S.profile.onboarded;
  S.profile={...S.profile,...S.ob,onboarded:true}; S.profile.baselineTs=Date.now(); S.ob=null; S.obStep=0;
  if(S.profile.seasonGoal && !S.state.goals.some(g=>g.title===S.profile.seasonGoal)) S.state.goals.push({id:uid(),area:'ténis',kind:'resultado',title:S.profile.seasonGoal,deadline:'',progress:0,steps:[],why:'Objetivo da época',ts:Date.now()});
  saveProfile(); saveState(); S.view='home'; S.stack=[]; plan(true); render(); window.scrollTo(0,0);
  toast(wasOnboarded?'Perfil atualizado ✓':'Bem-vindo ao programa ✓');
  if(SAMPLE && !wasOnboarded){ askJSON(`O jogador acabou de fazer o onboarding. Escreve 3 a 5 notas curtas para a tua memória sobre ele (factos e hipóteses de trabalho a confirmar), com base no perfil e na avaliação inicial. Chave: "memoria" (array de strings, cada uma até 20 palavras).`,'quick').then(r=>addMemory(r.memoria)).catch(()=>{}); }
}

/* ===== HOJE ===== */
VIEWS.home=()=>{
  const h=new Date().getHours(), hello=h<6?'Boa noite':h<13?'Bom dia':h<20?'Boa tarde':'Boa noite';
  const d=plan(), ls=loopStatus(), lesson=LESSONS.find(l=>l.id===d.plan.lesson), tr=trainingInfo(d.plan.training);
  const steps=[
    ['checkin','Check-in','Como chegas hoje · 30 s',`go('checkin')`],
    ['lesson','Lição: '+lesson.t,`${PN[lesson.p]} · ${lesson.min} min`,`go('lesson','${lesson.id}')`],
    ['training','Treino mental: '+tr.n,`${tr.min} min`,`startTraining('${d.plan.training}')`],
    ['challenge','Desafio no court',lesson.drill,`go('challenge')`],
    ['reflection','Reflexão',d.plan.matchDay?'Rever o jogo de hoje':'Depois de treinar ou jogar',`go('${d.plan.matchDay?'post':'practice'}')`]
  ];
  const doneN=steps.filter(s=>ls[s[0]]).length, nextI=steps.findIndex(s=>!ls[s[0]]);
  const sc=pillarScores(), t=upcomingTournament(), f=currentFocus(), ins=S.state.insights[TODAY()];
  const activeGoal=S.state.goals.find(g=>!g.done);
  return `<h1>${hello}${S.profile.name?', '+esc(S.profile.name):''}.</h1>
  <div class="card accent mt"><div class="ringwrap">${ring(doneN/5)}<div style="flex:1"><div class="eyebrow">${d.plan.matchDay?'Dia de jogo':'Treino de hoje'}</div><h2>${esc(PN[d.plan.pillar])}</h2>
    <div class="muted small">${d.plan.matchDay?'Programa ajustado para competir hoje.':S.profile.focusPillar?'Escolheste treinar esta competência.':`A tua competência mais baixa agora${sc[d.plan.pillar]!=null?` (${sc[d.plan.pillar].toFixed(1)})`:''}.`}</div></div></div></div>
  <div class="loop mb">${steps.map(([k,t,s,fn],i)=>`<button class="step ${ls[k]?'done':''} ${i===nextI?'next':''}" onclick="${fn}"><span class="dot">${ls[k]?'✓':i+1}</span><span class="tx"><b>${esc(t)}</b><small>${esc(s)}</small></span><span class="go">›</span></button>`).join('')}</div>
  ${doneN===5?`<div class="card"><b>Loop completo hoje. 🎾</b><div class="muted small">${streak()} dias seguidos.</div></div>`:''}
  <div class="grid3 mb"><div class="stat"><b>${streak()}</b><span>dias seguidos</span></div><div class="stat"><b>${overallScore()?.toFixed(1)??'–'}</b><span>índice mental</span></div><div class="stat"><b>${winLoss()}</b><span>jogos V–D</span></div></div>
  ${t?`<div class="card tap" onclick="go('tournament','${t.id}')"><div class="row between"><div><div class="eyebrow">Próximo torneio</div><h3>${esc(t.name)}</h3><div class="muted small">${esc(t.surface||'')} ${t.place?'· '+esc(t.place):''}</div></div><div style="text-align:right"><b style="font:600 26px var(--head)">${Math.max(0,daysUntil(t.start))}</b><div class="muted small">${daysUntil(t.start)<=0?'a decorrer':'dias'}</div></div></div></div>`:''}
  <div class="card">${ins?`<div class="eyebrow">Insight do coach · hoje</div><h3>${esc(ins.titulo||'')}</h3><p class="sec">${esc(ins.texto||'')}</p>`:`<div class="row between"><div><div class="eyebrow">Insight do coach</div><div class="muted small">Uma ideia para hoje, a partir dos teus dados.</div></div><button class="btn small" id="insBtn" onclick="getInsight()" ${S.ai===false?'disabled':''}>Ver</button></div>`}</div>
  ${f?`<div class="card"><div class="eyebrow">Foco da semana · ${f.src}</div><h3>${esc(f.text)}</h3></div>`:''}
  ${(S.profile.cues||[]).length?`<div class="card"><div class="eyebrow">Palavras-chave</div><div class="cues">${S.profile.cues.map(c=>`<span class="cue">${esc(c)}</span>`).join('')}</div></div>`:''}
  ${activeGoal?`<div class="card tap" onclick="go('goal','${activeGoal.id}')"><div class="eyebrow">Objetivo · ${esc(activeGoal.area)}</div><b>${esc(activeGoal.title)}</b><div class="progress"><i style="width:${activeGoal.progress||0}%"></i></div></div>`:''}
  <div class="grid2"><button class="action" onclick="go('pre')"><span class="ic">⚑</span><b>Preparar jogo</b><small>Cartão de jogo</small></button><button class="action" onclick="startTraining('suspiro')"><span class="ic">≈</span><b>Acalmar já</b><small>1 min</small></button></div>`;
};
function winLoss(){ const g=ofType('post'); return g.filter(e=>e.result==='vitória').length+'–'+g.filter(e=>e.result==='derrota').length; }
function ring(p){ const r=26,c=2*Math.PI*r; return `<svg width="64" height="64" viewBox="0 0 64 64" aria-label="${Math.round(p*100)}%"><circle cx="32" cy="32" r="${r}" fill="none" stroke="#2f2f2c" stroke-width="6"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="#d95926" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c*p} ${c}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" fill="#f0efec" font-size="14" font-family="Space Grotesk,sans-serif" font-weight="600">${Math.round(p*5)}/5</text></svg>`; }
async function getInsight(){ await aiBtn('#insBtn','',async()=>{ const r=await askJSON(`Dá ao jogador um insight curto para hoje, ligado aos dados dele (padrões, competência do dia, próximo jogo ou torneio, objetivos). Chaves: "titulo" (até 8 palavras), "texto" (2-3 frases, termina com uma ação concreta para hoje).`,'quick'); S.state.insights[TODAY()]=r; saveState(); render(); }); }

/* ===== CHECK-IN ===== */
VIEWS.checkin=()=>`${backBtn()}<h1>Check-in</h1><p class="muted">Como chegas hoje?</p>
  <form onsubmit="submitCheckin(event)">${CHECK.map(([k,l])=>slider(k,l,6)).join('')}
  <label class="f">Horas de sono</label>${seg('sleep',['<6','6','7','8','9+'],'7')}
  <label class="f">Hoje é dia de</label>${seg('plan',[['treino','Treino'],['jogo','Jogo'],['descanso','Descanso']],isMatchDay()?'jogo':'treino')}
  <label class="f">Intenção para hoje (uma frase)</label><input type="text" name="intent" placeholder="ex.: atacar a 2.ª bola com a direita, sem pressa">
  <div style="height:16px"></div><button class="btn">Guardar check-in</button></form>`;
function submitCheckin(ev){ ev.preventDefault(); const d=formData(ev.target); const e={id:uid(),type:'checkin',ts:Date.now(),plan:d.plan,intent:d.intent.trim(),sleep:d.sleep}; CHECK.forEach(([k])=>e[k]=+d[k]); saveEntry(e); plan(); toast('Check-in guardado ✓'); go('home'); }

/* ===== LIÇÕES ===== */
VIEWS.lesson=()=>{
  const l=LESSONS.find(x=>x.id===S.param); if(!l) return VIEWS.home();
  const today=plan().plan.lesson===l.id, done=lastDone(l.id);
  return `${backBtn()}<div class="eyebrow">${esc(PN[l.p])} · ${l.min} min</div><h1>${esc(l.t)}</h1><p class="sec" style="font-size:16px">${esc(l.sum)}</p>
  <div class="card lesson">${l.body.map(p=>`<p>${esc(p)}</p>`).join('')}</div>
  <div class="card"><div class="eyebrow">No circuito</div><div class="quote">${esc(l.pro)}</div></div>
  <div class="card accent"><div class="eyebrow">Desafio no court</div><p style="margin:0">${esc(l.drill)}</p></div>
  <div class="card"><div class="eyebrow">Leva contigo</div><h2>${esc(l.key)}</h2></div>
  <button class="btn" onclick="finishLesson('${l.id}')">${done&&dayKey(done)===TODAY()?'Lida hoje ✓':'Marcar como lida'}</button>
  <button class="btn ghost mt" onclick="S.chatDraft=${J('Sobre a lição "'+l.t+'": como aplico isto ao meu jogo?')};go('coach')">Perguntar ao coach sobre isto</button>`;
};
function finishLesson(id){ S.state.lessonsDone[id]=Date.now(); if(plan().plan.lesson===id) markDone('lesson'); saveState(); toast('Lição concluída ✓'); back(); }
VIEWS.challenge=()=>{ const d=plan(), l=LESSONS.find(x=>x.id===d.plan.lesson);
  return `${backBtn()}<div class="eyebrow">Desafio no court · ${esc(PN[l.p])}</div><h1>Para o treino de hoje</h1>
  <div class="card accent"><p style="margin:0;font-size:16px">${esc(l.drill)}</p></div>
  <div class="card"><div class="eyebrow">Lembra-te</div><h3>${esc(l.key)}</h3></div>
  <label class="f">Como correu? (opcional)</label><textarea id="chNote">${esc(d.challengeNote||'')}</textarea><div style="height:12px"></div>
  <button class="btn" onclick="const d=plan();d.challengeNote=$('#chNote').value;markDone('challenge');saveState();toast('Desafio feito ✓');back()">${d.done.challenge?'Feito ✓ — guardar nota':'Fiz o desafio'}</button>`; };

/* ===== TREINAR ===== */
function trainingInfo(id){
  if(SESSIONS[id]) return SESSIONS[id];
  if(id==='neuro_schulte') return {n:'Grelha de foco',min:2,p:'foco',d:'Encontra os números de 1 a 25 por ordem, o mais rápido possível.'};
  if(id==='neuro_react') return {n:'Tempo de reação',min:1,p:'foco',d:'Toca no ecrã assim que mudar de cor.'};
  if(id==='reframe') return {n:'Do crítico ao treinador',min:4,p:'dialogo',d:'Transforma as tuas frases críticas em frases úteis.'};
  const c=S.state.customSessions.find(x=>x.id===id); if(c) return {n:c.n,min:Math.round(c.steps.reduce((a,s)=>a+s[0],0)/60)||3,p:'confianca',d:c.d||''};
  return {n:'Treino',min:3};
}
function startTraining(id){
  if(id==='neuro_schulte'||id==='neuro_react') return go('neuro',id);
  if(id==='reframe') return go('reframe');
  openPlayer(id);
}
VIEWS.train=()=>{
  const tab=S.trainTab, sc=pillarScores();
  const tabs=`<div class="chips">${[['hoje','Sessões'],['lib','Biblioteca'],['neuro','Neuro'],['ai','Personalizado']].map(([k,l])=>`<button class="${tab===k?'on':''}" onclick="S.trainTab='${k}';render()">${l}</button>`).join('')}</div>`;
  let body='';
  if(tab==='hoje'){
    body=`<p class="muted">Treino mental guiado com voz. Usa auriculares.</p>`+Object.entries(SESSIONS).map(([id,s])=>`<button class="action mb" onclick="startTraining('${id}')"><div class="row between"><b>${esc(s.n)}</b><span class="pill">${s.min} min</span></div><small>${esc(PN[s.p])} · ${esc(s.d)}</small></button>`).join('')
      +`<button class="action mb" onclick="go('reframe')"><div class="row between"><b>Do crítico ao treinador</b><span class="pill">4 min</span></div><small>Diálogo interno · reescreve as tuas frases críticas</small></button>`;
  }
  if(tab==='lib'){
    const f=S.libFilter; const list=LESSONS.filter(l=>!f||l.p===f);
    body=`<div class="chips"><button class="${!f?'on':''}" onclick="S.libFilter='';render()">Todas</button>${P.map(p=>`<button class="${f===p.k?'on':''}" onclick="S.libFilter='${p.k}';render()">${p.n}</button>`).join('')}</div>
    <p class="muted small">${Object.keys(S.state.lessonsDone).length} de ${LESSONS.length} lições lidas</p>
    ${list.map(l=>`<div class="card tap" onclick="go('lesson','${l.id}')"><div class="row between"><div class="eyebrow" style="margin:0">${esc(PN[l.p])} · ${l.min} min</div>${lastDone(l.id)?'<span class="pill win">lida</span>':''}</div><h3 style="margin-top:4px">${esc(l.t)}</h3><div class="muted small">${esc(l.sum)}</div></div>`).join('')}`;
  }
  if(tab==='neuro'){
    const best=t=>{const r=S.state.neuro.filter(x=>x.t===t).map(x=>x.ms);return r.length?Math.min(...r):null;};
    const last=t=>{const r=S.state.neuro.filter(x=>x.t===t);return r.length?r[r.length-1].ms:null;};
    body=`<p class="muted">Exercícios curtos de atenção e reação. Faz 2-3 vezes por semana e vê a evolução.</p>
    <button class="action mb" onclick="go('neuro','neuro_schulte')"><div class="row between"><b>Grelha de foco (Schulte)</b><span class="pill">2 min</span></div><small>Encontra 1→25 por ordem. Treina a atenção seletiva e a calma sob pressa.</small><small>${best('schulte')?`Melhor: ${(best('schulte')/1000).toFixed(1)} s · último: ${(last('schulte')/1000).toFixed(1)} s`:'Ainda sem resultados'}</small></button>
    <button class="action mb" onclick="go('neuro','neuro_react')"><div class="row between"><b>Tempo de reação</b><span class="pill">1 min</span></div><small>5 tentativas. Treina a prontidão — como na resposta ao serviço.</small><small>${best('react')?`Melhor média: ${best('react')} ms · última: ${last('react')} ms`:'Ainda sem resultados'}</small></button>
    <div class="card"><div class="eyebrow">Respiração</div><div class="grid2"><button class="btn ghost small" onclick="startTraining('respiracao_box')">Box 4-4-4-4</button><button class="btn ghost small" onclick="startTraining('suspiro')">Suspiro fisiológico</button></div></div>`;
  }
  if(tab==='ai'){
    const pre=ofType('pre')[0], t=upcomingTournament();
    body=`<p class="muted">O coach cria sessões de visualização à tua medida, com base no teu perfil e nos teus próximos jogos.</p>
    <div class="card"><label class="f" style="margin-top:0">Para quê?</label>${seg('visFor',[['jogo','Próximo jogo'],['torneio','Torneio'],['situacao','Uma situação']],'jogo')}
    <label class="f">Detalhes (opcional)</label><textarea id="visDetail" placeholder="${esc(pre?'vs '+(pre.opp||'')+' — '+(pre.planA||''):t?t.name:'ex.: fechar o set a servir, adversário que me irrita')}"></textarea><div style="height:10px"></div>
    <button class="btn" id="visBtn" onclick="makeVis()" ${S.ai===false?'disabled':''}>Criar visualização</button></div>
    ${S.state.customSessions.slice().reverse().map(c=>`<button class="action mb" onclick="openPlayer('${c.id}')"><div class="row between"><b>${esc(c.n)}</b><span class="pill clay">IA</span></div><small>${shortDate(c.ts)} · ${esc(c.d||'')}</small></button>`).join('')}`;
  }
  const weak=PK.slice().sort((a,b)=>(sc[a]??6)-(sc[b]??6))[0];
  return `<h1 class="mb">Treinar</h1>${tabs}${tab==='hoje'?`<div class="card accent tap" onclick="startTraining(window.PILLAR_TRAINING['${weak}'])"><div class="eyebrow">Recomendado para ti</div><b>${esc(trainingInfo(window.PILLAR_TRAINING[weak]).n)}</b><div class="muted small">Para ${esc(PN[weak])}, a tua competência mais baixa.</div></div>`:''}${body}`;
};
async function makeVis(){
  const kind=document.querySelector('[name=visFor]').value, det=$('#visDetail').value.trim(), pre=ofType('pre')[0], t=upcomingTournament();
  const about = kind==='jogo' ? `o próximo jogo${pre?': '+entryLine(pre):''}` : kind==='torneio' ? `o torneio${t?' '+t.name+' ('+(t.surface||'')+'), objetivo '+(t.goal||'-'):''}` : 'uma situação específica';
  await aiBtn('#visBtn','A criar…',async()=>{
    const r=await askJSON(`Cria um guião de visualização guiada (voz, 2.ª pessoa) para ${about}. ${det?'Detalhes do jogador: '+det+'.':''} Usa o estilo de jogo, a pancada mais forte e as palavras-chave do jogador. Inclui um momento de erro e reset, e um ponto importante. Chaves: "titulo" (até 6 palavras), "descricao" (1 frase), "passos" (array de 8 a 10 objetos {"texto": frase(s) curtas para ler em voz alta, "segundos": 8-16}).`);
    const steps=(r.passos||[]).map(p=>[Math.max(6,Math.min(20,+p.segundos||10)),String(p.texto||'')]).filter(s=>s[1]);
    if(!steps.length) throw new Error('vazio');
    const c={id:'c_'+uid(),n:r.titulo||'Visualização',d:r.descricao||'',steps,ts:Date.now()}; S.state.customSessions.push(c); saveState(); openPlayer(c.id);
  });
}

/* ===== PLAYER (voz) ===== */
let PL=null;
function pickVoice(){ try{ const v=speechSynthesis.getVoices(); return v.find(x=>/pt[-_]PT/i.test(x.lang))||v.find(x=>/^pt/i.test(x.lang))||null; }catch(e){ return null; } }
function speak(t){ if(!S.profile.voice||!('speechSynthesis' in window)) return; try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t); u.lang='pt-PT'; const v=pickVoice(); if(v) u.voice=v; u.rate=.92; speechSynthesis.speak(u); }catch(e){} }
function openPlayer(id,obj){
  const s=obj||SESSIONS[id]||S.state.customSessions.find(x=>x.id===id); if(!s) return;
  const breath=s.kind==='breath';
  let steps; if(breath){ steps=[[6,s.intro]]; for(let c=0;c<s.cycles;c++) s.pattern.forEach(p=>steps.push([p[1],p[0],p[2]])); steps.push([5,'Muito bem. Repara como te sentes agora.']); }
  else steps=s.steps.map(x=>[x[0],x[1]]);
  const total=steps.reduce((a,x)=>a+x[0],0);
  $('#layer').innerHTML=`<div class="player"><div class="row between"><button class="back" onclick="stopPlayer()">✕ Fechar</button><button class="btn ghost small" id="vbtn" onclick="S.profile.voice=!S.profile.voice;saveProfile();this.textContent=S.profile.voice?'🔊 Voz':'🔇 Sem voz';if(!S.profile.voice)try{speechSynthesis.cancel()}catch(e){}">${S.profile.voice?'🔊 Voz':'🔇 Sem voz'}</button></div>
  <div class="eyebrow mt">${esc(s.n)}</div><div class="pbar"><i id="pb"></i></div>
  <div class="stage">${breath?`<div class="circle" id="circ">Pronto</div>`:''}<div class="txt" id="ptxt">${breath?'':'Toca em começar quando estiveres pronto.'}</div><div class="muted small" id="pcount"></div></div>
  <div class="grid2"><button class="btn ghost" id="pskip" onclick="plSkip()">Saltar ›</button><button class="btn" id="pplay" onclick="plToggle()">Começar</button></div></div>`;
  PL={id,steps,i:-1,total,elapsed:0,paused:true,t:null,breath,tmp:!!obj,name:s.n};
}
function plRun(){
  if(!PL||PL.paused) return; PL.i++;
  if(PL.i>=PL.steps.length) return plFinish();
  const [sec,txt,ph]=PL.steps[PL.i];
  if(PL.breath){ const c=$('#circ'); if(c){ c.textContent=txt; c.style.transition=`transform ${sec}s ease-in-out`; c.style.transform= ph==='in'?'scale(1)':ph==='out'?'scale(.6)':c.style.transform||'scale(.6)'; } if(PL.i===0||PL.i===PL.steps.length-1) { $('#ptxt').textContent=txt; speak(txt);} else { $('#ptxt').textContent=''; speak(txt); }
    const cyc=Math.floor((PL.i-1)/SESSIONS[PL.id].pattern.length)+1; if(PL.i>0&&PL.i<PL.steps.length-1) $('#pcount').textContent=`Ciclo ${cyc} de ${SESSIONS[PL.id].cycles}`; }
  else { $('#ptxt').textContent=txt; speak(txt); $('#pcount').textContent=`${PL.i+1} / ${PL.steps.length}`; }
  PL.elapsed+=sec; $('#pb').style.width=Math.min(100,PL.elapsed/PL.total*100)+'%';
  PL.t=setTimeout(plRun,sec*1000);
}
function plToggle(){ if(!PL) return; PL.paused=!PL.paused; $('#pplay').textContent=PL.paused?'Continuar':'Pausa'; if(PL.paused){ clearTimeout(PL.t); try{speechSynthesis.cancel()}catch(e){} } else { if(PL.i>=0) PL.i--; plRun(); } }
function plSkip(){ if(!PL) return; clearTimeout(PL.t); if(PL.paused){ PL.paused=false; $('#pplay').textContent='Pausa'; } plRun(); }
function plFinish(){
  const id=PL.id, tmp=PL.tmp, name=PL.name; clearTimeout(PL.t); PL=null;
  S.state.sessionsLog.push({id,ts:Date.now()}); const d=plan(); if(d.plan.training===id || (!d.done.training && id!=='suspiro' && !tmp)) markDone('training'); saveState();
  $('#layer').innerHTML=`<div class="player"><div class="stage"><div style="font-size:48px">✓</div><h1>Sessão concluída</h1><p class="muted">${esc(name)}</p></div><button class="btn" onclick="closeLayer();render()">Fechar</button></div>`;
  speak('Sessão concluída. Bom trabalho.');
}
function stopPlayer(){ if(PL){ clearTimeout(PL.t); PL=null; } try{speechSynthesis.cancel()}catch(e){} if($('.player')) closeLayer(); }

/* ===== NEURO ===== */
let NZ=null, NZIV=null;
VIEWS.neuro=()=>{
  const id=S.param, info=trainingInfo(id);
  const hist=S.state.neuro.filter(x=>x.t===(id==='neuro_schulte'?'schulte':'react')).slice(-8);
  const unit=id==='neuro_schulte'?(v=>(v/1000).toFixed(1)+' s'):(v=>v+' ms');
  return `${backBtn()}<h1>${esc(info.n)}</h1><p class="muted">${esc(info.d)}</p>
  ${id==='neuro_schulte'?`<div class="row between"><b id="nzNext">Próximo: 1</b><b id="nzTime">0.0 s</b></div><div class="schulte" id="grid"></div><button class="btn" id="nzStart" onclick="schulteStart()">Começar</button>`
  :`<div class="react" id="rx" onpointerdown="reactTap()">Toca para começar</div><p class="muted small" id="rxInfo">5 tentativas. Espera pela cor laranja — tocar antes conta como falsa partida.</p>`}
  ${hist.length?`<div class="card mt"><div class="eyebrow">Últimos resultados</div>${hist.slice().reverse().map(x=>`<div class="row between small"><span class="muted">${fmtDate(x.ts)}</span><b>${unit(x.ms)}</b></div>`).join('')}</div>`:''}`;
};
VIEWS.neuro_after=()=>{ if(S.param==='neuro_schulte') drawSchulte(false); NZ=null; };
function drawSchulte(active){ const g=$('#grid'); if(!g) return; const nums=Array.from({length:25},(_,i)=>i+1); for(let i=nums.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[nums[i],nums[j]]=[nums[j],nums[i]];} g.innerHTML=nums.map(n=>`<button ${active?'':'disabled'} onclick="schulteTap(this,${n})">${active?n:'·'}</button>`).join(''); }
function schulteStart(){ drawSchulte(true); NZ={next:1,t0:performance.now()}; $('#nzStart').style.display='none'; clearInterval(NZIV); NZIV=setInterval(()=>{ const el=$('#nzTime'); if(!el||!NZ||NZ.next==null){ clearInterval(NZIV); return;} el.textContent=((performance.now()-NZ.t0)/1000).toFixed(1)+' s'; },100); }
function schulteTap(b,n){ if(!NZ) return; if(n===NZ.next){ b.classList.add('ok'); NZ.next++; $('#nzNext').textContent='Próximo: '+Math.min(NZ.next,25); if(NZ.next>25){ const ms=Math.round(performance.now()-NZ.t0); clearInterval(NZIV); NZ=null; S.state.neuro.push({t:'schulte',ms,ts:Date.now()}); if(plan().plan.training==='neuro_schulte') markDone('training'); saveState(); toast(`Feito em ${(ms/1000).toFixed(1)} s ✓`); setTimeout(render,900); } } else { b.classList.add('bad'); setTimeout(()=>b.classList.remove('bad'),250); } }
function reactTap(){
  const el=$('#rx'); if(!el) return;
  if(!NZ){ NZ={times:[],state:'wait'}; return reactArm(); }
  if(NZ.state==='wait'){ clearTimeout(NZ.to); el.classList.remove('go'); el.textContent='Cedo demais! Toca para repetir'; NZ.state='false'; return; }
  if(NZ.state==='false'){ return reactArm(); }
  if(NZ.state==='go'){ const ms=Math.round(performance.now()-NZ.t0); NZ.times.push(ms); el.classList.remove('go');
    if(NZ.times.length>=5){ const a=Math.round(avg(NZ.times)); el.textContent=`Média: ${a} ms`; S.state.neuro.push({t:'react',ms:a,ts:Date.now()}); if(plan().plan.training==='neuro_react') markDone('training'); saveState(); NZ=null; setTimeout(render,1400); return; }
    el.textContent=`${ms} ms — toca para a próxima (${NZ.times.length}/5)`; NZ.state='between'; return; }
  if(NZ.state==='between') return reactArm();
}
function reactArm(){ const el=$('#rx'); NZ.state='wait'; el.textContent='Espera…'; el.classList.remove('go'); NZ.to=setTimeout(()=>{ if(!NZ||!$('#rx')) return; NZ.state='go'; NZ.t0=performance.now(); el.classList.add('go'); el.textContent='TOCA!'; },1200+Math.random()*2600); }

/* ===== REFRAME ===== */
VIEWS.reframe=()=>`${backBtn()}<div class="eyebrow">Diálogo interno</div><h1>Do crítico ao treinador</h1><p class="muted">Escreve uma frase que dizes a ti próprio quando as coisas correm mal. Depois cria a versão de treinador: instrução ou energia, sem julgamento.</p>
  <div class="card"><label class="f" style="margin-top:0">O que o crítico diz</label><input type="text" id="rfC" placeholder="ex.: és mesmo mau, falhas sempre esta bola">
  <label class="f">O que o treinador diria</label><input type="text" id="rfT" placeholder="ex.: mais altura, pés antes — tu sabes esta bola">
  <div class="grid2 mt"><button class="btn ghost" id="rfAi" onclick="reframeAI()" ${S.ai===false?'disabled':''}>Sugestão do coach</button><button class="btn" onclick="reframeSave()">Guardar</button></div></div>
  ${S.state.reframes.length?`<div class="card"><div class="eyebrow">As tuas frases</div>${S.state.reframes.slice().reverse().map((r,i)=>`<div class="mem"><div style="flex:1"><span class="muted" style="text-decoration:line-through">${esc(r.c)}</span><br><b>${esc(r.t)}</b></div><button onclick="S.state.reframes.splice(${S.state.reframes.length-1-i},1);saveState();render()">✕</button></div>`).join('')}</div>`:''}`;
async function reframeAI(){ const c=$('#rfC').value.trim(); if(!c) return toast('Escreve primeiro a frase do crítico.'); await aiBtn('#rfAi','',async()=>{ const r=await askJSON(`Transforma esta frase de autocrítica de um jogador de ténis numa frase de treinador (instrucional ou motivacional, curta, até 12 palavras, 2.ª pessoa, sem negações): "${c}". Chave: "frase".`,'quick'); $('#rfT').value=r.frase||''; }); }
function reframeSave(){ const c=$('#rfC').value.trim(), t=$('#rfT').value.trim(); if(!c||!t) return toast('Preenche as duas frases.'); S.state.reframes.push({c,t,ts:Date.now()}); if(plan().plan.training==='reframe') markDone('training'); saveState(); toast('Guardado ✓'); render(); }

/* ===== JOGO: preparar ===== */
function tournamentSelect(sel=''){ const ts=S.state.tournaments.filter(t=>(t.end||t.start||'9999')>=dayKey(Date.now()-3*864e5)); return ts.length?`<label class="f">Torneio</label><select name="tournament"><option value="">— nenhum —</option>${ts.map(t=>`<option value="${t.id}" ${t.id===sel||(!sel&&daysUntil(t.start)<=0)?'selected':''}>${esc(t.name)}</option>`).join('')}</select><label class="f">Ronda</label><input type="text" name="round" placeholder="ex.: 1.ª ronda, quartos">`:''; }
VIEWS.pre=()=>`${backBtn()}<h1>Preparar jogo</h1><p class="muted">5 minutos agora poupam-te um set de nervos.</p>
  <form onsubmit="submitPre(event)">
  <label class="f">Adversário</label><input type="text" name="opp" placeholder="nome">${tournamentSelect()}
  <label class="f">Superfície</label>${seg('surface',['Terra','Rápido','Indoor'],S.profile.surface==='Rápido'?'Rápido':S.profile.surface==='Indoor'?'Indoor':'Terra')}
  <label class="f">Como joga o adversário?</label><textarea name="oppStyle" placeholder="ex.: defensivo, muito consistente, esquerda a uma mão fraca em bolas altas"></textarea>
  <label class="f">Plano A</label><textarea name="planA" placeholder="ex.: servir aberto no deuce, entrar com a direita inside-in"></textarea>
  <label class="f">Plano B</label><textarea name="planB" placeholder="ex.: mais altura e peso, subir à rede"></textarea>
  <label class="f">O que me pode tirar do jogo?</label><textarea name="threats" placeholder="ex.: frustrar-me se ele devolver tudo"></textarea>
  ${slider('nerves','Nervos agora',5,'1 = nada · 10 = muito')}
  <div style="height:10px"></div><button class="btn" id="preBtn">Gerar cartão de jogo</button>
  <p class="hint" style="text-align:center">${S.ai===false?'Sem IA nesta vista: o plano fica guardado.':'Resumo do plano, 3 palavras-chave, reset, nervos e visualização de 60 s.'}</p></form>`;
async function submitPre(ev){
  ev.preventDefault(); const d=formData(ev.target);
  const e={id:uid(),type:'pre',ts:Date.now(),...d,nerves:+d.nerves}; saveEntry(e); plan();
  if(!SAMPLE){ toast('Plano guardado'); return replace('entry',e.id); }
  await aiBtn('#preBtn','O coach está a preparar o cartão…',async()=>{
    e.ai=await askJSON(`O jogador vai jogar. Pré-jogo: ${entryLine(e)}. Cria um cartão de jogo. Chaves: "plano" (2 frases concretas com base no plano A, no estilo do adversário e na pancada mais forte do jogador), "chaves" (array de exatamente 3 palavras-chave de 1-2 palavras), "primeiros_jogos" (como abordar os 3 primeiros jogos, 1 frase), "se_correr_mal" (o que mudar, 1-2 frases), "reset" (o reset após erro em 3 passos curtos numa frase), "ativacao" (dica para os nervos ajustada ao nível indicado), "visualizacao" (guião de 60 s, 2.ª pessoa, 4-5 frases).`);
    saveEntry(e);
  });
  replace('entry',e.id);
}

/* ===== JOGO: rever ===== */
VIEWS.post=()=>{ const pre=ofType('pre')[0]; const recentPre= pre && Date.now()-pre.ts<2*864e5 ? pre : null;
  return `${backBtn()}<h1>Rever jogo</h1><p class="muted">Sê honesto — isto é só para ti.</p>
  <form onsubmit="submitPost(event)">
  <label class="f">Adversário</label><input type="text" name="opp" value="${esc(recentPre?.opp||'')}">${tournamentSelect(recentPre?.tournament||'')}
  <label class="f">Resultado</label>${seg('result',[['vitória','Vitória'],['derrota','Derrota']],'vitória')}
  <label class="f">Marcador</label><input type="text" name="score" placeholder="ex.: 6-4 3-6 10-7">
  <details class="card mt"><summary>Estatísticas (opcional)</summary>
    <div class="grid2"><div><label class="f">% 1.º serviço</label><input type="number" name="fs" min="0" max="100"></div><div><label class="f">Duplas faltas</label><input type="number" name="df" min="0"></div>
    <div><label class="f">Break points ganhos</label><input type="number" name="bpw" min="0"></div><div><label class="f">Break points jogados</label><input type="number" name="bpt" min="0"></div></div></details>
  ${recentPre?`<label class="f">Cumpriste o plano A? (1-10)</label>${seg('planDone',['1','3','5','7','10'],'5')}<input type="hidden" name="preId" value="${recentPre.id}">`:''}
  <h3 style="margin-top:20px">O teu mental neste jogo</h3><p class="hint">1 = muito mal · 10 = excelente</p>${pillarSliders()}
  <label class="f">O que correu bem?</label><textarea name="good"></textarea>
  <label class="f">O que correu mal?</label><textarea name="bad"></textarea>
  <label class="f">Momento em que o jogo mudou</label><textarea name="key" placeholder="ex.: 4-4 no 2.º set, perdi o serviço com duas duplas"></textarea>
  <label class="f">Emoção dominante</label>${chipset('emotion',['Calma','Confiança','Nervos','Frustração','Raiva','Medo de perder','Cansaço','Garra'],[])}
  <div style="height:16px"></div><button class="btn" id="postBtn">Guardar e pedir análise</button></form>`; };
async function submitPost(ev){
  ev.preventDefault(); const d=formData(ev.target);
  const e={id:uid(),type:'post',ts:Date.now(),opp:d.opp,result:d.result,score:d.score,fs:d.fs,df:d.df,bpw:d.bpw,bpt:d.bpt,good:d.good,bad:d.bad,key:d.key,emotion:chipVals('emotion').join(', '),tournament:d.tournament||'',round:d.round||'',planDone:d.planDone||'',preId:d.preId||'',skills:{}};
  PK.forEach(k=>e.skills[k]=+d[k]); saveEntry(e);
  if(!SAMPLE){ toast('Jogo guardado'); return replace('entry',e.id); }
  await aiBtn('#postBtn','O coach está a analisar…',async()=>{
    const pre=e.preId?S.entries.find(x=>x.id===e.preId):null;
    e.ai=await askJSON(`O jogador registou este jogo: ${entryLine(e)}${pre?`\nPlano antes do jogo: ${entryLine(pre)}. Cumprimento do plano A: ${e.planDone}/10.`:''}
Compara com o histórico e a memória. Chaves: "resumo" (2-3 frases sobre o que aconteceu mentalmente), "padrao" (um padrão que se repete no histórico, ou "Ainda poucos dados" se não houver), "ponto_forte" (1 frase), "a_trabalhar" (a competência mental mais importante a melhorar e porquê, 1-2 frases), "exercicio" (exercício concreto para o próximo treino, com duração), "foco_proximo" (foco para a próxima semana, máx. 8 palavras), "memoria" (array de 0-2 notas novas e duradouras sobre este jogador para a tua memória, só se forem mesmo novas).`);
    addMemory(e.ai.memoria); saveEntry(e);
  });
  replace('entry',e.id);
}

/* ===== TREINO: reflexão ===== */
VIEWS.practice=()=>{ const ci=ofType('checkin').find(e=>dayKey(e.ts)===TODAY());
  return `${backBtn()}<h1>Reflexão de treino</h1>${ci?.intent?`<div class="card"><div class="eyebrow">A tua intenção de hoje</div>“${esc(ci.intent)}”</div>`:''}
  <form onsubmit="submitPractice(event)">
  <label class="f">O que treinaste?</label><input type="text" name="what" placeholder="ex.: cesto de direitas + pontos a partir do serviço">
  ${slider('quality','Qualidade do treino',6)}${slider('intentDone','Cumpri a minha intenção',6)}
  <details class="card mt"><summary>Avaliar competências mentais (recomendado)</summary>${pillarSliders()}<input type="hidden" name="withSkills" value="1"></details>
  <label class="f">O que aprendi / o que levo para o próximo treino</label><textarea name="learned"></textarea>
  <div style="height:16px"></div><button class="btn" id="prBtn">Guardar reflexão</button></form>`; };
async function submitPractice(ev){
  ev.preventDefault(); const d=formData(ev.target), opened=document.querySelector('form details')?.open;
  const e={id:uid(),type:'practice',ts:Date.now(),what:d.what,quality:+d.quality,intentDone:+d.intentDone,learned:d.learned};
  if(opened){ e.skills={}; PK.forEach(k=>e.skills[k]=+d[k]); }
  saveEntry(e);
  if(!SAMPLE){ toast('Reflexão guardada ✓'); return replace('entry',e.id); }
  await aiBtn('#prBtn','O coach está a ler…',async()=>{
    e.ai=await askJSON(`Reflexão de treino: ${entryLine(e)}. Dá feedback curto. Chaves: "resumo" (1-2 frases), "a_trabalhar" (1 frase), "exercicio" (para o próximo treino, 1 frase), "foco_proximo" (máx. 8 palavras).`,'quick'); saveEntry(e);
  });
  replace('entry',e.id);
}

/* ===== ENTRADA ===== */
VIEWS.entry=()=>{
  const e=S.entries.find(x=>x.id===S.param); if(!e) return VIEWS.home();
  let body='';
  const skillsCard = e.skills ? `<div class="card bars"><div class="eyebrow">Mental · índice ${mentalIndex(e)?.toFixed(1)}</div>${PK.filter(k=>e.skills[k]).map(k=>`<div class="b"><div class="lab"><span>${PN[k]}</span><span>${e.skills[k]}</span></div><div class="track"><div class="fill" style="width:${e.skills[k]*10}%"></div></div></div>`).join('')}</div>`:'';
  const retry = (!e.ai && S.ai!==false && e.type!=='checkin') ? `<div class="card"><p class="muted" style="margin-top:0">Sem análise do coach ainda.</p><button class="btn small" id="retry" onclick="retryAI('${e.id}')">Pedir análise</button></div>`:'';
  const tn = e.tournament ? S.state.tournaments.find(t=>t.id===e.tournament) : null;
  if(e.type==='checkin') body=`<h1>Check-in</h1><div class="card">${CHECK.map(([k,l])=>`<div class="row between"><span>${l}</span><b>${e[k]}</b></div>`).join('')}${e.sleep?`<div class="row between"><span>Sono</span><b>${esc(e.sleep)} h</b></div>`:''}${e.intent?`<p class="sec">“${esc(e.intent)}”</p>`:''}</div>`;
  if(e.type==='pre') body=`<h1>Jogo vs ${esc(e.opp||'?')}</h1><p class="muted">${esc(e.surface||'')} · nervos ${e.nerves}/10${tn?' · '+esc(tn.name):''}${e.round?' · '+esc(e.round):''}</p>
    ${e.ai?`<div class="card accent"><div class="eyebrow">Cartão de jogo</div><h2 style="margin-bottom:6px">${esc(e.ai.plano||'')}</h2><div class="cues">${(e.ai.chaves||[]).map(c=>`<span class="cue">${esc(c)}</span>`).join('')}</div></div>
    <div class="card">${aiBlocks(e.ai,[['primeiros_jogos','Primeiros 3 jogos'],['reset','Reset após erro'],['se_correr_mal','Se correr mal'],['ativacao','Nervos']])}</div>
    ${e.ai.visualizacao?`<div class="card"><div class="row between"><div class="eyebrow" style="margin:0">Visualização · 60 s</div><button class="btn small ghost" onclick="playText(${J(e.ai.visualizacao)})">▶ Ouvir</button></div><div class="ai sec mt">${esc(e.ai.visualizacao)}</div></div>`:''}`:retry}
    <details class="card"><summary>O teu plano</summary>${[['oppStyle','Adversário'],['planA','Plano A'],['planB','Plano B'],['threats','Riscos']].map(([k,l])=>e[k]?`<p><b>${l}:</b> ${esc(e[k])}</p>`:'').join('')}</details>
    <button class="btn ghost mb" onclick="go('post')">Rever este jogo depois de jogar</button>`;
  if(e.type==='post') body=`<h1>vs ${esc(e.opp||'?')}</h1><p class="muted"><span class="pill ${e.result==='vitória'?'win':'loss'}">${e.result}</span> ${esc(e.score||'')}${tn?' · '+esc(tn.name):''}${e.round?' · '+esc(e.round):''}</p>
    ${e.ai?`<div class="card accent"><div class="eyebrow">Análise do coach</div><div class="ai">${esc(e.ai.resumo||'')}</div>${aiBlocks(e.ai,[['padrao','Padrão'],['ponto_forte','Ponto forte'],['a_trabalhar','A trabalhar'],['exercicio','Exercício'],['foco_proximo','Foco da próxima semana']])}</div>`:retry}
    ${(e.fs||e.df||e.bpt)?`<div class="grid3 mb"><div class="stat"><b>${e.fs||'–'}%</b><span>1.º serviço</span></div><div class="stat"><b>${e.df||'–'}</b><span>duplas</span></div><div class="stat"><b>${e.bpw||'–'}/${e.bpt||'–'}</b><span>break points</span></div></div>`:''}
    ${skillsCard}<div class="card">${[['good','Correu bem'],['bad','Correu mal'],['key','Momento-chave'],['emotion','Emoção'],['planDone','Plano A cumprido']].map(([k,l])=>e[k]?`<p><b>${l}:</b> ${esc(e[k])}${k==='planDone'?'/10':''}</p>`:'').join('')||'<span class="muted">Sem notas.</span>'}</div>`;
  if(e.type==='practice') body=`<h1>Treino</h1><p class="muted">${esc(e.what||'')}</p><div class="grid2 mb"><div class="stat"><b>${e.quality}</b><span>qualidade</span></div><div class="stat"><b>${e.intentDone}</b><span>intenção cumprida</span></div></div>
    ${e.ai?`<div class="card accent"><div class="eyebrow">Coach</div><div class="ai">${esc(e.ai.resumo||'')}</div>${aiBlocks(e.ai,[['a_trabalhar','A trabalhar'],['exercicio','Próximo treino'],['foco_proximo','Foco']])}</div>`:retry}
    ${skillsCard}${e.learned?`<div class="card"><b>Aprendi:</b> ${esc(e.learned)}</div>`:''}`;
  return `${backBtn()}<p class="muted" style="margin:0 0 4px">${fmtDate(e.ts)}</p>${body}
  <button class="btn ghost" onclick="confirmBox('Apagar este registo?',()=>{deleteEntry('${e.id}');back()})">Apagar registo</button>`;
};
async function retryAI(id){ const e=S.entries.find(x=>x.id===id); await aiBtn('#retry','a pensar…',async()=>{
  if(e.type==='pre') e.ai=await askJSON(`Cartão de jogo para: ${entryLine(e)}. Chaves: "plano", "chaves" (3 palavras-chave), "primeiros_jogos", "se_correr_mal", "reset", "ativacao", "visualizacao" (60 s).`);
  else if(e.type==='post'){ e.ai=await askJSON(`Analisa este jogo: ${entryLine(e)}. Chaves: "resumo", "padrao", "ponto_forte", "a_trabalhar", "exercicio", "foco_proximo" (máx. 8 palavras), "memoria" (array 0-2 notas novas).`); addMemory(e.ai.memoria); }
  else e.ai=await askJSON(`Reflexão de treino: ${entryLine(e)}. Chaves: "resumo", "a_trabalhar", "exercicio", "foco_proximo".`,'quick');
  saveEntry(e); render(); }); }
function playText(txt){ const parts=String(txt).split(/(?<=[.!?])\s+/).filter(Boolean); openPlayer('tmp',{n:'Visualização pré-jogo',steps:parts.map(p=>[Math.max(6,Math.round(p.length/14)),p])}); }

/* ===== COACH ===== */
VIEWS.coach=()=>{
  const sugg=['Que padrões vês nos meus jogos?','Como lido com a pressão a servir para o set?','Prepara-me para o próximo jogo','Perdi a cabeça depois de um erro. E agora?','O que devo treinar esta semana?','Dá-me uma rotina pré-jogo'];
  const mem=S.profile.coachMemory||[];
  return `<h1>Coach</h1><p class="muted" style="margin:4px 0 12px">Conhece o teu perfil, os teus objetivos e os teus últimos registos.</p>
  ${S.ai===false?`<div class="card"><p class="muted" style="margin:0">O coach de IA só funciona com a app aberta no claude.ai.</p></div>`:''}
  <details class="card"><summary>O que o coach sabe sobre ti <span class="badge">${mem.length}</span></summary>${mem.length?mem.map((m,i)=>`<div class="mem"><span style="flex:1">${esc(m.t)}</span><button onclick="S.profile.coachMemory.splice(${i},1);saveProfile();render()" aria-label="Apagar">✕</button></div>`).join(''):'<p class="muted small">Ainda nada. O coach vai aprendendo com os teus jogos e conversas.</p>'}
    <div class="row mt"><input type="text" id="memIn" placeholder="Acrescentar algo que o coach deve saber"><button class="btn small" onclick="const v=$('#memIn').value.trim();if(v){addMemory(v);render()}">+</button></div></details>
  <div class="chat" id="chat">${S.chat.length?S.chat.map(m=>`<div class="msg ${m.role==='user'?'u':'a'}">${esc(m.content)}</div>`).join(''):`<div class="msg a">Olá${S.profile.name?' '+esc(S.profile.name):''}! Sou o teu coach mental. Pergunta-me o que quiseres sobre o teu jogo, ou escolhe uma sugestão.</div>`}<div id="chatEnd"></div></div>
  <div class="chips">${sugg.map(s=>`<button onclick="sendChat(${J(s)})">${esc(s)}</button>`).join('')}</div>
  <div class="composer"><textarea id="chatIn" placeholder="Escreve…" rows="1">${esc(S.chatDraft||'')}</textarea><button class="btn" id="sendBtn" onclick="sendChat()">➤</button></div>
  ${S.chat.length?`<button class="btn ghost small" onclick="newChat()">Nova conversa</button>`:''}`;
};
VIEWS.coach_after=()=>{ S.chatDraft=''; const c=$('#chatEnd'); if(c && S.chat.length) c.scrollIntoView(); };
let chatBusy=false;
async function sendChat(text){
  if(chatBusy) return; const inp=$('#chatIn'); text=(text||inp.value).trim(); if(!text) return;
  if(!SAMPLE) return toast(aiErr({code:'no_ai'}),4000);
  chatBusy=true; inp.value=''; S.chat.push({role:'user',content:text});
  $('#chatEnd').insertAdjacentHTML('beforebegin',`<div class="msg u">${esc(text)}</div><div class="msg a" id="live"><span class="muted">a pensar…</span></div>`); $('#chatEnd').scrollIntoView({behavior:'smooth'});
  const live=$('#live'); $('#sendBtn').disabled=true;
  const msgs=[{role:'user',content:`${PERSONA}\n\n${context(15)}\n\nVais conversar com o jogador. Respostas curtas (normalmente até 120 palavras), texto simples sem markdown. Se ele pedir um exercício que existe na app (respiração box, suspiro fisiológico, grelha de foco, visualização, reset em 3 passos, rotina entre pontos), podes sugeri-lo pelo nome.`},{role:'assistant',content:'Entendido. Estou pronto.'}];
  S.chat.slice(-20).forEach(m=>{ const last=msgs[msgs.length-1]; if(last.role===m.role) last.content+='\n'+m.content; else msgs.push({role:m.role,content:m.content}); });
  try{
    const r=await SAMPLE(msgs,{cache:false,modelTier:'default',onText:({text})=>{ if(text && live.isConnected) live.textContent=text; }});
    const out=(r.text||live.textContent||'').trim(); live.textContent=out; live.removeAttribute('id');
    S.chat.push({role:'assistant',content:out}); saveChat();
    if(S.chat.length%8===0) updateMemoryFromChat();
  }catch(e){ live.textContent=aiErr(e); live.removeAttribute('id'); S.chat.pop(); }
  chatBusy=false; const sb=$('#sendBtn'); if(sb) sb.disabled=false;
}
async function updateMemoryFromChat(){
  if(!SAMPLE||S.chat.length<2) return;
  try{ const conv=S.chat.slice(-12).map(m=>(m.role==='user'?'Jogador: ':'Coach: ')+m.content).join('\n');
    const r=await askJSON(`Conversa recente:\n${conv}\n\nExtrai 0-3 notas novas e duradouras sobre o jogador (factos que ele disse, preferências, padrões confirmados) que ainda não estejam na memória. Nada de conselhos teus. Chave: "memoria" (array de strings até 20 palavras).`,'quick'); addMemory(r.memoria); }catch(e){}
}
function newChat(){ confirmBox('Começar uma nova conversa?',async()=>{ await updateMemoryFromChat(); S.chat=[]; saveChat(); render(); },'Nova conversa'); }

/* ===== EU ===== */
VIEWS.me=()=>{
  const sc=pillarScores(), b=S.profile.baseline||{};
  const sorted=PK.slice().sort((a,c)=>(sc[c]??0)-(sc[a]??0));
  return `<div class="row between"><h1>${esc(S.profile.name||'Eu')}</h1><button class="btn ghost small" onclick="go('settings')">Definições</button></div>
  <p class="muted">${esc(S.profile.level)} · ${esc(S.profile.ranking)} · ${esc((S.profile.style||[]).join(', '))}</p>
  <div class="card"><div class="eyebrow">Perfil mental</div><div class="chartwrap" id="meRadar"></div>
  <div class="legend"><span><i style="background:var(--series-1)"></i>Agora</span><span><i class="dash"></i>Inicial</span></div></div>
  <div class="card bars"><div class="row between"><div class="eyebrow" style="margin:0">Competências</div><span class="muted small">agora · vs inicial</span></div>
    ${sorted.map(k=>{const v=sc[k], d=(v!=null&&b[k])?v-b[k]:null; return `<div class="b"><div class="lab"><span>${PN[k]}</span><span>${v!=null?v.toFixed(1):'–'}${d!=null&&Math.abs(d)>=.1?` <span class="muted">${d>0?'▲':'▼'}${Math.abs(d).toFixed(1)}</span>`:''}</span></div><div class="track"><div class="fill" style="width:${(v||0)*10}%"></div></div></div>`;}).join('')}
    <p class="hint">Calculado a partir da avaliação inicial, das tuas reflexões e dos check-ins.</p>
    <label class="f">Modo do programa</label><select onchange="S.profile.focusPillar=this.value;saveProfile();plan(true);toast('Plano atualizado')"><option value="">Adaptativo (recomendado)</option>${P.map(p=>`<option value="${p.k}" ${S.profile.focusPillar===p.k?'selected':''}>Focar só em ${p.n}</option>`).join('')}</select></div>
  <div class="grid2 mb">
    <button class="action" onclick="go('goals')"><span class="ic">◎</span><b>Objetivos</b><small>${S.state.goals.filter(g=>!g.done).length} ativos</small></button>
    <button class="action" onclick="go('tournaments')"><span class="ic">🏆︎</span><b>Torneios</b><small>${upcomingTournament()?esc(upcomingTournament().name):'nenhum próximo'}</small></button>
    <button class="action" onclick="go('progress')"><span class="ic">↗</span><b>Progresso</b><small>Gráficos e revisão semanal</small></button>
    <button class="action" onclick="go('history')"><span class="ic">≡</span><b>Diário</b><small>${S.entries.length} registos</small></button></div>`;
};
VIEWS.me_after=()=>{ radar($('#meRadar'),[{name:'Inicial',values:S.profile.baseline||{},color:'#8d8c84',dash:true},{name:'Agora',values:pillarScores(),color:'var(--series-1)'}]); };

/* ===== OBJETIVOS ===== */
VIEWS.goals=()=>{ const act=S.state.goals.filter(g=>!g.done), done=S.state.goals.filter(g=>g.done);
  const card=g=>`<div class="card tap" onclick="go('goal','${g.id}')"><div class="row between"><span class="pill ${g.area==='mental'?'clay':''}">${esc(g.area)} · ${esc(g.kind)}</span>${g.deadline?`<span class="muted small">até ${esc(g.deadline)}</span>`:''}</div><h3 style="margin-top:8px">${esc(g.title)}</h3><div class="progress"><i style="width:${g.done?100:g.progress||0}%"></i></div></div>`;
  return `${backBtn()}<div class="row between"><h1>Objetivos</h1><button class="btn small" onclick="go('goalEdit')">+ Novo</button></div>
  <p class="muted">Um objetivo de resultado dá direção; os de processo é que o fazem acontecer.</p>
  ${act.length?act.map(card).join(''):'<div class="empty">Sem objetivos ativos.</div>'}
  ${done.length?`<details class="card"><summary>Concluídos (${done.length})</summary>${done.map(card).join('')}</details>`:''}`; };
VIEWS.goalEdit=()=>{ const g=S.state.goals.find(x=>x.id===S.param)||{area:'mental',kind:'processo',title:'',deadline:'',why:'',pillar:''};
  return `${backBtn()}<h1>${S.param?'Editar':'Novo'} objetivo</h1><form onsubmit="saveGoal(event)">
  <label class="f">Área</label>${seg('area',[['mental','Mental'],['ténis','Ténis']],g.area)}
  <label class="f">Tipo</label>${seg('kind',[['processo','Processo'],['performance','Performance'],['resultado','Resultado']],g.kind)}
  <p class="hint">Processo: o que fazes (ex.: rotina em todos os pontos). Performance: um número teu (ex.: 65% de 1.º serviço). Resultado: ganhar/ranking.</p>
  <label class="f">Objetivo</label><input type="text" name="title" value="${esc(g.title)}" required placeholder="ex.: fazer o reset em 3 passos depois de todos os erros">
  <label class="f">Competência ligada</label><select name="pillar"><option value="">—</option>${P.map(p=>`<option value="${p.k}" ${g.pillar===p.k?'selected':''}>${p.n}</option>`).join('')}</select>
  <label class="f">Prazo</label><input type="date" name="deadline" value="${esc(g.deadline)}">
  <label class="f">Porque é importante para ti?</label><textarea name="why">${esc(g.why||'')}</textarea>
  <div style="height:14px"></div><button class="btn">Guardar</button></form>`; };
function saveGoal(ev){ ev.preventDefault(); const d=formData(ev.target); let g=S.state.goals.find(x=>x.id===S.param);
  if(!g){ g={id:uid(),progress:0,steps:[],ts:Date.now()}; S.state.goals.push(g); }
  Object.assign(g,{area:d.area,kind:d.kind,title:d.title.trim(),pillar:d.pillar,deadline:d.deadline,why:d.why}); saveState(); if(S.param) back(); else replace('goal',g.id); }
VIEWS.goal=()=>{ const g=S.state.goals.find(x=>x.id===S.param); if(!g) return VIEWS.goals();
  return `${backBtn()}<span class="pill ${g.area==='mental'?'clay':''}">${esc(g.area)} · ${esc(g.kind)}</span><h1 class="mt">${esc(g.title)}</h1>${g.deadline?`<p class="muted">Prazo: ${esc(g.deadline)} (${daysUntil(g.deadline)} dias)</p>`:''}${g.why?`<p class="sec">${esc(g.why)}</p>`:''}
  <div class="card"><div class="row between"><div class="eyebrow" style="margin:0">Progresso</div><b id="gpv">${g.progress||0}%</b></div><input type="range" min="0" max="100" step="5" value="${g.progress||0}" oninput="$('#gpv').textContent=this.value+'%'" onchange="goalProg('${g.id}',this.value)"></div>
  <div class="card"><div class="row between"><div class="eyebrow" style="margin:0">Passos</div><button class="btn small ghost" id="gStepsAi" onclick="goalSteps('${g.id}')" ${S.ai===false?'disabled':''}>✦ Dividir com o coach</button></div>
    <div class="mt">${(g.steps||[]).map((s,i)=>`<div class="check ${s.done?'on':''}" onclick="goalStep('${g.id}',${i})"><span class="bx">${s.done?'✓':''}</span><span>${esc(s.t)}</span></div>`).join('')||'<p class="muted small">Sem passos.</p>'}</div>
    <div class="row mt"><input type="text" id="gStep" placeholder="Novo passo"><button class="btn small" onclick="const v=$('#gStep').value.trim();if(v){const g=S.state.goals.find(x=>x.id==='${g.id}');g.steps.push({t:v,done:false});saveState();render()}">+</button></div></div>
  <div class="grid2"><button class="btn ghost" onclick="go('goalEdit','${g.id}')">Editar</button><button class="btn" onclick="const g=S.state.goals.find(x=>x.id==='${g.id}');g.done=!g.done;if(g.done)g.progress=100;saveState();toast(g.done?'Objetivo concluído 🎉':'Reaberto');render()">${g.done?'Reabrir':'Concluído'}</button></div>
  <button class="btn link mt" onclick="confirmBox('Apagar este objetivo?',()=>{S.state.goals=S.state.goals.filter(x=>x.id!=='${g.id}');saveState();back()})">Apagar objetivo</button>`; };
function goalProg(id,v){ const g=S.state.goals.find(x=>x.id===id); g.progress=+v; saveState(); }
function goalStep(id,i){ const g=S.state.goals.find(x=>x.id===id); g.steps[i].done=!g.steps[i].done; const n=g.steps.length; if(n) g.progress=Math.round(g.steps.filter(s=>s.done).length/n*100); saveState(); render(); }
async function goalSteps(id){ const g=S.state.goals.find(x=>x.id===id); await aiBtn('#gStepsAi','',async()=>{ const r=await askJSON(`Divide este objetivo (${g.area}, ${g.kind}) em 3 a 5 passos de processo concretos e mensuráveis, adaptados ao jogador: "${g.title}"${g.deadline?' até '+g.deadline:''}. Chave: "passos" (array de strings até 14 palavras).`); (r.passos||[]).forEach(t=>g.steps.push({t,done:false})); saveState(); render(); }); }

/* ===== TORNEIOS ===== */
VIEWS.tournaments=()=>{ const all=S.state.tournaments.slice().sort((a,b)=>(b.start||'').localeCompare(a.start||''));
  return `${backBtn()}<div class="row between"><h1>Torneios</h1><button class="btn small" onclick="go('tournamentEdit')">+ Novo</button></div>
  ${all.length?all.map(t=>{const dd=daysUntil(t.start), past=(t.end||t.start)<TODAY(); const ms=S.entries.filter(e=>e.type==='post'&&e.tournament===t.id);
    return `<div class="card tap" onclick="go('tournament','${t.id}')"><div class="row between"><h3>${esc(t.name)}</h3><span class="pill ${past?'':'clay'}">${past?'terminado':dd<=0?'a decorrer':'em '+dd+' dias'}</span></div><div class="muted small">${esc(t.start||'')}${t.end&&t.end!==t.start?' → '+esc(t.end):''} · ${esc(t.surface||'')} ${ms.length?`· ${ms.filter(e=>e.result==='vitória').length}V ${ms.filter(e=>e.result==='derrota').length}D`:''}</div></div>`;}).join(''):'<div class="empty">Sem torneios. Adiciona o próximo para receberes um plano de preparação.</div>'}`; };
VIEWS.tournamentEdit=()=>{ const t=S.state.tournaments.find(x=>x.id===S.param)||{name:'',start:'',end:'',place:'',surface:'Terra',goal:'',notes:''};
  return `${backBtn()}<h1>${S.param?'Editar':'Novo'} torneio</h1><form onsubmit="saveTournament(event)">
  <label class="f">Nome</label><input type="text" name="name" value="${esc(t.name)}" required>
  <div class="grid2"><div><label class="f">Início</label><input type="date" name="start" value="${esc(t.start)}" required></div><div><label class="f">Fim</label><input type="date" name="end" value="${esc(t.end)}"></div></div>
  <label class="f">Local</label><input type="text" name="place" value="${esc(t.place)}">
  <label class="f">Superfície</label>${seg('surface',['Terra','Rápido','Indoor'],t.surface)}
  <label class="f">Objetivo para o torneio</label><input type="text" name="goal" value="${esc(t.goal)}" placeholder="ex.: chegar aos quartos; competir cada ponto">
  <label class="f">Notas (horários, viagem, quadro…)</label><textarea name="notes">${esc(t.notes)}</textarea>
  <div style="height:14px"></div><button class="btn">Guardar</button></form>`; };
function saveTournament(ev){ ev.preventDefault(); const d=formData(ev.target); let t=S.state.tournaments.find(x=>x.id===S.param);
  if(!t){ t={id:uid(),checks:{},ts:Date.now()}; S.state.tournaments.push(t); }
  Object.assign(t,{name:d.name.trim(),start:d.start,end:d.end||d.start,place:d.place,surface:d.surface,goal:d.goal,notes:d.notes}); saveState(); plan(); if(S.param) back(); else replace('tournament',t.id); }
VIEWS.tournament=()=>{ const t=S.state.tournaments.find(x=>x.id===S.param); if(!t) return VIEWS.tournaments();
  const dd=daysUntil(t.start), ms=S.entries.filter(e=>(e.type==='post'||e.type==='pre')&&e.tournament===t.id), p=t.plan;
  const sect=(k,l)=>p&&p[k]&&p[k].length?`<div class="card"><div class="eyebrow">${l}</div>${p[k].map((x,i)=>{const ck=k+i;return `<div class="check ${t.checks?.[ck]?'on':''}" onclick="tCheck('${t.id}','${ck}')"><span class="bx">${t.checks?.[ck]?'✓':''}</span><span>${esc(x)}</span></div>`;}).join('')}</div>`:'';
  return `${backBtn()}<h1>${esc(t.name)}</h1><p class="muted">${esc(t.start)}${t.end&&t.end!==t.start?' → '+esc(t.end):''} · ${esc(t.surface||'')}${t.place?' · '+esc(t.place):''}</p>
  <div class="grid3 mb"><div class="stat"><b>${dd>0?dd:'–'}</b><span>${dd>0?'dias até começar':'a decorrer/terminado'}</span></div><div class="stat"><b>${ms.filter(e=>e.result==='vitória').length}</b><span>vitórias</span></div><div class="stat"><b>${ms.filter(e=>e.result==='derrota').length}</b><span>derrotas</span></div></div>
  ${t.goal?`<div class="card accent"><div class="eyebrow">Objetivo</div><h3>${esc(t.goal)}</h3></div>`:''}
  ${p?`${p.foco_mental?`<div class="card"><div class="eyebrow">Foco mental para o torneio</div><h3>${esc(p.foco_mental)}</h3></div>`:''}${sect('antes','Semana antes')}${sect('vespera','Véspera')}${sect('dia_de_jogo','Dia de jogo')}${sect('entre_jogos','Entre jogos')}${sect('depois_derrota','Se perderes')}
   <button class="btn ghost small mb" id="tpBtn" onclick="tPlan('${t.id}')">Refazer plano</button>`
   :`<div class="card"><p class="muted" style="margin-top:0">O coach cria um plano de preparação: semana antes, véspera, dia de jogo, entre jogos e o que fazer se perderes.</p><button class="btn" id="tpBtn" onclick="tPlan('${t.id}')" ${S.ai===false?'disabled':''}>Criar plano do torneio</button></div>`}
  <div class="grid2 mb"><button class="btn ghost" onclick="go('pre')">Preparar jogo</button><button class="btn ghost" onclick="go('post')">Rever jogo</button></div>
  ${ms.length?`<div class="card"><div class="eyebrow">Jogos</div>${ms.map(e=>`<div class="check" onclick="go('entry','${e.id}')"><span>${e.type==='pre'?'Pré-jogo':'Jogo'} vs ${esc(e.opp||'?')} ${e.round?'· '+esc(e.round):''}</span>${e.result?`<span class="pill ${e.result==='vitória'?'win':'loss'}" style="margin-left:auto">${e.result}</span>`:''}</div>`).join('')}</div>`:''}
  ${t.notes?`<div class="card"><div class="eyebrow">Notas</div><div class="ai sec">${esc(t.notes)}</div></div>`:''}
  <div class="grid2"><button class="btn ghost" onclick="go('tournamentEdit','${t.id}')">Editar</button><button class="btn ghost" onclick="confirmBox('Apagar este torneio?',()=>{S.state.tournaments=S.state.tournaments.filter(x=>x.id!=='${t.id}');saveState();back()})">Apagar</button></div>`; };
function tCheck(id,k){ const t=S.state.tournaments.find(x=>x.id===id); t.checks=t.checks||{}; t.checks[k]=!t.checks[k]; saveState(); render(); }
async function tPlan(id){ const t=S.state.tournaments.find(x=>x.id===id); await aiBtn('#tpBtn','O coach está a planear…',async()=>{
  t.plan=await askJSON(`Cria um plano de preparação mental e prática para o torneio "${t.name}" (${t.start} a ${t.end}, ${t.surface}, ${t.place||''}). Objetivo: ${t.goal||'-'}. Notas: ${t.notes||'-'}. Adapta às competências mais fracas do jogador. Chaves (arrays de 3-5 itens curtos e acionáveis, até 16 palavras cada): "antes" (semana antes), "vespera", "dia_de_jogo" (inclui aquecimento e rotina pré-jogo com timings), "entre_jogos" (recuperação física e mental entre rondas), "depois_derrota" (como processar uma derrota no torneio); e "foco_mental" (string, máx. 10 palavras).`);
  t.checks={}; saveState(); render(); }); }

/* ===== PROGRESSO ===== */
VIEWS.progress=()=>{
  const posts=ofType('post'), refl=reflections(), checks=ofType('checkin');
  const mi=list=>{const v=list.map(mentalIndex).filter(Boolean);return v.length?avg(v).toFixed(1):'–';};
  const w=posts.filter(e=>e.result==='vitória'), l=posts.filter(e=>e.result==='derrota');
  const lastRev=S.state.reviews.slice(-1)[0];
  return `${backBtn()}<h1 class="mb">Progresso</h1>
  <div class="grid3 mb"><div class="stat"><b>${streak()}</b><span>dias seguidos</span></div><div class="stat"><b>${mi(w)}</b><span>índice mental nas vitórias</span></div><div class="stat"><b>${mi(l)}</b><span>índice nas derrotas</span></div></div>
  <div class="card"><div class="eyebrow">Consistência · últimas 8 semanas</div><div id="heat"></div><div class="legend"><span>menos</span>${[0,1,2,3].map(i=>`<i style="background:${heatColor(i)}"></i>`).join('')}<span>mais</span></div></div>
  ${refl.length?`<div class="card"><div class="eyebrow">Índice mental por sessão</div><div class="chartwrap" id="c1"></div><div class="hint">Média das 8 competências em cada reflexão. Toca num ponto.</div></div>`:''}
  ${checks.length>1?`<div class="card"><div class="eyebrow">Check-ins · confiança e calma</div><div class="chartwrap" id="c2"></div><div class="legend"><span><i style="background:var(--series-1)"></i>Confiança</span><span><i style="background:var(--series-2)"></i>Calma</span></div></div>`:''}
  ${S.state.neuro.some(x=>x.t==='schulte')?`<div class="card"><div class="eyebrow">Grelha de foco · segundos (menos é melhor)</div><div class="chartwrap" id="c3"></div></div>`:''}
  ${!refl.length&&checks.length<2?'<div class="empty">Faz check-ins e reflexões para veres a tua evolução.</div>':''}
  <button class="btn" id="weekBtn" onclick="weeklyReview()" ${S.ai===false?'disabled':''}>Pedir revisão semanal ao coach</button>
  <div id="weekOut" class="mt">${lastRev?reviewCard(lastRev):''}</div>`;
};
VIEWS.progress_after=()=>{
  const refl=reflections().slice(0,15).reverse();
  lineChart($('#c1'),[{name:'Índice',color:'var(--series-1)',values:refl.map(mentalIndex)}],{min:1,max:10,labels:refl.map(e=>shortDate(e.ts)),extra:i=>{const e=refl[i];return e.type==='post'?`<br>${esc(e.result||'')} vs ${esc(e.opp||'?')}`:'<br>treino';}});
  const ch=ofType('checkin').slice(0,14).reverse();
  lineChart($('#c2'),[{name:'Confiança',color:'var(--series-1)',values:ch.map(e=>e.confianca)},{name:'Calma',color:'var(--series-2)',values:ch.map(e=>e.calma)}],{min:1,max:10,labels:ch.map(e=>shortDate(e.ts))});
  const sn=S.state.neuro.filter(x=>x.t==='schulte').slice(-15);
  if(sn.length){ const vals=sn.map(x=>x.ms/1000); lineChart($('#c3'),[{name:'Tempo',color:'var(--series-1)',values:vals}],{min:Math.floor(Math.min(...vals)*.8),max:Math.ceil(Math.max(...vals)*1.1),labels:sn.map(x=>shortDate(x.ts)),fmt:v=>v.toFixed(1)+' s'}); }
  heatmap($('#heat'));
};
function reviewCard(r){ return `<div class="card accent"><div class="eyebrow">Revisão semanal · ${shortDate(r.ts)}</div><h2>${esc(r.titulo||'')}</h2>${aiBlocks(r,[['o_que_mudou','O que mudou'],['padroes','Padrões'],['prioridade','Prioridade'],['plano','Plano para 7 dias']])}${r.foco_proximo?`<button class="btn small mt" onclick="S.profile.weekFocus=${J(r.foco_proximo)};saveProfile();toast('Foco atualizado');go('home')">Usar como foco: “${esc(r.foco_proximo)}”</button>`:''}</div>`; }
async function weeklyReview(){ await aiBtn('#weekBtn','O coach está a rever a tua semana…',async()=>{
  const r=await askJSON(`Faz a revisão dos últimos 7-14 dias. Considera consistência do loop diário (${[...activeDays()].filter(k=>daysUntil(k)>=-7).length} dias ativos na última semana), jogos, treinos, check-ins, objetivos e perfil mental. Chaves: "titulo" (até 8 palavras), "o_que_mudou" (2 frases), "padroes" (array de 2-3 padrões concretos), "prioridade" (a única coisa a trabalhar a seguir), "plano" (array de 3 ações para 7 dias), "foco_proximo" (máx. 8 palavras), "memoria" (array 0-2 notas novas para a tua memória).`);
  r.ts=Date.now(); addMemory(r.memoria); S.state.reviews.push(r); saveState(); render(); }); }

/* ===== DIÁRIO ===== */
VIEWS.history=()=>{ const f=S.histFilter||''; const list=S.entries.filter(e=>!f||e.type===f);
  const lab={checkin:'Check-in',pre:'Pré-jogo',post:'Jogo',practice:'Treino'};
  return `${backBtn()}<h1 class="mb">Diário</h1><div class="chips">${[['','Tudo'],['post','Jogos'],['practice','Treinos'],['pre','Pré-jogo'],['checkin','Check-ins']].map(([k,l])=>`<button class="${f===k?'on':''}" onclick="S.histFilter='${k}';render()">${l}</button>`).join('')}</div>
  ${list.length?list.map(e=>{ const sub= e.type==='checkin'?`confiança ${e.confianca} · calma ${e.calma}`: e.type==='pre'?`vs ${esc(e.opp||'?')}`: e.type==='post'?`vs ${esc(e.opp||'?')} · ${esc(e.score||'')}`:esc(e.what||'');
    return `<div class="card tap" onclick="go('entry','${e.id}')"><div class="row between"><div><b>${lab[e.type]}</b> <span class="muted">· ${fmtDate(e.ts)}</span><div class="sec small">${sub}${mentalIndex(e)?` · índice ${mentalIndex(e).toFixed(1)}`:''}</div></div>${e.result?`<span class="pill ${e.result==='vitória'?'win':'loss'}">${e.result}</span>`:''}</div></div>`; }).join(''):'<div class="empty">Ainda não há registos.</div>'}`; };

/* ===== DEFINIÇÕES ===== */
VIEWS.settings=()=>`${backBtn()}<h1 class="mb">Definições</h1>
  <div class="card"><div class="eyebrow">Perfil</div><p class="sec small" style="margin-top:0">${esc(profileText())}</p><button class="btn ghost small" onclick="S.ob=clone(S.profile);S.obStep=1;S.view='onboarding';render()">Refazer perfil e avaliação</button></div>
  <div class="card"><div class="eyebrow">Foco da semana</div><input type="text" id="wf" value="${esc(S.profile.weekFocus||'')}" placeholder="vazio = o coach sugere"><button class="btn ghost small mt" onclick="S.profile.weekFocus=$('#wf').value.trim();saveProfile();toast('Guardado ✓')">Guardar</button></div>
  <div class="card"><div class="eyebrow">Palavras-chave</div><input type="text" id="cuesIn" value="${esc((S.profile.cues||[]).join(', '))}"><button class="btn ghost small mt" onclick="S.profile.cues=$('#cuesIn').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,5);saveProfile();toast('Guardado ✓')">Guardar</button></div>
  <div class="card"><div class="eyebrow">Voz nas sessões guiadas</div>${seg('voice',[['1','Ligada'],['0','Desligada']],S.profile.voice?'1':'0','setVoice')}<p class="hint">Usa a voz em português do teu telemóvel.</p></div>
  <div class="card"><div class="eyebrow">Lembrete diário</div><p class="muted small" style="margin-top:0">A app não envia notificações, mas podes adicionar um lembrete diário ao teu calendário.</p>
    <div class="row"><input type="time" id="remT" value="${esc(S.profile.reminder||'19:00')}"><button class="btn small" id="remBtn" onclick="makeReminder()">Adicionar ao calendário</button></div></div>
  <div class="card"><div class="eyebrow">Dados</div><p class="muted small" style="margin-top:0">${S.mode==='cloud'?'Os teus dados ficam guardados de forma privada na tua conta Claude e sincronizam entre dispositivos.':'Os dados estão guardados só neste navegador.'}</p>
    <div class="grid2"><button class="btn ghost small" onclick="exportData()">Copiar cópia (JSON)</button><button class="btn ghost small" onclick="confirmBox('Apagar TODOS os dados? Não dá para desfazer.',resetAll)">Apagar tudo</button></div></div>`;
function setVoice(v){ S.profile.voice=v==='1'; saveProfile(); }
async function makeReminder(){
  const t=$('#remT').value||'19:00'; S.profile.reminder=t; saveProfile();
  const [hh,mm]=t.split(':'); const d=new Date(); const ymd=d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ponto a Ponto//PT','BEGIN:VEVENT','UID:pap-'+uid()+'@pontoaponto','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z',`DTSTART;TZID=Europe/Lisbon:${ymd}T${hh}${mm}00`,'DURATION:PT10M','RRULE:FREQ=DAILY','SUMMARY:🎾 Ponto a Ponto — treino mental','DESCRIPTION:Check-in\\, lição e treino mental do dia.','BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Treino mental','TRIGGER:PT0M','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  if(!DOWNLOADS){ return toast('Descarregar ficheiros não está disponível nesta vista.',4000); }
  try{ await DOWNLOADS.save({filename:'ponto-a-ponto-lembrete.ics',data:ics,mimeType:'text/calendar'}); toast('Abre o ficheiro para o adicionar ao calendário.',4000); }catch(e){ toast('Download cancelado.'); }
}
async function exportData(){ try{ await navigator.clipboard.writeText(JSON.stringify({profile:S.profile,state:S.state,entries:S.entries},null,1)); toast('Copiado ✓'); }catch(e){ toast('Não consegui copiar.'); } }
async function resetAll(){
  const ids=S.entries.map(e=>e.id);
  S.profile={...DEFAULT_PROFILE}; S.state=clone(DEFAULT_STATE); S.entries=[]; S.chat=[]; cacheLocal();
  if(S.mode==='cloud'){ enqueue('profile',()=>profileRef().set(clone(S.profile))); enqueue('state',()=>stateRef().set(clone(S.state))); enqueue('chat',()=>chatRef().set({messages:[]})); ids.forEach(id=>enqueue('e'+id,()=>entriesCol().doc(id).delete())); }
  S.view='onboarding'; S.obStep=0; S.ob=null; render(); toast('Dados apagados');
}

/* ===== CHARTS ===== */
function radar(el,series){
  if(!el) return; const W=Math.min(el.clientWidth||320,360), H=W-20, cx=W/2, cy=H/2, R=Math.min(W/2-70,H/2-28), n=PK.length;
  const pt=(i,v)=>{ const a=-Math.PI/2+i*2*Math.PI/n; return [cx+Math.cos(a)*R*v/10, cy+Math.sin(a)*R*v/10]; };
  let g=''; [2.5,5,7.5,10].forEach(v=>{ g+=`<polygon points="${PK.map((_,i)=>pt(i,v).join(',')).join(' ')}" fill="none" stroke="#2f2f2c" stroke-width="1"/>`; });
  PK.forEach((k,i)=>{ const [x,y]=pt(i,10); g+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#2f2f2c"/>`; const [lx,ly]=pt(i,11.8); const anchor=Math.abs(lx-cx)<8?'middle':lx>cx?'start':'end'; const nm=PN[k].replace('Controlo emocional','Emoções').replace('Reset e resiliência','Reset').replace('Linguagem corporal','Corpo').replace('Diálogo interno','Diálogo'); g+=`<text x="${lx}" y="${ly+4}" text-anchor="${anchor}" fill="#c3c2b7" font-size="11.5">${nm}</text>`; });
  series.forEach(s=>{ const vals=PK.map(k=>s.values[k]||0); if(!vals.some(Boolean)) return; const pts=vals.map((v,i)=>pt(i,v).join(',')).join(' ');
    g+=`<polygon points="${pts}" fill="${s.dash?'none':s.color}" fill-opacity="${s.dash?0:.18}" stroke="${s.color}" stroke-width="2" ${s.dash?'stroke-dasharray="4 4"':''} stroke-linejoin="round"/>`;
    if(!s.dash) vals.forEach((v,i)=>{ const [x,y]=pt(i,v); g+=`<circle cx="${x}" cy="${y}" r="4" fill="${s.color}" stroke="#1a1a19" stroke-width="2"><title>${PN[PK[i]]}: ${v.toFixed(1)}</title></circle>`; }); });
  el.innerHTML=`<svg width="${W}" height="${H}" style="display:block;margin:0 auto;overflow:visible" role="img" aria-label="Perfil mental">${g}</svg>`;
}
function lineChart(el,series,opts={}){
  if(!el) return; const W=el.clientWidth||320,H=170,pl=30,pr=12,pt=14,pb=24, n=Math.max(...series.map(s=>s.values.length)); if(n<1) return;
  const mn=opts.min??1, mx=opts.max??10, fmt=opts.fmt||(v=>(+v).toFixed(1));
  const x=i=> n===1? pl+(W-pl-pr)/2 : pl+i*(W-pl-pr)/(n-1), y=v=> pt+(mx-v)*(H-pt-pb)/(mx-mn);
  let g=''; const ticks=[mn,mn+(mx-mn)/3,mn+2*(mx-mn)/3,mx].map(v=>Math.round(v*10)/10);
  ticks.forEach(v=>{ g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="#2f2f2c"/><text x="${pl-8}" y="${y(v)+4}" fill="#8d8c84" font-size="10" text-anchor="end">${(mx-mn)<6?v.toFixed(1):Math.round(v)}</text>`; });
  const labels=opts.labels||[]; [0,n-1].forEach(i=>{ if(labels[i]) g+=`<text x="${x(i)}" y="${H-6}" fill="#8d8c84" font-size="10" text-anchor="${i===0?'start':'end'}">${labels[i]}</text>`; });
  let p=''; series.forEach(s=>{ const pts=s.values.map((v,i)=>v==null?null:[x(i),y(v)]).filter(Boolean);
    p+=`<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(q=>q.join(',')).join(' ')}"/>`;
    pts.forEach(([a,b])=>{ p+=`<circle cx="${a}" cy="${b}" r="4" fill="${s.color}" stroke="#1a1a19" stroke-width="2"/>`; }); });
  let hits=''; const w=(W-pl-pr)/Math.max(1,n-1); for(let i=0;i<n;i++) hits+=`<rect x="${x(i)-w/2}" y="0" width="${w}" height="${H}" fill="transparent" data-i="${i}"/>`;
  el.innerHTML=`<svg width="${W}" height="${H}" role="img">${g}${p}<line class="xh" y1="${pt}" y2="${H-pb}" stroke="#8d8c84" stroke-dasharray="3 3" style="display:none"/>${hits}</svg><div class="tip"></div>`;
  const tip=el.querySelector('.tip'), xh=el.querySelector('.xh');
  const show=i=>{ xh.setAttribute('x1',x(i)); xh.setAttribute('x2',x(i)); xh.style.display=''; tip.style.display='block'; tip.style.left=Math.min(Math.max(x(i),70),W-70)+'px'; tip.style.top=Math.min(...series.map(s=>s.values[i]!=null?y(s.values[i]):H))+'px'; tip.innerHTML=`<b>${labels[i]||''}</b><br>`+series.map(s=>`${s.name}: ${s.values[i]!=null?fmt(s.values[i]):'–'}`).join('<br>')+(opts.extra?opts.extra(i):''); };
  el.querySelectorAll('rect[data-i]').forEach(r=>{ r.addEventListener('pointerenter',()=>show(+r.dataset.i)); r.addEventListener('click',()=>show(+r.dataset.i)); });
  el.addEventListener('pointerleave',()=>{ tip.style.display='none'; xh.style.display='none'; });
}
function heatColor(l){ return ['#232321','rgba(57,135,229,.35)','rgba(57,135,229,.65)','#3987e5'][l]; }
function heatmap(el){
  if(!el) return; const cnt={}; S.entries.forEach(e=>{const k=dayKey(e.ts);cnt[k]=(cnt[k]||0)+1;}); Object.entries(S.state.days).forEach(([k,d])=>{ cnt[k]=(cnt[k]||0)+Object.keys(d.done||{}).length; });
  const today=new Date(); const start=new Date(today); start.setDate(start.getDate()-((today.getDay()+6)%7)-49);
  let cols=''; for(let w=0;w<8;w++){ let c=''; for(let d=0;d<7;d++){ const dt=new Date(start); dt.setDate(start.getDate()+w*7+d); const k=dayKey(dt), v=cnt[k]||0, lvl=v===0?0:v<2?1:v<4?2:3; c+=`<i style="background:${dt>today?'transparent':heatColor(lvl)}" title="${k}: ${v}"></i>`; } cols+=`<div class="col">${c}</div>`; }
  el.innerHTML=`<div class="heatwrap"><div class="dl"><span>S</span><span></span><span>Q</span><span></span><span>S</span><span></span><span>D</span></div><div class="heat" style="flex:1">${cols}</div></div>`;
}

/* ===== arranque ===== */
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='chatIn'){ e.preventDefault(); sendChat(); } });
try{ speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged=()=>{}; }catch(e){}
initStore();
