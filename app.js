'use strict';
/* Budget Couple — v3 des données. Supabase = source de vérité ; localStorage = cache/sauvegarde. */
const KEY='budget-couple-data',CFG='budget-couple-cfg',DATA_VERSION=3;
const blank=()=>({version:DATA_VERSION,names:{p1:'Emilien',p2:'Julie'},ratio:50,months:[],goals:[],fixed:[],transfer:{from:'p2',amount:0,label:'Virement loyer'},budget:{},misc:[],placements:[],incomes:[],updated:0});
/* ---------- Migration versionnée (rétrocompatible) ----------
   v1 (sans champ version) / v2 : charges fixes avec payer p1|p2|common
   v3 : charges avec split (% payé par la personne 1), revenus (incomes)   */
const MIGRATIONS={
  3(d){d.fixed=(d.fixed||[]).map(f=>{if(typeof f.split!=='number'){f.split=f.payer==='p1'?100:f.payer==='p2'?0:(typeof d.ratio==='number'?d.ratio:50)}return f});
       d.incomes=d.incomes||[];return d}
};
function migrate(raw){
  let d=JSON.parse(JSON.stringify(raw||{}));let v=d.version||1;
  for(let t=v+1;t<=DATA_VERSION;t++)if(MIGRATIONS[t])d=MIGRATIONS[t](d);
  d=Object.assign(blank(),d);d.names=Object.assign(blank().names,d.names);d.version=DATA_VERSION;
  ['months','goals','fixed','misc','placements','incomes'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});
  d.fixed.forEach(f=>f.payer=f.split>=100?'p1':f.split<=0?'p2':'common'); // champ conservé pour les anciennes versions
  return d;
}
let D=migrate(JSON.parse(localStorage.getItem(KEY)||'{}'));
let cfg=JSON.parse(localStorage.getItem(CFG)||'{}');
let tab='revenus',budgetSeg='fixes',animate=true;
const $=s=>document.querySelector(s),uid=()=>Math.random().toString(36).slice(2,10);
const eur=n=>(+n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=k=>k==='p1'?D.names.p1:k==='p2'?D.names.p2:'Commun';
const COL={p1:'var(--p1)',p2:'var(--p2)',common:'var(--com)'};
const curMonth=()=>new Date().toISOString().slice(0,7);
const monthLabel=m=>new Date(m+'-01T12:00').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
const num=v=>parseFloat(String(v??'').replace(/\s/g,'').replace(',','.'))||0;
const fd=f=>Object.fromEntries(new FormData(f));
const r2=x=>Math.round(x*100)/100;
function save(push=true){D.updated=Date.now();localStorage.setItem(KEY,JSON.stringify(D));animate=false;render();if(push)pushRemote()}
function del(list,id){D[list]=D[list].filter(x=>x.id!==id);closeSheet();save()}
const ownerOpts=(sel,withCommon=true)=>['p1','p2',...(withCommon?['common']:[])].map(k=>`<option value="${k}" ${k===sel?'selected':''}>${esc(N(k))}</option>`).join('');
function on(sel,ev,fn){const e=$(sel);if(e)e.addEventListener(ev,fn)}
const haptic=()=>{try{navigator.vibrate&&navigator.vibrate(8)}catch{}};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
/* ---------- Icônes SVG ---------- */
const P={
 wallet:'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2 M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4',
 home:'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
 piggy:'M19 10c1 .6 1.5 1.3 1.5 2H22v3h-1.8a7 7 0 0 1-2.2 2.4V20h-3v-1.4a8 8 0 0 1-4 0V20H8v-2.6A6.5 6.5 0 0 1 11 6h3l4-2v4.6z M15.5 10.5h.01',
 target:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
 trend:'M22 7 13.5 15.5 8.5 10.5 2 17 M16 7h6v6',
 settings:'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
 plus:'M12 5v14 M5 12h14', x:'M18 6 6 18 M6 6l12 12', edit:'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
 trash:'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6', share:'M4 12v8h16v-8 M16 6l-4-4-4 4 M12 2v13', copy:'M8 8h12v12H8z M4 16V4h12',
 link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
 cart:'M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6 M9 21h.01 M18 21h.01',
 repeat:'M17 2l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3',
 swap:'M7 16V4 M3 8l4-4 4 4 M17 8v12 M21 16l-4 4-4-4', alert:'M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
 cloud:'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z', down:'M12 5v14 M19 12l-7 7-7-7', calendar:'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4'
};
const ic=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;
/* ---------- Petits composants ---------- */
const money=(v,cls='')=>`<span class="num ${cls}" data-v="${r2(v)}">${eur(v)}</span>`;
const bar=(p,cls='')=>`<div class="bar ${cls}"><i data-w="${Math.max(0,Math.min(100,p))}" style="width:${animate&&!reduced()?0:Math.max(0,Math.min(100,p))}%"></i></div>`;
const empty=(icon,t)=>`<div class="empty">${ic(icon,28)}<p>${t}</p></div>`;
const sec=(title,action='')=>`<div class="sec"><h2>${title}</h2>${action}</div>`;
const addBtn=(id,label='Ajouter')=>`<button class="chip-btn" id="${id}">${ic('plus',16)}${label}</button>`;
const splitBar=s=>`<div class="split"><i style="width:${s}%;background:var(--p1)"></i><i style="width:${100-s}%;background:var(--p2)"></i></div>`;
/* ---------- Calculs revenus / charges ---------- */
let revMonth=curMonth();
const share=(k,s)=>k==='p1'?s/100:1-s/100;
const incomeOf=(k,m)=>D.incomes.filter(i=>i.person===k&&(i.recurring||i.month===m)).reduce((s,i)=>s+i.amount,0);
const chargesOf=k=>D.fixed.reduce((s,f)=>s+f.amount*share(k,f.split),0);
const savingOf=(k,m)=>{const e=D.months.find(x=>x.month===m);return e?(k==='p1'?e.a:e.b):0};
const miscOf=(k,m)=>D.misc.filter(x=>x.date.startsWith(m)).reduce((s,x)=>s+x.amount*(x.payer==='common'?share(k,D.ratio):x.payer===k?1:0),0);
function summary(k,m){const rev=incomeOf(k,m),ch=chargesOf(k),ep=savingOf(k,m),mi=miscOf(k,m);return{rev,ch,ep,mi,rest:rev-ch-ep,pct:rev?ep/rev*100:0}}
/* ---------- Onglet Revenus ---------- */
function vRevenus(){
  const m=revMonth,a=summary('p1',m),b=summary('p2',m),c={rev:a.rev+b.rev,ch:a.ch+b.ch,ep:a.ep+b.ep,mi:a.mi+b.mi};c.rest=c.rev-c.ch-c.ep;c.pct=c.rev?c.ep/c.rev*100:0;
  const person=(k,s)=>`<div class="card pcard" style="--pc:${COL[k]}"><div class="pname"><span class="dot"></span>${esc(N(k))}</div>
    <div class="kv"><span>Revenus</span>${money(s.rev)}</div><div class="kv"><span>Charges</span>${money(-s.ch,'neg')}</div><div class="kv"><span>Épargne</span>${money(-s.ep,'acc')}</div>
    <div class="kv big"><span>Reste à vivre</span>${money(s.rest,s.rest<0?'neg':'')}</div>${bar(s.pct*2,'thin')}<div class="mut">${s.pct.toFixed(0)} % épargné</div></div>`;
  const lines=k=>{const L=D.incomes.filter(i=>i.person===k&&(i.recurring||i.month===m));return L.map(i=>`<button class="item" data-edit-income="${i.id}"><span class="avatar" style="--pc:${COL[k]}">${ic(i.recurring?'repeat':'calendar',16)}</span>
    <span class="grow"><b>${esc(i.label)}</b><small>${esc(N(k))} · ${i.recurring?'Chaque mois':'Ponctuel · '+monthLabel(i.month)}</small></span>${money(i.amount,'pos')}</button>`).join('')};
  return `<div class="monthbar"><input type="month" id="revMonth" value="${m}" aria-label="Mois"></div>
  <div class="card hero"><small>Reste à vivre du couple · ${monthLabel(m)}</small><div class="hero-n">${money(c.rest,c.rest<0?'neg':'')}</div>
   <div class="hero-grid"><div><small>Revenus</small>${money(c.rev)}</div><div><small>Charges</small>${money(c.ch)}</div><div><small>Épargne</small>${money(c.ep)}</div><div><small>Taux d’épargne</small><span class="num">${c.pct.toFixed(0)} %</span></div></div>
   ${c.mi?`<p class="mut">Dont déjà dépensé en dépenses diverses : ${eur(c.mi)} · reste ${eur(c.rest-c.mi)}</p>`:''}</div>
  <div class="two">${person('p1',a)}${person('p2',b)}</div>
  ${sec('Revenus du mois',addBtn('addIncome'))}<div class="list">${lines('p1')+lines('p2')||empty('wallet','Ajoute vos salaires, primes et autres revenus.')}</div>`;
}
function incomeSheet(id){const i=D.incomes.find(x=>x.id===id)||{person:'p1',type:'salaire',recurring:true,month:revMonth};
  openSheet(id?'Modifier le revenu':'Nouveau revenu',`<form id="fIncome">
   <div class="seg seg-sm" role="radiogroup">${['p1','p2'].map(k=>`<label><input type="radio" name="person" value="${k}" ${i.person===k?'checked':''}><span>${esc(N(k))}</span></label>`).join('')}</div>
   <label>Type<select name="type">${[['salaire','Salaire'],['prime','Prime'],['autre','Autre']].map(([v,l])=>`<option value="${v}" ${i.type===v?'selected':''}>${l}</option>`).join('')}</select></label>
   <label>Libellé<input name="label" value="${esc(i.label||'')}" placeholder="ex. Salaire net" required></label>
   <label>Montant mensuel (€)<input name="amount" inputmode="decimal" value="${i.amount??''}" required></label>
   <div class="seg seg-sm">${[['1','Récurrent'],['0','Ponctuel']].map(([v,l])=>`<label><input type="radio" name="recurring" value="${v}" ${(i.recurring?'1':'0')===v?'checked':''}><span>${l}</span></label>`).join('')}</div>
   <label id="incMonthL" ${i.recurring?'hidden':''}>Mois concerné<input type="month" name="month" value="${i.month||revMonth}"></label>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="incomes|${id}">${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>{
    $('#fIncome').addEventListener('change',e=>{if(e.target.name==='recurring')$('#incMonthL').hidden=e.target.value==='1'});
    $('#fIncome').addEventListener('submit',e=>{e.preventDefault();const f=fd(e.target),o={id:id||uid(),person:f.person,type:f.type,label:f.label,amount:num(f.amount),recurring:f.recurring==='1',month:f.recurring==='1'?null:f.month};
      if(id)Object.assign(i,o);else D.incomes.push(o);closeSheet();save()})})}
/* ---------- Onglet Budget (charges fixes + dépenses diverses) ---------- */
function vBudget(){
  return `<div class="seg" id="budgetSeg">${[['fixes','Charges fixes'],['diverses','Dépenses diverses']].map(([v,l])=>`<button data-seg="${v}" class="${budgetSeg===v?'on':''}">${l}</button>`).join('')}<span class="seg-ind" style="transform:translateX(${budgetSeg==='fixes'?0:100}%)"></span></div>`+
   (budgetSeg==='fixes'?vFixes():vDiverses());
}
function vFixes(){
  const total=D.fixed.reduce((s,f)=>s+f.amount,0),c1=chargesOf('p1'),c2=chargesOf('p2'),t=D.transfer,to=t.from==='p1'?'p2':'p1';
  const L=[...D.fixed].sort((a,b)=>(a.day||99)-(b.day||99));
  return `<div class="card hero"><small>Charges fixes mensuelles</small><div class="hero-n">${money(total)}</div>
   <div class="two-k"><div style="--pc:var(--p1)"><small><span class="dot"></span>${esc(D.names.p1)}</small>${money(c1)}</div><div style="--pc:var(--p2)"><small><span class="dot"></span>${esc(D.names.p2)}</small>${money(c2)}</div></div>
   ${splitBar(total?c1/total*100:50)}</div>
  <button class="card item transfer" id="editTransfer"><span class="avatar">${ic('swap',18)}</span><span class="grow"><b>${esc(t.label||'Virement')}</b>
   <small>${t.amount?`${esc(N(t.from))} → ${esc(N(to))} chaque mois`:'Aucun virement entre vous · toucher pour configurer'}</small></span>${t.amount?money(t.amount):''}</button>
  ${sec('Charges',addBtn('addFixed'))}<div class="list">${L.map(f=>`<button class="item" data-edit-fixed="${f.id}"><span class="day">${f.day||'—'}</span>
   <span class="grow"><b>${esc(f.label)}</b><small>${esc(D.names.p1)} ${f.split} % · ${esc(D.names.p2)} ${100-f.split} %</small>${splitBar(f.split)}</span>${money(f.amount)}</button>`).join('')||empty('home','Aucune charge fixe pour l’instant.')}</div>`;
}
function fixedSheet(id){const f=D.fixed.find(x=>x.id===id)||{split:D.ratio};
  openSheet(id?'Modifier la charge':'Nouvelle charge',`<form id="fFixed">
   <label>Libellé<input name="label" value="${esc(f.label||'')}" placeholder="ex. Loyer" required></label>
   <div class="f2"><label>Montant (€)<input name="amount" inputmode="decimal" value="${f.amount??''}" required></label>
   <label>Jour de prélèvement<input name="day" type="number" min="1" max="31" value="${f.day||''}" placeholder="1"></label></div>
   <label>Qui paie ?<div class="range-l"><span style="color:var(--p1)">${esc(D.names.p1)} <b id="sp1">${f.split}</b> %</span><span style="color:var(--p2)"><b id="sp2">${100-f.split}</b> % ${esc(D.names.p2)}</span></div>
    <input type="range" name="split" min="0" max="100" step="5" value="${f.split}" class="range" style="--v:${f.split}%"></label>
   <div class="presets">${[100,70,50,30,0].map(v=>`<button type="button" data-preset="${v}">${v}/${100-v}</button>`).join('')}<button type="button" data-preset="${D.ratio}">Réglage</button></div>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="fixed|${id}">${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>{
   const R=$('#fFixed [name=split]'),upd=()=>{R.style.setProperty('--v',R.value+'%');$('#sp1').textContent=R.value;$('#sp2').textContent=100-R.value};
   R.addEventListener('input',upd);document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{haptic();R.value=b.dataset.preset;upd()});
   $('#fFixed').addEventListener('submit',e=>{e.preventDefault();const v=fd(e.target),s=Math.max(0,Math.min(100,parseInt(v.split)));
    const o={id:id||uid(),label:v.label,amount:num(v.amount),day:parseInt(v.day)||0,split:s,payer:s>=100?'p1':s<=0?'p2':'common'};
    if(id)Object.assign(f,o);else D.fixed.push(o);closeSheet();save()})})}
function transferSheet(){const t=D.transfer;openSheet('Virement entre vous',`<form id="fTransfer">
   <label>Libellé<input name="label" value="${esc(t.label)}"></label>
   <div class="f2"><label>De<select name="from">${ownerOpts(t.from,false)}</select></label><label>Montant (€)<input name="amount" inputmode="decimal" value="${t.amount||''}" placeholder="0"></label></div>
   <p class="mut">Informatif : indique le virement mensuel de l’un vers l’autre (ex. part du loyer).</p><button class="btn">Enregistrer</button></form>`,()=>
   $('#fTransfer').addEventListener('submit',e=>{e.preventDefault();const f=fd(e.target);D.transfer={label:f.label,from:f.from,amount:num(f.amount)};closeSheet();save()}))}
function vDiverses(){
  const m=D.miscMonth||curMonth(),b=D.budget[m]||0,L=D.misc.filter(x=>x.date.startsWith(m)).sort((a,c)=>c.date.localeCompare(a.date));
  const spent=L.reduce((s,x)=>s+x.amount,0);
  return `<div class="monthbar"><input type="month" id="miscMonth" value="${m}" aria-label="Mois"></div>
  <div class="card hero"><small>Restant sur le budget</small><div class="hero-n">${money(b-spent,b-spent<0?'neg':'')}</div>
   ${bar(b?spent/b*100:0,spent>b&&b?'over':'')}<div class="hero-grid"><div><small>Dépensé</small>${money(spent)}</div>
   <div><small>Budget disponible</small><input id="budgetIn" class="inline" inputmode="decimal" value="${b||''}" placeholder="0 €"></div></div></div>
  ${sec('Dépenses du mois',addBtn('addMisc'))}<div class="list">${L.map(x=>`<div class="item"><span class="avatar" style="--pc:${COL[x.payer]}">${ic('cart',16)}</span>
   <span class="grow"><b>${esc(x.label)}</b><small>${new Date(x.date+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} · ${esc(N(x.payer))}</small></span>${money(x.amount)}
   <button class="icon-btn" data-del="misc|${x.id}" aria-label="Supprimer">${ic('trash',16)}</button></div>`).join('')||empty('cart','Aucune dépense ce mois-ci.')}</div>`;
}
function miscSheet(){const m=D.miscMonth||curMonth();openSheet('Nouvelle dépense',`<form id="fMisc">
   <label>Libellé<input name="label" placeholder="ex. Courses" required></label>
   <div class="f2"><label>Montant (€)<input name="amount" inputmode="decimal" required></label><label>Date<input type="date" name="date" value="${m===curMonth()?new Date().toISOString().slice(0,10):m+'-01'}" required></label></div>
   <label>Payé par<select name="payer">${ownerOpts('common')}</select></label><button class="btn">Ajouter</button></form>`,()=>
   $('#fMisc').addEventListener('submit',e=>{e.preventDefault();const f=fd(e.target);D.misc.push({id:uid(),date:f.date,label:f.label,amount:num(f.amount),payer:f.payer});closeSheet();save()}))}
/* ---------- Onglet Épargne ---------- */
const gName=id=>(D.goals.find(g=>g.id===id)||{name:'?'}).name;
function allocHtml(r,k){if(!r)return'';const e=Object.entries(r.alloc).filter(([,v])=>v>0);
  return `<div class="alloc"><b style="color:${COL[k]}">${esc(N(k))}${r.manual?' · manuel':''}</b>${e.map(([g,v])=>`<span class="pill">${esc(gName(g))} ${eur(v)}</span>`).join('')||'<span class="mut">—</span>'}${r.unassigned>0.004?`<span class="pill warn">Non affecté ${eur(r.unassigned)}</span>`:''}</div>`}
function vEpargne(){
  const m=[...D.months].sort((a,b)=>b.month.localeCompare(a.month)),C=compute();
  const t1=m.reduce((s,x)=>s+x.a,0),t2=m.reduce((s,x)=>s+x.b,0);
  const un=Object.values(C.res).reduce((s,r)=>s+(r.p1?.unassigned||0)+(r.p2?.unassigned||0),0);
  return `<div class="card hero"><small>Épargne cumulée du couple</small><div class="hero-n">${money(t1+t2)}</div>
   <div class="two-k"><div style="--pc:var(--p1)"><small><span class="dot"></span>${esc(D.names.p1)}</small>${money(t1)}</div><div style="--pc:var(--p2)"><small><span class="dot"></span>${esc(D.names.p2)}</small>${money(t2)}</div></div>
   ${splitBar(t1+t2?t1/(t1+t2)*100:50)}${un>0?`<p class="warn-t">${ic('alert',14)} ${eur(un)} non affecté à un objectif</p>`:''}</div>
  <button class="btn wide" id="addMonth">${ic('plus',18)} Saisir l’épargne d’un mois</button>
  ${sec('Historique des affectations')}<div class="list">${m.map(x=>`<button class="item col" data-edit-month="${x.id}"><span class="row-b"><b>${monthLabel(x.month)}</b>${money(x.a+x.b)}</span>
   <small>${esc(D.names.p1)} ${eur(x.a)} · ${esc(D.names.p2)} ${eur(x.b)}</small>${allocHtml(C.res[x.id].p1,'p1')}${allocHtml(C.res[x.id].p2,'p2')}</button>`).join('')||empty('piggy','Aucun mois saisi. Commence par ajouter tes objectifs.')}</div>`;
}
function monthSheet(id,draft){
  const ed=D.months.find(x=>x.id===id),e=draft||ed||{month:curMonth(),a:'',b:''},manual=draft?!!draft.manual:!!ed?.manual;
  const manIn=k=>D.goals.filter(g=>g.owner===k||g.owner==='common').map(g=>`<label>${esc(g.name)}<input data-man="${k}|${g.id}" inputmode="decimal" placeholder="0" value="${e.manual?.[k]?.[g.id]??''}"></label>`).join('')||'<span class="mut">Aucun objectif</span>';
  openSheet(ed?'Modifier le mois':'Épargne du mois',`<form id="fMonth">
   <label>Mois<input type="month" name="month" value="${e.month}" required></label>
   <div class="f2"><label>${esc(D.names.p1)} (€)<input name="a" inputmode="decimal" placeholder="0" value="${e.a||''}"></label><label>${esc(D.names.p2)} (€)<input name="b" inputmode="decimal" placeholder="0" value="${e.b||''}"></label></div>
   <label class="switch"><input type="checkbox" id="manualChk" ${manual?'checked':''}><span></span>Répartition manuelle</label>
   ${manual?`<div class="f2"><div class="stack"><b style="color:var(--p1)">${esc(D.names.p1)}</b>${manIn('p1')}</div><div class="stack"><b style="color:var(--p2)">${esc(D.names.p2)}</b>${manIn('p2')}</div></div>`:''}
   <div id="preview" class="preview"></div>
   <button class="btn">${ed?'Valider la modification':'Valider la répartition'}</button>${ed?`<button type="button" class="btn danger" data-del="months|${ed.id}">${ic('trash',16)} Supprimer ce mois</button>`:''}</form>`,()=>{
   const F=$('#fMonth'),entry=()=>{const v=fd(F),o={id:id||'__preview',month:v.month||curMonth(),a:num(v.a),b:num(v.b)};
     if($('#manualChk').checked){o.manual={p1:{},p2:{}};document.querySelectorAll('[data-man]').forEach(i=>{const [k,g]=i.dataset.man.split('|');if(num(i.value))o.manual[k][g]=num(i.value)})}return o};
   const prev=()=>{const p=$('#preview');if(!D.goals.length){p.innerHTML='<span class="mut">Ajoute des objectifs pour activer la répartition automatique.</span>';return}
     const o=entry(),r=compute(o).res[o.id];p.innerHTML='<small>Aperçu de la répartition</small>'+allocHtml(r.p1,'p1')+allocHtml(r.p2,'p2')};
   F.addEventListener('input',prev);prev();
   $('#manualChk').addEventListener('change',ev=>{const o=entry();if(ev.target.checked)o.manual=o.manual||{p1:{},p2:{}};else delete o.manual;monthSheet(id,o)});
   F.addEventListener('submit',ev=>{ev.preventDefault();const o=entry();if(o.manual===undefined)delete o.manual;
     const ex=ed||D.months.find(x=>x.month===o.month);
     if(ex){ex.month=o.month;ex.a=o.a;ex.b=o.b;if(o.manual)ex.manual=o.manual;else delete ex.manual;D.months=D.months.filter(x=>x===ex||x.month!==ex.month)}
     else{o.id=uid();D.months.push(o)}closeSheet();save()})})}
/* ---------- Onglet Objectifs ---------- */
function vObjectifs(){
  const C=compute(),cm=curMonth();
  return `${sec('Objectifs',addBtn('addGoal'))}`+['common','p1','p2'].map(g=>{const L=D.goals.filter(x=>x.owner===g);if(!L.length)return'';
   return `<h3 class="group"><span class="dot" style="--pc:${COL[g]}"></span>${esc(g==='common'?'Communs':N(g))}</h3>`+L.map(x=>{
    const sv=C.saved[x.id],rest=Math.max(0,x.target-sv),p=x.target?Math.min(100,sv/x.target*100):0,mo=x.date?monthsBetween(cm,x.date):0,c=C.contrib[x.id];
    return `<button class="card goal" data-edit-goal="${x.id}" style="--pc:${COL[g]}"><span class="row-b"><b>${esc(x.name)}</b><span class="pct">${p.toFixed(0)} %</span></span>
     ${bar(p,p>=100?'done':'')}<span class="row-b"><span>${money(sv)} <small class="mut">/ ${eur(x.target)}</small></span><small class="mut">reste ${eur(rest)}</small></span>
     ${mo&&rest>0?`<small class="mut">${ic('calendar',13)} ${eur(rest/mo)}/mois pendant ${mo} mois (${monthLabel(x.date)})</small>`:''}
     <span class="contrib"><span style="color:var(--p1)">${esc(D.names.p1)} ${eur(c.p1)}</span><span style="color:var(--p2)">${esc(D.names.p2)} ${eur(c.p2)}</span>${x.saved?`<span class="mut">initial ${eur(x.saved)}</span>`:''}</span></button>`}).join('')}).join('')+
  (D.goals.length?`<p class="mut note">L’épargne de chaque mois est répartie automatiquement entre les objectifs perso et communs, au prorata du besoin mensuel (reste ÷ mois restants ; pour les objectifs communs, part de chacun selon les réglages).</p>`:empty('target','Aucun objectif pour l’instant (ex. voyage, apport, voiture).'));
}
function goalSheet(id){const g=D.goals.find(x=>x.id===id)||{owner:'common'};
  openSheet(id?'Modifier l’objectif':'Nouvel objectif',`<form id="fGoal">
   <label>Nom<input name="name" value="${esc(g.name||'')}" placeholder="ex. Voyage" required></label>
   <div class="f2"><label>Pour<select name="owner">${ownerOpts(g.owner)}</select></label><label>Date cible<input type="month" name="date" value="${g.date||''}"></label></div>
   <div class="f2"><label>Montant cible (€)<input name="target" inputmode="decimal" value="${g.target??''}" required></label><label>Déjà économisé avant (€)<input name="saved" inputmode="decimal" value="${g.saved||''}" placeholder="0"></label></div>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="goals|${id}">${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>
   $('#fGoal').addEventListener('submit',e=>{e.preventDefault();const f=fd(e.target),o={id:id||uid(),name:f.name,owner:f.owner,date:f.date,target:num(f.target),saved:num(f.saved)};
    if(id)Object.assign(g,o);else D.goals.push(o);closeSheet();save()}))}
/* ---------- Onglet Placements ---------- */
function chart(s){
  const W=340,H=180,P=8,max=Math.max(1,...s.map(x=>x.total)),X=i=>P+i*(W-2*P)/48,Y=v=>H-24-v/max*(H-44);
  const line=k=>s.map((x,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(x[k]).toFixed(1)}`).join('');
  const ticks=[12,24,36,48].map(i=>`<line x1="${X(i)}" x2="${X(i)}" y1="14" y2="${H-24}" stroke="rgba(255,255,255,.06)"/><circle cx="${X(i)}" cy="${Y(s[i].total)}" r="3.5" fill="#3ecf8e"/><text x="${X(i)}" y="${H-6}" fill="#8a93a8" font-size="11" text-anchor="${i===48?'end':'middle'}">An ${i/12}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Projection sur 4 ans"><defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ecf8e" stop-opacity=".35"/><stop offset="1" stop-color="#3ecf8e" stop-opacity="0"/></linearGradient></defs>${ticks}
   <path d="${line('total')} L${X(48)},${Y(0)} L${X(0)},${Y(0)}Z" fill="url(#gv)"/><path class="draw" pathLength="1" d="${line('total')}" stroke="#3ecf8e" stroke-width="2.5" fill="none"/><path d="${line('inv')}" stroke="#7c9cff" stroke-width="2" stroke-dasharray="5 4" fill="none"/></svg>
   <div class="legend"><span><i style="background:#3ecf8e"></i>Valeur</span><span><i style="background:#7c9cff"></i>Versé</span></div>`;
}
function vPlacements(){
  const L=D.placements,s=project(L),end=s[48];
  return `${L.length?`<div class="card hero"><small>Valeur projetée dans 4 ans</small><div class="hero-n">${money(end.total)}</div>
    <div class="hero-grid"><div><small>Versé</small>${money(end.inv)}</div><div><small>Intérêts</small>${money(end.total-end.inv,'pos')}</div></div>${chart(s)}</div>
   <div class="years">${[1,2,3,4].map(y=>{const x=s[y*12];return `<div class="card yr"><small>Fin d’année ${y}</small><b>${eur(x.total)}</b><small class="pos">+${eur(x.total-x.inv)}</small></div>`}).join('')}</div>`:''}
  ${sec('Placements',addBtn('addPlac'))}<div class="list">${L.map((x,i)=>`<button class="item" data-edit-plac="${x.id}"><span class="avatar" style="--pc:${COL[x.owner]}">${ic('trend',16)}</span>
   <span class="grow"><b>${esc(x.name)}</b><small>${eur(x.capital)} · +${eur(x.monthly)}/mois · ${x.rate} %</small></span><span class="r"><small class="mut">dans 4 ans</small>${money(s[48].vals[i])}</span></button>`).join('')||empty('trend','Ajoute un placement pour voir la projection sur 4 ans.')}</div>
  <p class="mut note">Intérêts composés mensuellement (taux annuel ÷ 12), versements permanents en fin de mois.</p>`;
}
function placSheet(id){const p=D.placements.find(x=>x.id===id)||{owner:'common'};
  openSheet(id?'Modifier le placement':'Nouveau placement',`<form id="fPlac">
   <div class="f2"><label>Nom<input name="name" value="${esc(p.name||'')}" placeholder="ex. Livret A" required></label><label>Titulaire<select name="owner">${ownerOpts(p.owner)}</select></label></div>
   <div class="f2"><label>Capital actuel (€)<input name="capital" inputmode="decimal" value="${p.capital??''}" placeholder="0"></label><label>Versement mensuel (€)<input name="monthly" inputmode="decimal" value="${p.monthly??''}" placeholder="0"></label></div>
   <label>Taux annuel (%)<input name="rate" inputmode="decimal" value="${p.rate??''}" placeholder="ex. 3"></label>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="placements|${id}">${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>
   $('#fPlac').addEventListener('submit',e=>{e.preventDefault();const f=fd(e.target),o={id:id||uid(),name:f.name,owner:f.owner,capital:num(f.capital),monthly:num(f.monthly),rate:num(f.rate)};
    if(id)Object.assign(p,o);else D.placements.push(o);closeSheet();save()}))}
/* ---------- Réglages ---------- */
function vReglages(){
  return `<div class="card"><h2>Prénoms & répartition</h2><form id="fNames">
   <div class="f2"><label>Personne 1<input name="p1" value="${esc(D.names.p1)}"></label><label>Personne 2<input name="p2" value="${esc(D.names.p2)}"></label></div>
   <label>Part de ${esc(D.names.p1)} dans les dépenses communes (%)<input name="ratio" type="number" min="0" max="100" value="${D.ratio}"></label>
   <p class="mut">Sert de valeur par défaut pour les nouvelles charges, les dépenses diverses communes et les objectifs communs.</p>
   <button class="btn">Enregistrer</button></form></div>
  <div class="card"><h2>${ic('cloud',18)} Synchronisation Supabase</h2><form id="fSync">
   <label>URL du projet<input name="url" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url||'')}"></label>
   <label>Clé publishable ou anon (publique)<input name="key" value="${esc(cfg.key||'')}"></label>
   <label>Code d’espace partagé<input name="space" value="${esc(cfg.space||'')}" placeholder="un code long et secret"></label>
   <button class="btn">Enregistrer & synchroniser</button>
   <div class="f2"><button type="button" class="btn ghost" id="inviteBtn">${ic('link',16)} Lien d’invitation</button><button type="button" class="btn ghost" id="disconnect">Désactiver</button></div></form>
   <div id="invitePanel"></div><p class="mut" id="syncMsg">${esc(lastErr)}</p></div>
  <div class="card"><h2>Sauvegarde</h2><div class="f2"><button class="btn ghost" id="exp">Exporter (JSON)</button>
   <label class="btn ghost">Importer<input type="file" id="imp" accept=".json" hidden></label></div>
   <button class="btn danger" id="reset">Tout effacer sur cet appareil</button><p class="mut">Format de données v${DATA_VERSION}</p></div>`;
}
/* ---------- Répartition automatique ---------- */
// mois entre un mois "YYYY-MM" et une date cible "YYYY-MM" (min 1) ; sans date : 12 mois
function monthsBetween(from,to){if(!to)return 12;const [y1,m1]=from.split('-').map(Number),[y2,m2]=to.split('-').map(Number);return Math.max(1,(y2-y1)*12+m2-m1)}
const shareOf=(k,g)=>g.owner==='common'?(k==='p1'?D.ratio:100-D.ratio)/100:1;
// Répartit "amount" de la personne k pour le mois "month" ; rem = reste courant par objectif (modifié)
function allocate(k,amount,month,rem){
  const out={},el=D.goals.filter(g=>(g.owner===k||g.owner==='common')&&rem[g.id]>0.004);
  let left=amount,open=[...el];
  while(left>0.004&&open.length){
    const w=open.map(g=>shareOf(k,g)*rem[g.id]/monthsBetween(month,g.date)),W=w.reduce((a,b)=>a+b,0);
    if(W<=0)break;let capped=false;
    const part=open.map((g,i)=>left*w[i]/W);
    open.forEach((g,i)=>{if(part[i]>=rem[g.id]){capped=true}});
    if(capped){ // on remplit d'abord les objectifs plafonnés puis on redistribue
      open=open.filter((g,i)=>{if(part[i]>=rem[g.id]){const v=Math.round(rem[g.id]*100)/100;out[g.id]=(out[g.id]||0)+v;left-=v;rem[g.id]=0;return false}return true});
    }else{open.forEach((g,i)=>{const v=Math.round(part[i]*100)/100;out[g.id]=(out[g.id]||0)+v;rem[g.id]=Math.round((rem[g.id]-v)*100)/100;left-=v});left=Math.round(left*100)/100;if(left<0.01)left=0}
  }
  const r2=x=>Math.round(x*100)/100;Object.keys(out).forEach(i=>out[i]=r2(out[i]));
  return{alloc:out,unassigned:r2(Math.max(0,left))};
}
// Rejoue tout l'historique chronologiquement → affectations par mois + contributions par objectif
function compute(extra){
  const rem={},contrib={};D.goals.forEach(g=>{rem[g.id]=Math.round(Math.max(0,g.target-(g.saved||0))*100)/100;contrib[g.id]={p1:0,p2:0}});
  const res={},list=[...D.months].filter(m=>!extra||m.id!==extra.id);if(extra)list.push(extra);
  list.sort((a,b)=>a.month.localeCompare(b.month)).forEach(m=>{
    res[m.id]={};[['p1','a'],['p2','b']].forEach(([k,f])=>{
      let r;if(m.manual&&m.manual[k]){const al={};let s=0;
        Object.entries(m.manual[k]).forEach(([gid,v])=>{if(rem[gid]!==undefined&&v>0){const x=Math.min(v,rem[gid]);al[gid]=x;rem[gid]=Math.round((rem[gid]-x)*100)/100;s+=x}});
        r={alloc:al,unassigned:Math.round((m[f]-s)*100)/100,manual:true}}
      else r=allocate(k,m[f]||0,m.month,rem);
      Object.entries(r.alloc).forEach(([gid,v])=>contrib[gid][k]+=v);res[m.id][k]=r})});
  return{res,contrib,saved:Object.fromEntries(D.goals.map(g=>[g.id,Math.round(((g.saved||0)+contrib[g.id].p1+contrib[g.id].p2)*100)/100]))};
}
/* ---------- Placements : projection 48 mois ---------- */
function project(list,months=48){ // intérêts composés mensuels, versement en fin de mois
  const series=[];let vals=list.map(p=>p.capital),inv=list.map(p=>p.capital);
  series.push({total:vals.reduce((a,b)=>a+b,0),inv:inv.reduce((a,b)=>a+b,0)});
  for(let m=1;m<=months;m++){vals=vals.map((v,i)=>v*(1+list[i].rate/100/12)+list[i].monthly);inv=inv.map((v,i)=>v+list[i].monthly);
    series.push({total:vals.reduce((a,b)=>a+b,0),inv:inv.reduce((a,b)=>a+b,0),vals:[...vals]})}
  return series;
}
/* ---------- Supabase (REST, sans SDK) ---------- */
const sbOn=()=>cfg.url&&cfg.key&&cfg.space;
// Nouvelles clés sb_publishable_ : uniquement dans "apikey" (pas de Bearer). Anciennes clés JWT anon : apikey + Bearer.
const sbH=()=>{const h={apikey:cfg.key,'Content-Type':'application/json'};if(!cfg.key.startsWith('sb_'))h.Authorization='Bearer '+cfg.key;return h};
function normCfg(c){const url=(c.url||'').trim().replace(/\/+$/,'').replace(/\/rest\/v1$/,'');return{url:url&&!/^https?:\/\//.test(url)?'https://'+url:url,key:(c.key||'').replace(/\s+/g,''),space:(c.space||'').trim()}}
cfg=normCfg(cfg);
let lastErr='';
async function sbErr(r){let j={};try{j=await r.json()}catch{}const m=j.message||'';
  if(r.status===404||j.code==='PGRST205'||j.code==='42P01')return'Table budget_spaces introuvable : exécutez supabase/schema.sql dans le SQL Editor de Supabase.';
  if(r.status===401||/api key|apikey|JWT/i.test(m))return'Clé refusée ('+r.status+') : vérifiez la clé publishable/anon (attention aux l/I).';
  if(r.status===403||j.code==='42501')return'Accès refusé par les politiques RLS : ré-exécutez supabase/schema.sql.';
  if(j.code==='23514')return'Code d’espace trop court (8 caractères minimum).';
  return'Erreur Supabase '+r.status+(m?' : '+m:'');}
function netErr(e){return e&&e.sb?e.sb:'Impossible de joindre '+(cfg.url||'Supabase')+' : vérifiez l’URL (projet .supabase.co complet) et la connexion.'}
function showErr(t){lastErr=t;const m=$('#syncMsg');if(m)m.textContent=t}
function setSync(t,on){const b=$('#syncState');b.querySelector('span').textContent=t;b.className='badge'+(on?' on':on===false?' err':'')}
async function pullRemote(){
  if(!sbOn())return setSync('Local');if(!navigator.onLine){setSync('Hors ligne',false);return showErr('Pas de connexion internet.')}
  try{const r=await fetch(`${cfg.url}/rest/v1/budget_spaces?code=eq.${encodeURIComponent(cfg.space)}&select=data,updated_at`,{headers:sbH()});
    if(!r.ok)throw{sb:await sbErr(r)};const [row]=await r.json();
    if(row&&row.data&&(row.data.updated||0)>(D.updated||0)){D=migrate(row.data);localStorage.setItem(KEY,JSON.stringify(D));animate=false;render()}
    else if(!row||(D.updated||0)>(row.data?.updated||0)){await pushRemote();return}
    setSync('Synchro ✓',true);showErr('Synchronisé ✓')}catch(e){setSync('Erreur synchro',false);showErr(netErr(e));console.warn('sync',e)}
}
let pt;function pushRemote(){if(!sbOn())return;clearTimeout(pt);return new Promise(res=>pt=setTimeout(async()=>{
  try{const r=await fetch(`${cfg.url}/rest/v1/budget_spaces?on_conflict=code`,{method:'POST',headers:{...sbH(),Prefer:'resolution=merge-duplicates'},body:JSON.stringify({code:cfg.space,data:D,updated_at:new Date().toISOString()})});
   if(!r.ok)throw{sb:await sbErr(r)};setSync('Synchro ✓',true);showErr('Synchronisé ✓')}catch(e){setSync('Erreur synchro',false);showErr(netErr(e));console.warn('push',e)}res()},300))}
/* ---------- Invitation ---------- */
const APP_URL='https://blood63.github.io/budget-couple/';
const b64u=s=>btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));
function inviteLink(){return APP_URL+'#invite='+b64u(JSON.stringify({v:1,url:cfg.url,key:cfg.key,space:cfg.space}))}
function showInvite(){const P=$('#invitePanel');if(!sbOn()){P.innerHTML='<p class="neg">Configurez et enregistrez d’abord la synchro.</p>';return}
  const L=inviteLink(),qr=qrcode(0,'M');qr.addData(L);qr.make();
  P.innerHTML=`<div class="invite"><b>Inviter dans l’espace « ${esc(cfg.space)} »</b>
   <p class="warn-t" style="margin:0">${ic('alert',14)} Ce lien donne accès à toutes vos données (lecture et modification). Ne l’envoyez qu’à votre partenaire, par un canal privé.</p>
   <div style="background:#fff;padding:10px;border-radius:10px;justify-self:center">${qr.createSvgTag({cellSize:4,margin:0,scalable:true}).replace('<svg ','<svg style="width:220px;height:220px;display:block" ')}</div>
   <input id="inviteLink" readonly value="${esc(L)}">
   <div class="f2"><button type="button" class="btn" id="copyInv">${ic('copy',16)} Copier</button>${navigator.share?`<button type="button" class="btn ghost" id="shareInv">${ic('share',16)} Partager</button>`:''}</div></div>`;
  on('#copyInv','click',async()=>{try{await navigator.clipboard.writeText(L)}catch{$('#inviteLink').select();document.execCommand('copy')}$('#copyInv').textContent='Copié ✓'});
  on('#shareInv','click',()=>navigator.share({title:'Budget Couple',text:'Rejoins notre espace Budget Couple :',url:L}).catch(()=>{}));
}
async function handleInvite(){const m=location.hash.match(/^#invite=([A-Za-z0-9_-]+)/);if(!m)return;
  const clear=()=>history.replaceState(null,'',location.pathname+location.search);
  let c;try{c=normCfg(JSON.parse(unb64u(m[1])))}catch{clear();alert('Lien d’invitation invalide.');return}
  if(!c.url||!c.key||!c.space){clear();alert('Lien d’invitation incomplet.');return}
  if(confirm(`Rejoindre l’espace « ${c.space} » ?\n\nLes données de cet espace seront synchronisées sur cet appareil.`)){
    cfg=c;localStorage.setItem(CFG,JSON.stringify(cfg));clear();go('reglages');await pullRemote();
  }else clear();}
/* ---------- Navigation, feuilles modales, animations ---------- */
const TABS=[['revenus','Revenus','wallet',vRevenus],['budget','Budget','home',vBudget],['epargne','Épargne','piggy',vEpargne],['objectifs','Objectifs','target',vObjectifs],['placements','Placements','trend',vPlacements]];
const views=Object.fromEntries(TABS.map(t=>[t[0],t[3]]));views.reglages=vReglages;
const titles={...Object.fromEntries(TABS.map(t=>[t[0],t[1]])),reglages:'Réglages'};
function buildNav(){$('#tabs').innerHTML=TABS.map(([k,l,i])=>`<button data-tab="${k}" aria-label="${l}">${ic(i,22)}<span>${l}</span></button>`).join('')+'<span class="tab-ind" aria-hidden="true"></span>'}
function go(t){if(t===tab&&$('#view').childElementCount)return;const order=Object.keys(views),dir=order.indexOf(t)>=order.indexOf(tab)?1:-1;tab=t;animate=true;render(dir);scrollTo({top:0})}
function render(dir=0){
  $('#title').textContent=titles[tab];$('#gear').classList.toggle('on',tab==='reglages');
  const i=TABS.findIndex(t=>t[0]===tab);document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  const ind=$('.tab-ind');ind.style.opacity=i<0?0:1;if(i>=0)ind.style.transform=`translateX(${i*100}%)`;
  const v=$('#view');v.innerHTML=views[tab]();
  if(animate&&!reduced()){v.classList.remove('enter-l','enter-r');void v.offsetWidth;v.classList.add(dir<0?'enter-l':'enter-r');countUp(v)}
  requestAnimationFrame(()=>requestAnimationFrame(()=>v.querySelectorAll('.bar i[data-w]').forEach(b=>b.style.width=b.dataset.w+'%')));
  animate=false;
}
function countUp(root){root.querySelectorAll('.num[data-v]').forEach(el=>{const to=+el.dataset.v;if(!to)return;const t0=performance.now(),d=650;
  const step=t=>{const p=Math.min(1,(t-t0)/d),e=1-Math.pow(1-p,3);el.textContent=eur(to*e);if(p<1)requestAnimationFrame(step);else el.textContent=eur(to)};requestAnimationFrame(step)})}
function openSheet(title,html,bind){$('#sheetTitle').textContent=title;$('#sheetBody').innerHTML=html;const w=$('#sheet');w.hidden=false;
  requestAnimationFrame(()=>w.classList.add('open'));document.body.classList.add('locked');bind&&bind();
  const first=w.querySelector('input:not([type=radio]):not([type=checkbox]):not([type=range])');if(first&&!first.value&&matchMedia('(pointer:fine)').matches)first.focus()}
function closeSheet(){const w=$('#sheet');if(w.hidden)return;w.classList.remove('open');document.body.classList.remove('locked');setTimeout(()=>{if(!w.classList.contains('open'))w.hidden=true},reduced()?0:260)}
// glisser vers le bas pour fermer
(()=>{let y0=null,dy=0;const s=()=>$('.sheet-panel');document.addEventListener('touchstart',e=>{if(e.target.closest('.grab'))y0=e.touches[0].clientY},{passive:true});
  document.addEventListener('touchmove',e=>{if(y0===null)return;dy=Math.max(0,e.touches[0].clientY-y0);s().style.transform=`translateY(${dy}px)`},{passive:true});
  document.addEventListener('touchend',()=>{if(y0===null)return;s().style.transform='';if(dy>90)closeSheet();y0=null;dy=0})})();
/* ---------- Événements (délégation) ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('button,[data-edit-income],[data-edit-fixed],[data-edit-month],[data-edit-goal],[data-edit-plac]');if(!t)return;
  if(t.matches('.btn,.chip-btn,.item,#tabs button,.seg button,.icon-btn,.goal,[data-preset]'))haptic();
  const d=t.dataset;
  if(d.tab)return go(d.tab);
  if(t.id==='gear')return go('reglages');
  if(d.del){const [l,id]=d.del.split('|');if(confirm('Supprimer cet élément ?'))del(l,id);return}
  if(d.seg){budgetSeg=d.seg;animate=true;return render()}
  if(t.closest('#sheet .sheet-close')||t.id==='sheetBackdrop')return closeSheet();
  if(d.editIncome)return incomeSheet(d.editIncome);if(d.editFixed)return fixedSheet(d.editFixed);if(d.editMonth)return monthSheet(d.editMonth);
  if(d.editGoal)return goalSheet(d.editGoal);if(d.editPlac)return placSheet(d.editPlac);
  ({addIncome:()=>incomeSheet(),addFixed:()=>fixedSheet(),editTransfer:transferSheet,addMisc:miscSheet,addMonth:()=>monthSheet(),addGoal:()=>goalSheet(),addPlac:()=>placSheet(),
    inviteBtn:showInvite,disconnect:()=>{cfg={};localStorage.removeItem(CFG);lastErr='';render();setSync('Local')},
    exp:()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,2)],{type:'application/json'}));a.download='budget-couple.json';a.click()},
    reset:()=>{if(confirm('Effacer toutes les données de cet appareil ? (les données Supabase ne sont pas supprimées)')){D=blank();localStorage.setItem(KEY,JSON.stringify(D));render()}}
  }[t.id]||(()=>{}))();
});
$('#sheetBackdrop').addEventListener('click',closeSheet);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
document.addEventListener('change',async e=>{const t=e.target;
  if(t.id==='revMonth'){revMonth=t.value||curMonth();render()}
  if(t.id==='miscMonth'){D.miscMonth=t.value||curMonth();localStorage.setItem(KEY,JSON.stringify(D));render()}
  if(t.id==='budgetIn'){D.budget[D.miscMonth||curMonth()]=num(t.value);save()}
  if(t.id==='imp'){try{D=migrate(JSON.parse(await t.files[0].text()));save()}catch{alert('Fichier invalide')}}
});
document.addEventListener('submit',async e=>{const f=e.target;
  if(f.id==='fNames'){e.preventDefault();const v=fd(f);D.names={p1:v.p1||'Personne 1',p2:v.p2||'Personne 2'};D.ratio=Math.min(100,Math.max(0,num(v.ratio)));save()}
  if(f.id==='fSync'){e.preventDefault();const v=fd(f);cfg=normCfg(v);if(cfg.space&&cfg.space.length<8){$('#syncMsg').textContent='Code d’espace trop court (8 caractères minimum).';return}
    localStorage.setItem(CFG,JSON.stringify(cfg));$('#syncMsg').textContent='Connexion…';await pullRemote()}
});
/* ---------- Connexion ---------- */
function netBanner(){$('#offline').hidden=navigator.onLine}
addEventListener('online',()=>{netBanner();pullRemote()});addEventListener('offline',()=>{netBanner();setSync('Hors ligne',false)});
/* ---------- Démarrage ---------- */
localStorage.setItem(KEY,JSON.stringify(D)); // enregistre la migration locale (sans modifier "updated")
buildNav();render();netBanner();
if(/^#invite=/.test(location.hash))handleInvite();else pullRemote();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullRemote()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
