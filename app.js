'use strict';
/* Budget Couple. Supabase = source de vérité ; localStorage = cache. Modèle, migrations et fusion : store.js */
const KEY='budget-couple-data',CFG='budget-couple-cfg',ME='budget-couple-me';
const blank=blankData,migrate=migrateData;
let D=migrate(JSON.parse(localStorage.getItem(KEY)||'{}'));
let SNAP=snapshot(D);
let me=localStorage.getItem(ME)||'';
let cfg=JSON.parse(localStorage.getItem(CFG)||'{}');
let tab='accueil',budgetSeg='fixes',animate=true;
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
function persist(){localStorage.setItem(KEY,JSON.stringify(D))}
function save(push=true){stamp(D,SNAP,Date.now(),me);SNAP=snapshot(D);persist();animate=false;render();if(push)pushRemote()}
function adopt(d){const ui=D.miscMonth;D=d;if(ui)D.miscMonth=ui;SNAP=snapshot(D);persist()}
function del(list,id){const val=list==='valuations'&&D.valuations.find(x=>x.id===id);D[list]=D[list].filter(x=>x.id!==id);if(list==='placements')D.valuations=D.valuations.filter(x=>x.pid!==id);save();if(val)placSheet(val.pid);else closeSheet();toast('Supprimé')}
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
 search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3', home2:'M3 10.5 12 3l9 7.5', grid:'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
 cloud:'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z', down:'M12 5v14 M19 12l-7 7-7-7', calendar:'M3 5h18v16H3z M3 10h18 M8 3v4 M16 3v4'
};
const ic=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;
/* ---------- Petits composants ---------- */
const money=(v,cls='')=>`<span class="num ${cls}" data-v="${r2(v)}">${eur(v)}</span>`;
const bar=(p,cls='')=>`<div class="bar ${cls}" role="progressbar" aria-label="Progression" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.max(0,Math.min(100,p)))}"><i data-w="${Math.max(0,Math.min(100,p))}" style="width:${animate&&!reduced()?0:Math.max(0,Math.min(100,p))}%"></i></div>`;
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
const miscOf=(k,m)=>D.misc.filter(x=>x.date.startsWith(m)).reduce((s,x)=>{const w=x.for||x.payer;return s+x.amount*(w==='common'?share(k,D.ratio):w===k?1:0)},0);
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
      if(id)Object.assign(i,o);else D.incomes.push(o);closeSheet();save();toast('Enregistré')})})}
/* ---------- Onglet Budget (charges fixes + dépenses diverses) ---------- */
function vBudget(){const S=[['revenus','Revenus'],['fixes','Charges'],['diverses','Dépenses']],i=Math.max(0,S.findIndex(s=>s[0]===budgetSeg));
  return `<div class="seg seg3" role="tablist" aria-label="Sections du budget">${S.map(([v,l])=>`<button role="tab" aria-selected="${budgetSeg===v}" data-seg="${v}" class="${budgetSeg===v?'on':''}">${l}</button>`).join('')}<span class="seg-ind" style="transform:translateX(${i*100}%)"></span></div>`+
   (budgetSeg==='revenus'?vRevenus():budgetSeg==='fixes'?vFixes():vDiverses());
}
let fixF={q:'',cat:''};
function vFixes(){
  const total=D.fixed.reduce((s,f)=>s+f.amount,0),c1=chargesOf('p1'),c2=chargesOf('p2'),t=D.transfer,to=t.from==='p1'?'p2':'p1',q=fixF.q.toLowerCase();
  const L=[...D.fixed].filter(f=>(!fixF.cat||f.category===fixF.cat)&&(!q||f.label.toLowerCase().includes(q))).sort((a,b)=>(a.day||99)-(b.day||99));
  return `<div class="card hero"><small>Charges fixes mensuelles</small><div class="hero-n">${money(total)}</div>
   <div class="two-k"><div style="--pc:var(--p1)"><small><span class="dot"></span>${esc(D.names.p1)}</small>${money(c1)}</div><div style="--pc:var(--p2)"><small><span class="dot"></span>${esc(D.names.p2)}</small>${money(c2)}</div></div>
   ${splitBar(total?c1/total*100:50)}</div>
  ${total?`<div class="card"><h2>Répartition par catégorie</h2>${donut(catBreakdown('fixed',D.fixed),total,'par mois')}</div>`:''}
  <button class="card item transfer" id="editTransfer"><span class="avatar">${ic('swap',18)}</span><span class="grow"><b>${esc(t.label||'Virement')}</b>
   <small>${t.amount?`${esc(N(t.from))} → ${esc(N(to))} chaque mois`:'Aucun virement entre vous · toucher pour configurer'}</small></span>${t.amount?money(t.amount):''}</button>
  ${sec('Charges',addBtn('addFixed'))}
  ${D.fixed.length>3?`<div class="filters" role="search"><label class="search">${ic('search',16)}<input type="search" id="fixQ" placeholder="Rechercher une charge" value="${esc(fixF.q)}" aria-label="Rechercher une charge"></label>
   <select id="fixCat" aria-label="Filtrer par catégorie"><option value="">Toutes catégories</option>${catOpts('fixed',fixF.cat)}</select></div>`:''}
  <div class="list">${L.map(f=>`<button class="item" data-edit-fixed="${f.id}" aria-label="${esc(f.label)}, ${eur(f.amount)}, le ${f.day||'?'}"><span class="day" style="box-shadow:inset 3px 0 0 ${catColor('fixed',f.category)}">${f.day||'—'}</span>
   <span class="grow"><b>${esc(f.label)}</b><small>${catName('fixed',f.category)} · ${esc(paidName(f.paidBy))} · ${esc(D.names.p1)} ${f.split} % / ${esc(D.names.p2)} ${100-f.split} %</small>${splitBar(f.split)}</span>${money(f.amount)}</button>`).join('')||empty('home',D.fixed.length?'Aucune charge ne correspond.':'Aucune charge fixe pour l’instant.')}</div>`;
}
function fixedSheet(id){const f=D.fixed.find(x=>x.id===id)||{split:D.ratio,category:'logement',paidBy:'joint'};
  openSheet(id?'Modifier la charge':'Nouvelle charge',`<form id="fFixed">
   <label>Libellé<input name="label" value="${esc(f.label||'')}" placeholder="ex. Loyer" required></label>
   <div class="f2"><label>Montant (€)<input name="amount" inputmode="decimal" value="${f.amount??''}" required></label>
   <label>Jour de prélèvement<input name="day" type="number" min="1" max="31" value="${f.day||''}" placeholder="1"></label></div>
   <div class="f2"><label>Catégorie<select name="category">${catOpts('fixed',f.category)}</select></label><label>Prélevé sur<select name="paidBy">${paidOpts().map(([v,l])=>`<option value="${v}" ${f.paidBy===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div>
   <label for="splitR">Qui paie ? (part de chacun)</label><div class="range-l" aria-hidden="true"><span style="color:var(--p1)">${esc(D.names.p1)} <b id="sp1">${f.split}</b> %</span><span style="color:var(--p2)"><b id="sp2">${100-f.split}</b> % ${esc(D.names.p2)}</span></div>
    <input id="splitR" type="range" name="split" min="0" max="100" step="5" value="${f.split}" class="range" style="--v:${f.split}%" aria-valuetext="${esc(D.names.p1)} ${f.split} %, ${esc(D.names.p2)} ${100-f.split} %">
   <div class="presets">${[100,70,50,30,0].map(v=>`<button type="button" data-preset="${v}">${v}/${100-v}</button>`).join('')}<button type="button" data-preset="${D.ratio}">Réglage</button></div>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="fixed|${id}">${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>{
   const R=$('#fFixed [name=split]'),upd=()=>{R.style.setProperty('--v',R.value+'%');$('#sp1').textContent=R.value;$('#sp2').textContent=100-R.value;R.setAttribute('aria-valuetext',`${D.names.p1} ${R.value} %, ${D.names.p2} ${100-R.value} %`)};
   R.addEventListener('input',upd);document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{haptic();R.value=b.dataset.preset;upd()});
   $('#fFixed').addEventListener('submit',e=>{e.preventDefault();const v=fd(e.target),s=Math.max(0,Math.min(100,parseInt(v.split)));
    const o={id:id||uid(),label:v.label,amount:num(v.amount),day:Math.min(31,parseInt(v.day)||0),split:s,payer:s>=100?'p1':s<=0?'p2':'common',category:v.category,paidBy:v.paidBy};
    if(id)Object.assign(f,o);else D.fixed.push(o);closeSheet();save();toast('Enregistré')})})}
function transferSheet(){const t=D.transfer;openSheet('Virement entre vous',`<form id="fTransfer">
   <label>Libellé<input name="label" value="${esc(t.label)}"></label>
   <div class="f2"><label>De<select name="from">${ownerOpts(t.from,false)}</select></label><label>Montant (€)<input name="amount" inputmode="decimal" value="${t.amount||''}" placeholder="0"></label></div>
   <p class="mut">Informatif : indique le virement mensuel de l’un vers l’autre (ex. part du loyer).</p><button class="btn">Enregistrer</button></form>`,()=>
   $('#fTransfer').addEventListener('submit',e=>{e.preventDefault();const f=fd(e.target);D.transfer={label:f.label,from:f.from,amount:num(f.amount)};closeSheet();save();toast('Enregistré')}))}
let miscF={q:'',cat:'',who:''};
function vDiverses(){
  const m=D.miscMonth||curMonth(),b=D.budget[m]||0,all=D.misc.filter(x=>x.date.startsWith(m)),q=miscF.q.toLowerCase();
  const L=all.filter(x=>(!miscF.cat||x.category===miscF.cat)&&(!miscF.who||x.paidBy===miscF.who)&&(!q||x.label.toLowerCase().includes(q))).sort((a,c)=>c.date.localeCompare(a.date));
  const spent=all.reduce((s,x)=>s+x.amount,0),fsum=L.reduce((s,x)=>s+x.amount,0);
  return `<div class="monthbar"><input type="month" id="miscMonth" value="${m}" aria-label="Mois affiché"></div>
  <div class="card hero"><small>Restant sur le budget</small><div class="hero-n">${money(b-spent,b-spent<0?'neg':'')}</div>
   ${bar(b?spent/b*100:0,spent>b&&b?'over':'')}<div class="hero-grid"><div><small>Dépensé</small>${money(spent)}</div>
   <div><label for="budgetIn" class="lbl-s">Budget disponible</label><input id="budgetIn" class="inline" inputmode="decimal" value="${b||''}" placeholder="0 €"></div></div></div>
  <button class="btn wide" id="quickAdd">${ic('plus',18)} Ajouter une dépense</button>
  ${spent?`<div class="card"><h2>Par catégorie</h2>${donut(catBreakdown('misc',all),spent,'ce mois')}</div>`:''}
  ${sec('Dépenses du mois')}
  ${all.length?`<div class="filters" role="search"><label class="search">${ic('search',16)}<input type="search" id="miscQ" placeholder="Rechercher" value="${esc(miscF.q)}" aria-label="Rechercher une dépense"></label>
   <div class="f2"><select id="miscCat" aria-label="Filtrer par catégorie"><option value="">Toutes catégories</option>${catOpts('misc',miscF.cat)}</select>
   <select id="miscWho" aria-label="Filtrer par payeur"><option value="">Tous les payeurs</option>${paidOpts().map(([v,l])=>`<option value="${v}" ${miscF.who===v?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
   ${L.length!==all.length?`<p class="mut" aria-live="polite">${L.length} dépense(s) · ${eur(fsum)}</p>`:''}</div>`:''}
  <div class="list">${L.map(x=>`<div class="item"><span class="avatar" style="--pc:${catColor('misc',x.category)}">${ic('cart',16)}</span>
   <span class="grow"><b>${esc(x.label||catName('misc',x.category))}</b><small>${new Date(x.date+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} · ${catName('misc',x.category)} · ${esc(paidName(x.paidBy))}${x.for&&x.for!=='common'?' · pour '+esc(N(x.for)):''}</small></span>${money(x.amount)}
   <button class="icon-btn" data-del="misc|${x.id}" aria-label="Supprimer ${esc(x.label||'la dépense')}">${ic('trash',16)}</button></div>`).join('')||empty('cart',all.length?'Aucune dépense ne correspond.':'Aucune dépense ce mois-ci.')}</div>`;
}
function miscSheet(){const m=D.miscMonth||curMonth(),last=D.misc[D.misc.length-1]||{};
  openSheet('Dépense rapide',`<form id="fMisc">
   <label class="amount-l">Montant<input name="amount" inputmode="decimal" placeholder="0,00 €" required autocomplete="off" class="amount-in"></label>
   ${chips('category',CAT_MISC.map(([k,n])=>[k,n,catColor('misc',k)]),last.category||'courses','Catégorie')}
   ${chips('paidBy',paidOpts(),me||'joint','Payé par')}
   ${chips('for',forOpts(),'common','Pour')}
   <div class="f2"><label>Libellé (optionnel)<input name="label" placeholder="ex. Marché"></label><label>Date<input type="date" name="date" value="${m===curMonth()?new Date().toISOString().slice(0,10):m+'-01'}" required></label></div>
   <button class="btn">Ajouter</button></form>`,()=>{setTimeout(()=>$('#fMisc .amount-in')?.focus(),50);
   $('#fMisc').addEventListener('submit',e=>{e.preventDefault();const f=fd(e.target),a=num(f.amount);if(!a){$('#fMisc .amount-in').focus();return}
    D.misc.push({id:uid(),date:f.date,label:f.label.trim(),amount:a,category:f.category,paidBy:f.paidBy,for:f.for,payer:f.for==='common'?'common':f.for});
    if(!D.miscMonth||!f.date.startsWith(D.miscMonth))D.miscMonth=f.date.slice(0,7);closeSheet();save();toast(`Dépense de ${eur(a)} ajoutée`)})})}
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
  ${savingsChart()}
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
     else{o.id=uid();D.months.push(o)}closeSheet();save();toast('Enregistré')})})}
/* ---------- Onglet Objectifs ---------- */
let goalF='';
function vObjectifs(){
  const C=compute(),cm=curMonth();
  return `${sec('Objectifs',addBtn('addGoal'))}${D.goals.length>2?chips('goalWho',[['','Tous'],['common','Communs'],['p1',D.names.p1],['p2',D.names.p2]],goalF,'Filtrer les objectifs'):''}`+['common','p1','p2'].filter(g=>!goalF||g===goalF).map(g=>{const L=D.goals.filter(x=>x.owner===g);if(!L.length)return'';
   return `<h3 class="group"><span class="dot" style="--pc:${COL[g]}"></span>${esc(g==='common'?'Communs':N(g))}</h3>`+L.map(x=>{
    const sv=C.saved[x.id],rest=Math.max(0,x.target-sv),p=x.target?Math.min(100,sv/x.target*100):0,mo=x.date?monthsBetween(cm,x.date):0,c=C.contrib[x.id];
    return `<button class="card goal" data-edit-goal="${x.id}" style="--pc:${COL[g]}"><span class="row-b"><b>${esc(x.name)}</b><span class="pct">${p.toFixed(0)} %</span></span>
     ${bar(p,p>=100?'done':'')}<span class="row-b"><span>${money(sv)} <small class="mut">/ ${eur(x.target)}</small></span><small class="mut">reste ${eur(rest)}</small></span>
     ${x.date&&x.date<cm&&rest>0?`<small class="neg">${ic('alert',13)} Échéance dépassée (${monthLabel(x.date)})</small>`:mo&&rest>0?`<small class="mut">${ic('calendar',13)} ${eur(rest/mo)}/mois pendant ${mo} mois (${monthLabel(x.date)})</small>`:p>=100?`<small class="pos">Objectif atteint 🎉</small>`:''}
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
    if(id)Object.assign(g,o);else D.goals.push(o);closeSheet();save();toast('Enregistré')}))}
/* ---------- Onglet Placements ---------- */
function chart(s){
  const W=340,H=180,P=8,max=Math.max(1,...s.map(x=>x.total)),X=i=>P+i*(W-2*P)/48,Y=v=>H-24-v/max*(H-44);
  const line=k=>s.map((x,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(x[k]).toFixed(1)}`).join('');
  const ticks=[12,24,36,48].map(i=>`<line x1="${X(i)}" x2="${X(i)}" y1="14" y2="${H-24}" stroke="rgba(255,255,255,.06)"/><circle cx="${X(i)}" cy="${Y(s[i].total)}" r="3.5" fill="#3ecf8e"/><text x="${X(i)}" y="${H-6}" fill="#8a93a8" font-size="11" text-anchor="${i===48?'end':'middle'}">An ${i/12}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Projection sur 4 ans"><defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ecf8e" stop-opacity=".35"/><stop offset="1" stop-color="#3ecf8e" stop-opacity="0"/></linearGradient></defs>${ticks}
   <path d="${line('total')} L${X(48)},${Y(0)} L${X(0)},${Y(0)}Z" fill="url(#gv)"/><path class="draw" pathLength="1" d="${line('total')}" stroke="#3ecf8e" stroke-width="2.5" fill="none"/><path d="${line('inv')}" stroke="#7c9cff" stroke-width="2" stroke-dasharray="5 4" fill="none"/></svg>
   <div class="legend"><span><i style="background:#3ecf8e"></i>Valeur</span><span><i style="background:#7c9cff"></i>Versé</span></div>`;
}
/* ---------- Placements : types, taux réglementés, enveloppes ---------- */
let RATES=null;
const PTYPES=[['livretA','Livret A','auto'],['ldds','LDDS','auto'],['lep','LEP','auto'],['cel','CEL','auto'],['pel','PEL','opening'],['livretJeune','Livret Jeune','floor'],
  ['av','Assurance vie','env'],['pea','PEA','env'],['cto','Compte-titres','env'],['per','PER','env'],['autre','Autre placement','manual']];
const ptype=k=>PTYPES.find(t=>t[0]===k)||PTYPES[PTYPES.length-1];
const frDate=s=>s?new Date(s+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}).replace(/^1 /,'1er '):'';
const pct=v=>(+v||0).toLocaleString('fr-FR',{maximumFractionDigits:2})+' %';
function currentRate(key,at){const P=RATES?.products?.[key];if(!P)return null;const d=at||new Date().toISOString().slice(0,10);return P.history.find(h=>h.from<=d)||null}
function pelRate(open){if(!RATES?.pel||!open)return null;return RATES.pel.byOpening.find(h=>h.from<=open)||null}
// taux réellement utilisé + explication affichée
function rateInfo(p){const t=ptype(p.type);
  if(t[2]==='auto'&&p.rateMode!=='manual'){const r=currentRate(p.type),P=RATES?.products?.[p.type];
    if(r)return{rate:r.rate,txt:`Taux réglementé ${pct(r.rate)} depuis le ${frDate(r.from)}`,src:P.source,srcName:P.sourceName,auto:true};
    return{rate:p.rate||0,txt:`Taux réglementé (dernier connu ${pct(p.rate||0)})`,auto:true}}
  if(t[2]==='opening')return{rate:p.rate||0,txt:`Taux figé à l’ouverture${p.openDate?` (${frDate(p.openDate)})`:''} : ${pct(p.rate||0)}`};
  if(t[2]==='env')return{rate:p.rate||0,txt:`Rendement estimé ${pct(p.rate||0)}/an (non garanti)`};
  if(t[2]==='floor'){const la=currentRate('livretA'),low=la&&(p.rate||0)<la.rate;return{rate:p.rate||0,txt:`Taux de la banque ${pct(p.rate||0)}${la?` · minimum légal ${pct(la.rate)}`:''}`,warn:low?'Inférieur au minimum légal : vérifiez le taux de votre banque.':''}}
  return{rate:p.rate||0,txt:`Taux ${p.rateMode==='manual'&&t[2]==='auto'?'manuel ':''}${pct(p.rate||0)}`};
}
/* Enveloppes (AV, PEA, CTO, PER) : valorisation globale saisie à la main + historique */
const isEnv=p=>ptype(p.type)[2]==='env';
const valsOf=pid=>D.valuations.filter(v=>v.pid===pid).sort((a,b)=>a.date.localeCompare(b.date)||(a.c??0)-(b.c??0));
const lastVal=pid=>{const L=valsOf(pid);return L[L.length-1]||null};
const placValue=p=>{if(isEnv(p)){const v=lastVal(p.id);if(v)return +v.value||0}return +p.capital||0};
function streams(){return D.placements.map(p=>({pid:p.id,capital:placValue(p),monthly:+p.monthly||0,rate:rateInfo(p).rate}))}
/* Rappel mensuel de valorisation */
function lastReminderDate(today=new Date()){const day=Math.min(28,Math.max(1,D.reminderDay||1));let d=new Date(today.getFullYear(),today.getMonth(),day);if(d>today)d=new Date(today.getFullYear(),today.getMonth()-1,day);return d.toISOString().slice(0,10)}
const dueValuations=()=>{const th=lastReminderDate();return D.placements.filter(p=>isEnv(p)&&(!lastVal(p.id)||lastVal(p.id).date<th))};
function valChart(L){if(L.length<2)return'';const W=320,H=120,min=Math.min(...L.map(v=>v.value)),max=Math.max(...L.map(v=>v.value)),span=max-min||1;
  const t0=+new Date(L[0].date),t1=+new Date(L[L.length-1].date)||t0+1,X=v=>10+(+new Date(v.date)-t0)/((t1-t0)||1)*(W-20),Y=v=>H-18-(v.value-min)/span*(H-36);
  const path=L.map((v,i)=>`${i?'L':'M'}${X(v).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Évolution de la valorisation de ${eur(L[0].value)} à ${eur(L[L.length-1].value)}"><defs><linearGradient id="gval" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d8bff" stop-opacity=".35"/><stop offset="1" stop-color="#6d8bff" stop-opacity="0"/></linearGradient></defs>
   <path d="${path} L${X(L[L.length-1])},${H-18} L${X(L[0])},${H-18}Z" fill="url(#gval)"/><path d="${path}" fill="none" stroke="#6d8bff" stroke-width="2.5" stroke-linejoin="round"/>${L.map(v=>`<circle cx="${X(v)}" cy="${Y(v)}" r="3" fill="#6d8bff"/>`).join('')}
   <text x="10" y="${H-3}" font-size="10" fill="#8b94a8">${new Date(L[0].date+'T12:00').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})}</text><text x="${W-10}" y="${H-3}" font-size="10" fill="#8b94a8" text-anchor="end">${new Date(L[L.length-1].date+'T12:00').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})}</text></svg>`}
const gain=p=>{const v=placValue(p),inv=+p.invested||0;return{v,inv,d:v-inv,pc:inv?(v-inv)/inv*100:0}};
let bankF='';
function vPlacements(){
  const S=streams(),s=project(S),end=s[48],banks=[...new Set(D.placements.map(p=>p.bank||'Sans banque'))].sort((a,b)=>a.localeCompare(b,'fr'));
  if(bankF&&!banks.includes(bankF))bankF='';
  const futureOf=pid=>S.reduce((t,x,i)=>t+(x.pid===pid?end.vals?.[i]||0:0),0);
  const total=D.placements.reduce((t,p)=>t+placValue(p),0),due=dueValuations();
  const L=D.placements.filter(p=>!bankF||(p.bank||'Sans banque')===bankF);
  const reg=['livretA','ldds','lep','cel'].map(k=>[k,currentRate(k)]).filter(x=>x[1]);
  return `${D.placements.length?`<div class="card hero"><small>Encours actuel ${money(total)} · valeur projetée dans 4 ans</small><div class="hero-n">${money(end.total)}</div>
    <div class="hero-grid"><div><small>Encours + versements</small>${money(end.inv)}</div><div><small>Intérêts / gains estimés</small>${money(end.total-end.inv,'pos')}</div></div>${chart(s)}</div>
   <div class="years">${[1,2,3,4].map(y=>{const x=s[y*12];return `<div class="card yr"><small>Fin d’année ${y}</small><b>${eur(x.total)}</b><small class="pos">+${eur(x.total-x.inv)}</small></div>`}).join('')}</div>`:''}
  ${due.length?`<div class="card remind" role="status">${ic('alert',16)} ${due.length} valorisation${due.length>1?'s':''} à mettre à jour (rappel du ${D.reminderDay||1} de chaque mois). <button class="link" data-goto="accueil">Mettre à jour</button></div>`:''}
  ${sec('Placements',addBtn('addPlac'))}
  ${banks.length>1?chips('bankF',[['','Toutes les banques'],...banks.map(b=>[b,b])],bankF,'Filtrer par banque'):''}
  ${banks.filter(b=>!bankF||b===bankF).map(b=>{const G=L.filter(p=>(p.bank||'Sans banque')===b);if(!G.length)return'';const sub=G.reduce((t,p)=>t+placValue(p),0);
    return `<h3 class="group row-b"><span>${esc(b)}</span><span>${eur(sub)}</span></h3><div class="list">${G.map(p=>{const ri=rateInfo(p),t=ptype(p.type),env=isEnv(p),g=gain(p),lv=lastVal(p.id),isDue=due.includes(p);
     return `<button class="item" data-edit-plac="${p.id}"><span class="avatar" style="--pc:${COL[p.owner]}">${ic('trend',16)}</span>
     <span class="grow"><b>${esc(p.name||t[1])}</b><small>${t[1]} · ${esc(N(p.owner))}${p.monthly?` · +${eur(p.monthly)}/mois`:''}</small>
     <small class="${ri.auto?'acc':''}">${esc(ri.txt)}</small>
     ${env?`<small>${lv?`Valorisé le ${new Date(lv.date+'T12:00').toLocaleDateString('fr-FR')}`:'Aucune valorisation'}${g.inv?` · <span class="${g.d>=0?'pos':'neg'}">${g.d>=0?'+':''}${eur(g.d)} (${g.pc.toFixed(1)} %)</span>`:''}</small>`:''}
     ${isDue?`<small class="warn-c">${ic('alert',12)} Valorisation à mettre à jour</small>`:''}${ri.warn?`<small class="neg">${ic('alert',12)} ${esc(ri.warn)}</small>`:''}</span>
     <span class="r">${money(placValue(p))}<small class="mut">4 ans : ${eur(futureOf(p.id))}</small></span></button>`}).join('')}</div>`}).join('')||empty('trend','Ajoute un livret, un PEL, une assurance vie… pour voir la projection sur 4 ans.')}
  <div class="card"><h2>${ic('calendar',18)} Taux réglementés en vigueur</h2>${reg.length?`<ul class="bal-l">${reg.map(([k,r])=>`<li><span>${RATES.products[k].name}</span><small>depuis le ${frDate(r.from)} · <a href="${RATES.products[k].source}" target="_blank" rel="noopener">${RATES.products[k].sourceName}</a></small><b>${pct(r.rate)}</b></li>`).join('')}</ul>
   <p class="mut">Mis à jour automatiquement (rates.json, vérifié le ${frDate(RATES.checked)}). PEL : taux figé à l’ouverture. Livret Jeune : taux libre de la banque, au moins égal au Livret A.</p>`:'<p class="mut">Chargement des taux…</p>'}</div>
  <p class="mut note">Projection : intérêts composés mensuellement (taux annuel ÷ 12), versements permanents en fin de mois, au taux en vigueur aujourd’hui. Rendements des assurances vie, PEA, comptes-titres et PER : estimations saisies, non garanties.</p>`;
}
function placSheet(id,draft){const p=draft||D.placements.find(x=>x.id===id)||{owner:'common',type:'livretA',rateMode:'auto',bank:''},t=ptype(p.type);
  const banks=[...new Set(D.placements.map(x=>x.bank).filter(Boolean))],env=t[2]==='env',la=currentRate('livretA'),V=id?valsOf(id):[],g=id?gain(D.placements.find(x=>x.id===id)||p):null;
  const rateBlock=t[2]==='auto'?`<div class="preview"><small>Taux fixé par l’État</small><b>${currentRate(p.type)?`${pct(currentRate(p.type).rate)} depuis le ${frDate(currentRate(p.type).from)}`:'chargement…'}</b>
     ${RATES?.products?.[p.type]?`<small>Source : <a href="${RATES.products[p.type].source}" target="_blank" rel="noopener">${RATES.products[p.type].sourceName}</a> · mis à jour automatiquement</small>`:''}</div>
     <label class="switch"><input type="checkbox" id="manualRate" ${p.rateMode==='manual'?'checked':''}><span></span>Utiliser un taux manuel</label>
     <label id="rateL" ${p.rateMode==='manual'?'':'hidden'}>Taux annuel manuel (%)<input name="rate" inputmode="decimal" value="${p.rate??''}"></label>`
   :t[2]==='opening'?`<label>Date d’ouverture du PEL<input type="date" name="openDate" id="pelDate" value="${p.openDate||''}" required max="${new Date().toISOString().slice(0,10)}"></label>
     <label>Taux (figé pour toute la durée du plan) (%)<input name="rate" id="pelRate" inputmode="decimal" value="${p.rate??''}"></label><p class="mut" id="pelHint">${p.openDate&&pelRate(p.openDate)?`Taux officiel pour un PEL ouvert à cette date : ${pct(pelRate(p.openDate).rate)} (hors prime). Il ne sera jamais modifié.`:'Le taux officiel correspondant sera proposé selon la date d’ouverture.'}</p>`
   :t[2]==='floor'?`<label>Taux de votre banque (%)<input name="rate" inputmode="decimal" value="${p.rate??(la?la.rate:'')}"></label><p class="mut">Taux libre fixé par la banque, au moins égal au Livret A${la?` (${pct(la.rate)} actuellement)`:''}. Pas de mise à jour automatique.</p>`
   :env?`<label>Rendement annuel estimé (%)<input name="rate" inputmode="decimal" value="${p.rate??''}" placeholder="ex. 3 (fonds euros) ou 5 (UC)"></label><p class="mut">Sert uniquement à la projection. Pour un fonds euros, indiquez son taux annuel.</p>`
   :`<label>Taux annuel (%)<input name="rate" inputmode="decimal" value="${p.rate??''}"></label>`;
  const valBlock=env&&id?`<div class="sec"><h2>Valorisations</h2></div>
    ${g&&g.inv?`<div class="hero-grid"><div><small>Valorisation</small><b>${eur(g.v)}</b></div><div><small>Plus-value globale</small><b class="${g.d>=0?'pos':'neg'}">${g.d>=0?'+':''}${eur(g.d)} (${g.pc.toFixed(1)} %)</b></div></div>`:''}
    ${valChart(V)}
    <form id="fVal" class="valform"><div class="f2"><label>Date<input type="date" name="date" value="${new Date().toISOString().slice(0,10)}" required max="${new Date().toISOString().slice(0,10)}"></label><label>Valorisation (€)<input name="value" inputmode="decimal" required placeholder="0"></label></div><button class="btn ghost">${ic('plus',16)} Ajouter la valorisation</button></form>
    <div class="list">${[...V].reverse().map(v=>`<div class="item"><span class="grow"><b>${eur(v.value)}</b><small>${frDate(v.date)}</small></span><button type="button" class="icon-btn" data-del="valuations|${v.id}" aria-label="Supprimer la valorisation du ${frDate(v.date)}">${ic('trash',16)}</button></div>`).join('')||'<p class="mut">Aucune valorisation : ajoutez le montant affiché par votre banque ou assureur.</p>'}</div>
    ${p.archivedLines?.length?`<details><summary>Ancien détail par ligne (archivé)</summary><ul class="bal-l">${p.archivedLines.map(x=>`<li><span>${esc(x.name||x.isin||'Ligne')}</span><small>${esc(x.isin||'')}</small><b>${eur(x.kind==='euro'?x.value:(x.qty||0)*(x.price||0))}</b></li>`).join('')}</ul></details>`:''}`:'';
  openSheet(id?'Modifier le placement':'Nouveau placement',`<form id="fPlac" novalidate>
   <div class="f2"><label>Type<select name="type" id="ptype">${PTYPES.map(([k,l])=>`<option value="${k}" ${p.type===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Titulaire<select name="owner">${ownerOpts(p.owner)}</select></label></div>
   <div class="f2"><label>Nom<input name="name" value="${esc(p.name||'')}" placeholder="${esc(t[1])}"></label><label>Banque<input name="bank" list="bankList" value="${esc(p.bank||'')}" placeholder="ex. Ma banque" autocomplete="off"><datalist id="bankList">${banks.map(b=>`<option value="${esc(b)}">`).join('')}</datalist></label></div>
   ${env?`<div class="f2"><label>Total versé (€)<input name="invested" inputmode="decimal" value="${p.invested??''}" placeholder="0"></label><label>Versement programmé (€/mois)<input name="monthly" inputmode="decimal" value="${p.monthly??''}" placeholder="0"></label></div>
     ${id?'':`<label>Valorisation actuelle (€)<input name="capital" inputmode="decimal" placeholder="0"></label>`}`
   :`<div class="f2"><label>Capital actuel (€)<input name="capital" inputmode="decimal" value="${p.capital??''}" placeholder="0"></label><label>Versement mensuel (€)<input name="monthly" inputmode="decimal" value="${p.monthly??''}" placeholder="0"></label></div>`}
   ${rateBlock}<p class="neg" id="placErr" role="alert"></p>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="placements|${id}">${ic('trash',16)} Supprimer</button>`:''}</form>${valBlock}`,()=>{
   const F=$('#fPlac'),cur=()=>({...p,...fd(F),rateMode:$('#manualRate')?($('#manualRate').checked?'manual':'auto'):p.rateMode});
   $('#ptype').addEventListener('change',()=>{const c=cur(),nt=ptype(c.type);c.rateMode=nt[2]==='auto'?'auto':'manual';if(nt[2]==='floor'&&la&&!num(c.rate))c.rate=la.rate;placSheet(id,c)});
   on('#manualRate','change',e=>{$('#rateL').hidden=!e.target.checked});
   on('#pelDate','change',e=>{const r=pelRate(e.target.value);if(r){$('#pelRate').value=String(r.rate).replace('.',',');$('#pelHint').textContent=`Taux officiel pour un PEL ouvert à cette date : ${pct(r.rate)} (hors prime). Il ne sera jamais modifié.`}});
   F.addEventListener('submit',e=>{e.preventDefault();const f=fd(F),nt=ptype(f.type),err=m=>{$('#placErr').textContent=m};
     if(['capital','monthly','invested','rate'].some(k=>k in f&&f[k]!==''&&(isNaN(num(f[k]))||num(f[k])<0||!/^[\d\s.,]+$/.test(f[k]))))return err('Les montants et taux doivent être des nombres positifs.');
     if(nt[2]==='opening'&&!f.openDate)return err('Indiquez la date d’ouverture du PEL.');
     const o={id:id||uid(),type:f.type,name:f.name.trim(),bank:f.bank.trim(),owner:f.owner,monthly:num(f.monthly),rateMode:nt[2]==='auto'?($('#manualRate').checked?'manual':'auto'):'manual'};
     if(nt[2]==='env'){o.invested=num(f.invested)}
     if('capital' in f)o.capital=num(f.capital);
     if('rate' in f)o.rate=num(f.rate);else if(nt[2]==='auto'){const r=currentRate(f.type);o.rate=r?r.rate:(p.rate||0)}
     if(nt[2]==='opening'){o.openDate=f.openDate;if(!f.rate){const r=pelRate(f.openDate);o.rate=r?r.rate:0}}
     const ex=D.placements.find(x=>x.id===id);if(ex)Object.assign(ex,o);else{D.placements.push(o);if(nt[2]==='env'&&o.capital)D.valuations.push({id:uid(),pid:o.id,date:new Date().toISOString().slice(0,10),value:o.capital})}
     save();if(nt[2]==='env'&&!id){placSheet(o.id);toast('Enveloppe créée')}else{closeSheet();toast('Placement enregistré')}});
   on('#fVal','submit',e=>{e.preventDefault();const f=fd(e.target),v=num(f.value);if(!f.value||v<0){e.target.value.focus();return}
     D.valuations.push({id:uid(),pid:id,date:f.date,value:v});save();placSheet(id);toast('Valorisation ajoutée')})})}
/* Carte de rappel sur l'accueil */
function remindCard(){const due=dueValuations();if(!due.length)return'';
  return `<div class="card remind-card"><h2>${ic('alert',18)} Mettre à jour la valorisation</h2><p class="mut">Rappel le ${(D.reminderDay||1)==1?"1er":D.reminderDay} de chaque mois : saisissez le montant indiqué par votre banque ou assureur.</p>
   ${due.map(p=>{const lv=lastVal(p.id);return `<form class="qval" data-pid="${p.id}"><label class="grow">${esc(p.name||ptype(p.type)[1])}<small>${lv?`Dernière : ${eur(lv.value)} le ${new Date(lv.date+'T12:00').toLocaleDateString('fr-FR')}`:'Jamais valorisé'}</small>
     <input name="value" inputmode="decimal" placeholder="${lv?String(lv.value).replace('.',','):'0'}" aria-label="Nouvelle valorisation de ${esc(p.name||ptype(p.type)[1])} en euros" required></label><button class="btn small">OK</button></form>`}).join('')}</div>`}
/* ---------- Réglages ---------- */
function vReglages(){
  return `<div class="card"><h2>Prénoms & répartition</h2><form id="fNames">
   <div class="f2"><label>Personne 1<input name="p1" value="${esc(D.names.p1)}"></label><label>Personne 2<input name="p2" value="${esc(D.names.p2)}"></label></div>
   <label>Part de ${esc(D.names.p1)} dans les dépenses communes (%)<input name="ratio" type="number" min="0" max="100" value="${D.ratio}"></label>
   <p class="mut">Sert de valeur par défaut pour les nouvelles charges, les dépenses diverses communes et les objectifs communs.</p>
   <label>Jour du rappel mensuel de valorisation (assurance vie, PEA…)<input name="reminderDay" type="number" min="1" max="28" value="${D.reminderDay||1}"></label>
   <button class="btn">Enregistrer</button></form></div>
  <div class="card"><h2>${ic('edit',18)} Cet appareil</h2><p class="mut">Utilisé par <b style="color:${COL[me]||'var(--txt)'}">${me?esc(N(me)):'personne (non défini)'}</b> : vos modifications sont signées dans l’historique.</p>
   <div class="f2"><button class="btn ghost" id="chooseMe">Changer</button><button class="btn ghost" id="openHist">${ic('repeat',16)} Historique</button></div></div>
  <div class="card"><h2>${ic('cloud',18)} Synchronisation Supabase</h2><form id="fSync">
   <label>URL du projet<input name="url" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url||'')}"></label>
   <label>Clé publishable ou anon (publique)<input name="key" value="${esc(cfg.key||'')}"></label>
   <label>Code d’espace partagé<input name="space" value="${esc(cfg.space||'')}" placeholder="un code long et secret"></label>
   <button class="btn">Enregistrer & synchroniser</button>
   <div class="f2"><button type="button" class="btn ghost" id="inviteBtn">${ic('link',16)} Lien d’invitation</button><button type="button" class="btn ghost" id="disconnect">Désactiver</button></div></form>
   <div id="invitePanel"></div><p class="mut" id="syncMsg">${esc(lastErr)}</p></div>
  <div class="card"><h2>Sauvegarde</h2><div class="f2"><button class="btn ghost" id="exp">Exporter (JSON)</button>
   <label class="btn ghost">Importer<input type="file" id="imp" accept=".json" hidden></label></div>
   <button class="btn danger" id="reset">${sbOn()?'Vider le cache et recharger':'Tout effacer sur cet appareil'}</button><p class="mut">Format de données v${DATA_VERSION}</p></div>`;
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
let _cmp=null,_cmpKey=null;
function compute(extra){if(!extra){const k=D.updated+':'+D.months.length+':'+D.goals.length+':'+D.ratio;if(_cmpKey===k&&_cmp)return _cmp;_cmpKey=k;return _cmp=computeRaw()}return computeRaw(extra)}
function computeRaw(extra){
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
/* Synchro sans perte : lecture → fusion par élément → écriture conditionnelle (updated_at inchangé), sinon on recommence */
let syncing=null,again=false;
const restUrl=q=>`${cfg.url}/rest/v1/budget_spaces?code=eq.${encodeURIComponent(cfg.space)}${q||''}`;
async function syncOnce(){
  for(let attempt=0;attempt<6;attempt++){
    const r=await fetch(restUrl('&select=data,updated_at'),{headers:sbH(),cache:'no-store'});if(!r.ok)throw{sb:await sbErr(r)};
    const [row]=await r.json(),stampNow=new Date().toISOString();
    if(!row){const w=await fetch(`${cfg.url}/rest/v1/budget_spaces`,{method:'POST',headers:{...sbH(),Prefer:'return=minimal'},body:JSON.stringify({code:cfg.space,data:D,updated_at:stampNow})});
      if(w.status===409)continue;if(!w.ok)throw{sb:await sbErr(w)};return}
    const remote=migrate(row.data),merged=mergeData(D,remote),changedLocal=canon(merged)!==canon(D);
    if(changedLocal){adopt(merged);animate=false;if(!document.querySelector('#sheet.open'))render()}
    if(canon(merged)===canon(mergeData(remote,remote)))return;
    const w=await fetch(restUrl('&updated_at=eq.'+encodeURIComponent(row.updated_at)),{method:'PATCH',headers:{...sbH(),Prefer:'return=representation'},body:JSON.stringify({data:D,updated_at:stampNow})});
    if(!w.ok)throw{sb:await sbErr(w)};const rows=await w.json();if(rows.length)return; // sinon quelqu'un a écrit entre-temps → on refusionne
  }
  throw{sb:'Conflit de synchronisation persistant, réessayez.'};
}
async function pullRemote(){
  if(!sbOn())return setSync('Local');if(!navigator.onLine){setSync('Hors ligne',false);return showErr('Pas de connexion internet.')}
  if(syncing){again=true;return syncing}
  syncing=(async()=>{try{do{again=false;setSync('Synchro…',null);await syncOnce()}while(again);setSync('Synchro ✓',true);showErr('Synchronisé ✓')}
    catch(e){setSync('Erreur synchro',false);showErr(netErr(e));console.warn('sync',e)}finally{syncing=null}})();
  return syncing;
}
let pt;function pushRemote(){if(!sbOn())return;clearTimeout(pt);return new Promise(res=>pt=setTimeout(()=>pullRemote().then(res),250))}
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
/* ---------- Catégories ---------- */
const CAT_COL=['#6d8bff','#3ecf8e','#ffb547','#ff7ab6','#4ec9e0','#b48cff','#ff8a5c','#9bd25e','#8b94a8'];
const catList=l=>l==='fixed'?CAT_FIXED:CAT_MISC;
const catName=(l,k)=>(catList(l).find(c=>c[0]===k)||[,'Autre'])[1];
const catColor=(l,k)=>CAT_COL[Math.max(0,catList(l).findIndex(c=>c[0]===k))%CAT_COL.length];
const catOpts=(l,sel)=>catList(l).map(([k,n])=>`<option value="${k}" ${k===sel?'selected':''}>${n}</option>`).join('');
const chips=(name,opts,sel,label)=>`<fieldset class="chips"><legend>${label}</legend>${opts.map(([v,l,col])=>`<label><input type="radio" name="${name}" value="${v}" ${v===sel?'checked':''}><span ${col?`style="--cc:${col}"`:''}>${l}</span></label>`).join('')}</fieldset>`;
const paidOpts=()=>[['joint','Compte commun'],['p1',D.names.p1],['p2',D.names.p2]];
const forOpts=()=>[['common','Nous deux'],['p1',D.names.p1],['p2',D.names.p2]];
const paidName=k=>k==='joint'?'Compte commun':N(k);
/* Donut SVG accessible */
function donut(parts,total,center){
  const R=52,C=2*Math.PI*R;let off=0;const segs=parts.filter(p=>p.v>0).map(p=>{const len=p.v/total*C,s=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${p.col}" stroke-width="18" stroke-dasharray="${Math.max(0,len-2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;off+=len;return s}).join('');
  return `<div class="donut-w"><svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="${esc(parts.map(p=>`${p.name} ${eur(p.v)}`).join(', '))}"><circle r="${R}" cx="70" cy="70" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="18"/>${segs}
   <text x="70" y="67" text-anchor="middle" fill="#8b94a8" font-size="10">${center}</text><text x="70" y="84" text-anchor="middle" fill="#eef1f7" font-size="15" font-weight="700">${eur(total).replace(/,\d\d/,'')}</text></svg>
   <ul class="legend-l">${parts.filter(p=>p.v>0).sort((a,b)=>b.v-a.v).map(p=>`<li><i style="background:${p.col}"></i><span>${p.name}</span><b>${eur(p.v)}</b><small>${(p.v/total*100).toFixed(0)} %</small></li>`).join('')}</ul></div>`;
}
function catBreakdown(l,items){const m={};items.forEach(x=>m[x.category||'autre']=(m[x.category||'autre']||0)+x.amount);
  return Object.entries(m).map(([k,v])=>({name:catName(l,k),v,col:catColor(l,k)}))}
/* ---------- Équilibre : qui doit combien à qui (mois donné) ---------- */
// valeur positive = la personne 2 doit à la personne 1
function balance(m){const lines=[];let net=0;
  const owe=(payer,amount,forWho,split,label)=>{if(payer!=='p1'&&payer!=='p2')return;const other=payer==='p1'?'p2':'p1';
    const part=amount*(forWho==='common'?share(other,split):forWho===other?1:0);if(part<0.005)return;net+=payer==='p1'?part:-part;lines.push({label,from:other,to:payer,v:part})};
  D.fixed.forEach(f=>owe(f.paidBy,f.amount,'common',f.split,f.label));
  D.misc.filter(x=>x.date.startsWith(m)).forEach(x=>owe(x.paidBy,x.amount,x.for||'common',D.ratio,x.label));
  const pay=(from,to,v,label)=>{if(!v)return;net+=from==='p2'?-v:v;lines.push({label,from,to,v,pay:true})};
  if(D.transfer.amount)pay(D.transfer.from,D.transfer.from==='p1'?'p2':'p1',D.transfer.amount,D.transfer.label||'Virement');
  D.settlements.filter(s=>s.month===m).forEach(s=>pay(s.from,s.to,s.amount,'Règlement'));
  return{net:r2(net),lines};
}
function balanceCard(m){const b=balance(m),abs=Math.abs(b.net),from=b.net>0?'p2':'p1',to=b.net>0?'p1':'p2';
  return `<div class="card bal" aria-live="polite"><div class="row-b"><h2>${ic('swap',18)} Équilibre · ${monthLabel(m)}</h2></div>
   ${abs<0.01?`<p class="ok-t">Vous êtes à l’équilibre ce mois-ci.</p>`:`<p class="bal-t"><b style="color:${COL[from]}">${esc(N(from))}</b> doit <b class="num" data-v="${abs}">${eur(abs)}</b> à <b style="color:${COL[to]}">${esc(N(to))}</b></p>
   <button class="btn ghost" id="settle" data-month="${m}" data-from="${from}" data-to="${to}" data-amount="${abs}">Marquer comme réglé</button>`}
   ${b.lines.length?`<details><summary>Détail du calcul</summary><ul class="bal-l">${b.lines.map(l=>`<li><span>${esc(l.label)}</span><small>${l.pay?'payé':'part due'} ${esc(N(l.from))} → ${esc(N(l.to))}</small><b>${eur(l.v)}</b></li>`).join('')}</ul></details>`:'<p class="mut">Indique « Payé par » sur les charges et dépenses pour calculer l’équilibre.</p>'}</div>`}
/* ---------- Tableau de bord ---------- */
function nextCharges(n=5){const t=new Date(),today=t.getDate(),dim=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();
  return D.fixed.filter(f=>f.day).map(f=>{const d=f.day>=today?f.day-today:dim-today+f.day;return{...f,inDays:d}}).sort((a,b)=>a.inDays-b.inDays).slice(0,n)}
function onboarding(){const steps=[[D.incomes.length,'Ajouter vos revenus','budget','revenus'],[D.fixed.length,'Ajouter vos charges fixes','budget','fixes'],[D.goals.length,'Créer un objectif','objectifs'],[sbOn(),'Synchroniser vos deux téléphones','reglages']];
  if(steps.every(x=>x[0]))return'';return `<div class="card"><h2>Pour bien démarrer</h2><ol class="steps">${steps.map(([ok,l,t,sg])=>`<li class="${ok?'done':''}"><button class="link" data-goto="${t}" ${sg?`data-seg-to="${sg}"`:''}>${ok?'✓ ':''}${l}</button></li>`).join('')}</ol></div>`}
function vAccueil(){
  const m=curMonth(),a=summary('p1',m),b=summary('p2',m),rest=a.rest+b.rest,rev=a.rev+b.rev,ep=a.ep+b.ep,bud=D.budget[m]||0,spent=D.misc.filter(x=>x.date.startsWith(m)).reduce((s,x)=>s+x.amount,0),C=compute();
  const goals=[...D.goals].map(g=>({g,p:g.target?Math.min(100,C.saved[g.id]/g.target*100):0})).sort((x,y)=>y.p-x.p).slice(0,4);
  const nc=nextCharges();
  return `<p class="hello">${me?`Bonjour ${esc(N(me))}`:'Bonjour'} · ${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</p>
  <div class="card hero"><small>Reste à vivre du couple · ${monthLabel(m)}</small><div class="hero-n">${money(rest,rest<0?'neg':'')}</div>
   <div class="hero-grid"><div><small>Revenus</small>${money(rev)}</div><div><small>Épargné ce mois</small>${money(ep)}</div>
   <div><small>Dépenses diverses</small>${money(spent)}${bud?`<small> / ${eur(bud)}</small>`:''}</div><div><small>Taux d’épargne</small><span class="num">${rev?(ep/rev*100).toFixed(0):0} %</span></div></div>
   ${bud?bar(spent/bud*100,spent>bud?'over':''):''}</div>
  <button class="btn wide" id="quickAdd">${ic('plus',18)} Ajouter une dépense</button>
  ${remindCard()}${onboarding()}
  ${D.fixed.length||D.misc.length||D.settlements.length||D.transfer.amount?balanceCard(m):''}
  ${sec('Prochains prélèvements',`<button class="link" data-goto="budget" data-seg-to="fixes">Tout voir</button>`)}
  <div class="list">${nc.map(f=>`<div class="item"><span class="day" aria-hidden="true">${f.day}</span><span class="grow"><b>${esc(f.label)}</b><small>${f.inDays===0?'Aujourd’hui':f.inDays===1?'Demain':`Dans ${f.inDays} jours`} · ${esc(paidName(f.paidBy))}</small></span>${money(f.amount)}</div>`).join('')||empty('calendar','Ajoute des charges avec un jour de prélèvement.')}</div>
  ${sec('Objectifs',`<button class="link" data-goto="objectifs">Tout voir</button>`)}
  <div class="list">${goals.map(({g,p})=>`<button class="item col" data-edit-goal="${g.id}"><span class="row-b"><b>${esc(g.name)}</b><span class="pct" style="--pc:${COL[g.owner]}">${p.toFixed(0)} %</span></span>${bar(p,p>=100?'done':'')}<small>${eur(C.saved[g.id])} sur ${eur(g.target)}</small></button>`).join('')||empty('target','Aucun objectif pour l’instant.')}</div>
  ${sec('Activité récente',`<button class="link" data-goto="activite">Historique</button>`)}
  <div class="list">${D.history.slice(0,4).map(histItem).join('')||empty('repeat','Les modifications apparaîtront ici.')}</div>`;
}
/* ---------- Historique ---------- */
const KIND={months:'Épargne',goals:'Objectif',fixed:'Charge',misc:'Dépense',placements:'Placement',incomes:'Revenu',settlements:'Règlement',names:'Prénoms',ratio:'Répartition',transfer:'Virement',budget:'Budget'};
const OP={add:'a ajouté',edit:'a modifié',del:'a supprimé'};
function ago(t){const s=(Date.now()-t)/1000;if(s<60)return'à l’instant';if(s<3600)return`il y a ${Math.floor(s/60)} min`;if(s<86400)return`il y a ${Math.floor(s/3600)} h`;return new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function histItem(h){const lab=h.kind==='budget'?monthLabel(h.label):['names','ratio','transfer'].includes(h.kind)?'':h.kind==='months'?monthLabel(h.label):h.label;
  return `<div class="item"><span class="avatar" style="--pc:${COL[h.by]||'var(--mut)'}">${ic(h.op==='del'?'trash':h.op==='add'?'plus':'edit',16)}</span><span class="grow"><b>${esc(h.by?N(h.by):'Quelqu’un')} ${OP[h.op]} ${esc((KIND[h.kind]||'').toLowerCase())}</b><small>${esc(lab)}${lab?' · ':''}${ago(h.t)}</small></span></div>`}
let histF={who:'',q:''};
function vActivite(){const q=histF.q.toLowerCase(),L=D.history.filter(h=>(!histF.who||h.by===histF.who)&&(!q||(h.label+' '+KIND[h.kind]).toLowerCase().includes(q)));
  return `<div class="filters" role="search"><label class="search">${ic('search',16)}<input type="search" id="histQ" placeholder="Rechercher" value="${esc(histF.q)}" aria-label="Rechercher dans l’historique"></label>
   ${chips('histWho',[['','Tous'],['p1',D.names.p1],['p2',D.names.p2]],histF.who,'Auteur')}</div>
  <p class="mut" aria-live="polite">${L.length} modification${L.length>1?'s':''}</p><div class="list">${L.slice(0,200).map(histItem).join('')||empty('repeat','Aucune modification.')}</div>`}
/* ---------- Évolution de l'épargne ---------- */
function savingsChart(){const L=[...D.months].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);if(L.length<1)return'';
  const W=340,H=170,max=Math.max(1,...L.map(x=>x.a+x.b)),bw=(W-20)/L.length;let cum=0;const cumv=L.map(x=>cum+=x.a+x.b),cmax=Math.max(1,...cumv);
  const bars=L.map((x,i)=>{const h1=x.a/max*(H-50),h2=x.b/max*(H-50),X=10+i*bw+bw*.18,w=bw*.64,y0=H-22;
    return `<rect x="${X}" y="${y0-h1}" width="${w}" height="${h1}" rx="3" fill="#4ea8ff"/><rect x="${X}" y="${y0-h1-h2}" width="${w}" height="${h2}" rx="3" fill="#ff7ab6"/><text x="${X+w/2}" y="${H-8}" text-anchor="middle" font-size="9" fill="#8b94a8">${new Date(x.month+'-01T12:00').toLocaleDateString('fr-FR',{month:'short'}).replace('.','')}</text>`}).join('');
  const line=cumv.map((v,i)=>`${i?'L':'M'}${(10+i*bw+bw/2).toFixed(1)},${(H-22-v/cmax*(H-50)).toFixed(1)}`).join('');
  return `<div class="card"><h2>${ic('trend',18)} Évolution de l’épargne</h2><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Épargne par mois sur ${L.length} mois, cumul ${eur(cum)}">${bars}<path d="${line}" fill="none" stroke="#3ecf8e" stroke-width="2.5" stroke-linejoin="round"/></svg>
   <div class="legend"><span><i style="background:#4ea8ff"></i>${esc(D.names.p1)}</span><span><i style="background:#ff7ab6"></i>${esc(D.names.p2)}</span><span><i style="background:#3ecf8e"></i>Cumul (échelle propre)</span></div></div>`}
/* ---------- Choix de la personne sur cet appareil ---------- */
function whoSheet(){openSheet('Qui utilise cet appareil ?',`<p class="mut">Sert à signer vos modifications dans l’historique. Modifiable dans Réglages.</p>
  <div class="two">${['p1','p2'].map(k=>`<button class="card who" data-me="${k}" style="--pc:${COL[k]}"><span class="avatar big">${esc(N(k)[0]||'?')}</span><b>${esc(N(k))}</b></button>`).join('')}</div>`)}

/* ---------- Navigation, feuilles modales, animations ---------- */
const TABS=[['accueil','Accueil','grid',vAccueil],['budget','Budget','wallet',vBudget],['epargne','Épargne','piggy',vEpargne],['objectifs','Objectifs','target',vObjectifs],['placements','Placements','trend',vPlacements]];
const views=Object.fromEntries(TABS.map(t=>[t[0],t[3]]));views.reglages=vReglages;views.activite=vActivite;
const titles={...Object.fromEntries(TABS.map(t=>[t[0],t[1]])),reglages:'Réglages',activite:'Historique'};
function buildNav(){const n=$('#tabs');n.setAttribute('role','tablist');n.innerHTML=TABS.map(([k,l,i])=>`<button role="tab" data-tab="${k}" aria-controls="view" id="tab-${k}">${ic(i,22)}<span>${l}</span>${k==='placements'?'<i class="tab-badge" hidden></i>':''}</button>`).join('')+'<span class="tab-ind" aria-hidden="true"></span>';
  n.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const b=[...n.querySelectorAll('button')],i=b.indexOf(document.activeElement);if(i<0)return;const j=(i+(e.key==='ArrowRight'?1:-1)+b.length)%b.length;b[j].focus();b[j].click()})}
function go(t){if(t===tab&&$('#view').childElementCount)return;const order=Object.keys(views),dir=order.indexOf(t)>=order.indexOf(tab)?1:-1;tab=t;animate=true;render(dir);scrollTo({top:0})}
function render(dir=0){
  $('#title').textContent=titles[tab];$('#gear').classList.toggle('on',tab==='reglages');
  const i=TABS.findIndex(t=>t[0]===tab);document.querySelectorAll('#tabs button').forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);b.tabIndex=on||(i<0&&b.dataset.tab==='accueil')?0:-1});$('#view').setAttribute('aria-labelledby',i>=0?'tab-'+tab:'title');
  const ind=$('.tab-ind');ind.style.opacity=i<0?0:1;if(i>=0)ind.style.transform=`translateX(${i*100}%)`;
  const ae=document.activeElement,keep=ae&&ae.id&&ae.matches('#view input')?{id:ae.id,s:ae.selectionStart}:null;
  const nd=dueValuations().length,tb=$('#tab-placements .tab-badge');if(tb){tb.hidden=!nd;tb.textContent=nd;$('#tab-placements').setAttribute('aria-label',nd?`Placements, ${nd} valorisation${nd>1?'s':''} à mettre à jour`:'Placements')}
  const v=$('#view');v.innerHTML=views[tab]();
  if(keep){const el=document.getElementById(keep.id);if(el){el.focus();try{el.setSelectionRange(keep.s,keep.s)}catch{}}}
  if(animate&&!reduced()){v.classList.remove('enter-l','enter-r');void v.offsetWidth;v.classList.add(dir<0?'enter-l':'enter-r');countUp(v)}
  requestAnimationFrame(()=>requestAnimationFrame(()=>v.querySelectorAll('.bar i[data-w]').forEach(b=>b.style.width=b.dataset.w+'%')));
  animate=false;
}
function countUp(root){root.querySelectorAll('.num[data-v]').forEach(el=>{const to=+el.dataset.v;if(!to)return;const t0=performance.now(),d=650;
  const step=t=>{const p=Math.min(1,(t-t0)/d),e=1-Math.pow(1-p,3);el.textContent=eur(to*e);if(p<1)requestAnimationFrame(step);else el.textContent=eur(to)};requestAnimationFrame(step)})}
let sheetReturn=null;
function openSheet(title,html,bind){if($('#sheet').hidden){sheetReturn=document.activeElement;try{history.pushState({sheet:1},'')}catch{}}$('#sheetTitle').textContent=title;$('#sheetBody').innerHTML=html;const w=$('#sheet');w.hidden=false;
  requestAnimationFrame(()=>w.classList.add('open'));document.body.classList.add('locked');bind&&bind();
  const first=w.querySelector('input:not([type=radio]):not([type=checkbox]):not([type=range])');if(first&&!first.value&&matchMedia('(pointer:fine)').matches)first.focus()}
function closeSheet(fromPop){const w=$('#sheet');if(w.hidden)return;if(!fromPop&&history.state&&history.state.sheet)history.back();w.classList.remove('open');if(sheetReturn&&document.contains(sheetReturn))sheetReturn.focus();sheetReturn=null;document.body.classList.remove('locked');setTimeout(()=>{if(!w.classList.contains('open'))w.hidden=true},reduced()?0:260)}
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
  if(d.goto){if(d.segTo)budgetSeg=d.segTo;return go(d.goto)}
  if(d.me){me=d.me;localStorage.setItem(ME,me);closeSheet();render();return toast(`Appareil associé à ${N(me)}`)}
  if(t.id==='settle'){const v=+d.amount;if(confirm(`Enregistrer un règlement de ${eur(v)} de ${N(d.from)} à ${N(d.to)} ?`)){D.settlements.push({id:uid(),month:d.month,from:d.from,to:d.to,amount:r2(v),date:new Date().toISOString().slice(0,10)});save();toast('Règlement enregistré')}return}
  if(t.id==='gear'||t.closest('#syncState'))return go('reglages');
  if(d.del){const [l,id]=d.del.split('|'),it=(D[l]||[]).find(x=>x.id===id),nm=it?(it.label||it.name||(it.month?monthLabel(it.month):'')||(it.date?frDate(it.date):'')):'';if(confirm(`Supprimer ${nm?'« '+nm+' »':'cet élément'} ?${l==='placements'?' Son historique de valorisations sera aussi supprimé.':''}`))del(l,id);return}
  if(d.seg){budgetSeg=d.seg;animate=true;return render()}
  if(t.closest('#sheet .sheet-close')||t.id==='sheetBackdrop')return closeSheet();
  if(d.editIncome)return incomeSheet(d.editIncome);if(d.editFixed)return fixedSheet(d.editFixed);if(d.editMonth)return monthSheet(d.editMonth);
  if(d.editGoal)return goalSheet(d.editGoal);if(d.editPlac)return placSheet(d.editPlac);
  ({addIncome:()=>incomeSheet(),addFixed:()=>fixedSheet(),editTransfer:transferSheet,addMisc:miscSheet,quickAdd:miscSheet,openHist:()=>go('activite'),chooseMe:whoSheet,addMonth:()=>monthSheet(),addGoal:()=>goalSheet(),addPlac:()=>placSheet(),
    inviteBtn:showInvite,disconnect:()=>{cfg={};localStorage.removeItem(CFG);lastErr='';render();setSync('Local')},
    exp:()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,2)],{type:'application/json'}));a.download='budget-couple.json';a.click()},
    reset:()=>{if(confirm(sbOn()?'Vider le cache de cet appareil et recharger depuis Supabase ?':'Effacer toutes les données de cet appareil ?')){adopt(blank());render();pullRemote()}}
  }[t.id]||(()=>{}))();
});
$('#sheetBackdrop').addEventListener('click',()=>closeSheet());
addEventListener('popstate',()=>closeSheet(true));
document.addEventListener('input',e=>{const t=e.target;if(t.id==='fixQ'){fixF.q=t.value;render()}if(t.id==='miscQ'){miscF.q=t.value;render()}if(t.id==='histQ'){histF.q=t.value;render()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();if(e.key==='Enter'&&e.target.id==='budgetIn')e.target.blur();
  if(e.key==='Tab'&&!$('#sheet').hidden){const f=[...$('#sheet').querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&x.offsetParent);if(!f.length)return;
    const first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
function toast(t){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';el.setAttribute('role','status');document.body.appendChild(el)}el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2200)}
document.addEventListener('change',async e=>{const t=e.target;
  if(t.id==='fixCat'){fixF.cat=t.value;render()}if(t.id==='miscCat'){miscF.cat=t.value;render()}if(t.id==='miscWho'){miscF.who=t.value;render()}
  if(t.name==='bankF'){bankF=t.value;render()}if(t.name==='histWho'){histF.who=t.value;render()}if(t.name==='goalWho'){goalF=t.value;render()}
  if(t.id==='revMonth'){revMonth=t.value||curMonth();render()}
  if(t.id==='miscMonth'){D.miscMonth=t.value||curMonth();persist();render()}
  if(t.id==='budgetIn'){D.budget[D.miscMonth||curMonth()]=num(t.value);save()}
  if(t.id==='imp'){try{adopt(mergeData(D,migrate(JSON.parse(await t.files[0].text()))));render();pushRemote();alert('Sauvegarde fusionnée avec les données actuelles.')}catch{alert('Fichier invalide')}}
});
// validation commune : champs numériques positifs
document.addEventListener('submit',e=>{const bad=[...e.target.querySelectorAll('input[inputmode=decimal]')].find(i=>i.value.trim()&&(!/^[\d\s]*[.,]?\d*$/.test(i.value.trim())||isNaN(num(i.value))));
  if(bad){e.preventDefault();e.stopImmediatePropagation();bad.setCustomValidity('Saisissez un nombre positif (ex. 12,50)');bad.reportValidity();bad.addEventListener('input',()=>bad.setCustomValidity(''),{once:true})}},true);
document.addEventListener('submit',async e=>{const f=e.target;
  if(f.classList.contains('qval')){e.preventDefault();const v=num(f.value.value);if(!f.value.value.trim()||v<0)return f.value.focus();
    D.valuations.push({id:uid(),pid:f.dataset.pid,date:new Date().toISOString().slice(0,10),value:v});save();toast('Valorisation enregistrée');return}
  if(f.id==='fNames'){e.preventDefault();const v=fd(f);D.names={p1:v.p1||'Personne 1',p2:v.p2||'Personne 2'};D.ratio=Math.min(100,Math.max(0,num(v.ratio)));D.reminderDay=Math.min(28,Math.max(1,parseInt(v.reminderDay)||1));save();toast('Réglages enregistrés')}
  if(f.id==='fSync'){e.preventDefault();const v=fd(f);cfg=normCfg(v);if(cfg.space&&cfg.space.length<8){$('#syncMsg').textContent='Code d’espace trop court (8 caractères minimum).';return}
    localStorage.setItem(CFG,JSON.stringify(cfg));$('#syncMsg').textContent='Connexion…';await pullRemote()}
});
/* ---------- Connexion ---------- */
function netBanner(){$('#offline').hidden=navigator.onLine}
addEventListener('online',()=>{netBanner();pullRemote()});addEventListener('offline',()=>{netBanner();setSync('Hors ligne',false)});
/* ---------- Démarrage ---------- */
persist(); // enregistre la migration locale (sans horodater)
buildNav();render();netBanner();
fetch('rates.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{if(j){RATES=j;if(!document.querySelector('#sheet.open'))render()}}).catch(()=>{});
if(/^#invite=/.test(location.hash))handleInvite();else pullRemote();
if(!me&&!/^#invite=/.test(location.hash))setTimeout(whoSheet,400);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullRemote()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
// rafraîchissement régulier tant que l'appli est visible (récupère les modifications de l'autre téléphone)
setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('#sheet.open'))pullRemote()},15000);
