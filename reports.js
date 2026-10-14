'use strict';
/* ---------- Bilan du mois : généré automatiquement le 1er pour le mois écoulé ---------- */
const prevMonthOf=m=>{const [y,mo]=m.split('-').map(Number),d=new Date(y,mo-2,15);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
function goalsAt(m){const C=compute(),S={};D.goals.forEach(g=>S[g.id]=+g.saved||0);
  D.months.filter(x=>x.month<=m).forEach(x=>{const r=C.res[x.id]||{};['p1','p2'].forEach(k=>Object.entries((r[k]||{}).alloc||{}).forEach(([gid,v])=>{if(gid in S)S[gid]+=v}))});
  return D.goals.map(g=>({id:g.id,name:g.name,target:+g.target||0,saved:r2(S[g.id])}))}
function buildReport(m){const pm=prevMonthOf(m),sv=k=>savingOf(k,m),a=summary('p1',m),b=summary('p2',m),misc=D.misc.filter(x=>x.date.startsWith(m)),cats={};
  misc.forEach(x=>cats[x.category||'autre']=(cats[x.category||'autre']||0)+x.amount);const [Y,M]=m.split('-').map(Number);
  const ints=D.interests.filter(i=>!i.skipped&&(i.date||'').startsWith(m)).map(i=>({pid:i.pid,year:i.year,amount:+i.amount||0}));
  return{id:'rep-'+m,month:m,created:Date.now(),savings:{p1:r2(sv('p1')),p2:r2(sv('p2'))},prevSavings:r2(savingOf('p1',pm)+savingOf('p2',pm)),
    income:r2(a.rev+b.rev),fixed:r2(D.fixed.reduce((s,f)=>s+f.amount,0)),misc:r2(misc.reduce((s,x)=>s+x.amount,0)),budget:+D.budget[m]||0,
    cats:Object.entries(cats).sort((x,y)=>y[1]-x[1]).slice(0,5).map(([c,v])=>[c,r2(v)]),goals:goalsAt(m),interests:ints,
    placements:r2(D.placements.reduce((s,p)=>s+placValue(p),0)),rest:r2(a.rest+b.rest-(a.mi+b.mi)),days:new Date(Y,M,0).getDate()}}
// un bilan n'a de sens que si l'appli était déjà utilisée pendant ce mois
const hasActivity=m=>D.months.some(x=>x.month===m)||D.misc.some(x=>x.date.startsWith(m))||((D.incomes.length||D.fixed.length)&&D.history.some(h=>h.t<new Date(m+'-01T00:00').getTime()+31*864e5&&h.t<new Date(curMonth()+'-01T00:00').getTime()));
/* Génère (une seule fois, id déterministe) le bilan du mois précédent dès le 1er. */
function ensureReports(){const pm=prevMonthOf(curMonth());if(D.reports.some(r=>r.month===pm)||!hasActivity(pm))return null;
  const r=buildReport(pm);D.reports.push(r);return r}
function reportNotify(r){if(!D.notify?.reports||!('Notification' in window)||Notification.permission!=='granted')return;
  const t=`Bilan de ${monthLabel(r.month)}`,body=`Épargne : ${eur(r.savings.p1+r.savings.p2)} · dépenses diverses : ${eur(r.misc)}`;
  navigator.serviceWorker?.getRegistration().then(g=>g?g.showNotification(t,{body,icon:'icons/icon-192.png',tag:r.id}):new Notification(t,{body})).catch(()=>{})}
const seenRep=()=>{try{return JSON.parse(localStorage.getItem('bc-rep-seen')||'[]')}catch{return[]}};
function reportCard(){const pm=prevMonthOf(curMonth()),r=D.reports.find(x=>x.month===pm);if(!r||new Date().getDate()>7||seenRep().includes(r.id))return'';const ep=r.savings.p1+r.savings.p2,d=ep-r.prevSavings;
  return `<div class="card rep-card"><h2>${ic('chart',18)} Bilan de ${monthLabel(r.month)}</h2><div class="hero-grid"><div><small>Épargné</small>${money(ep)}</div><div><small>vs mois précédent</small><b class="${d>=0?'pos':'neg'}">${d>=0?'+':'−'}${eur(Math.abs(d))}</b></div></div>
   <div class="f2"><button class="btn small" data-rep="${r.id}">Voir le bilan</button><button class="btn ghost small" data-rep-seen="${r.id}">Plus tard</button></div></div>`}
function reportHtml(r){const ep=r.savings.p1+r.savings.p2,d=ep-r.prevSavings,prev=D.reports.find(x=>x.month===prevMonthOf(r.month)),pg=Object.fromEntries((prev?.goals||[]).map(g=>[g.id,g.saved]));
  const pname=pid=>{const p=D.placements.find(x=>x.id===pid);return p?(p.name||ptype(p.type)[1]):'Placement'};
  return `<div class="hero-grid"><div><small>Épargné</small><b>${eur(ep)}</b></div><div><small>vs ${monthLabel(prevMonthOf(r.month))}</small><b class="${d>=0?'pos':'neg'}">${d>=0?'+':'−'}${eur(Math.abs(d))}</b></div>
   <div><small>${esc(N('p1'))}</small><b>${eur(r.savings.p1)}</b></div><div><small>${esc(N('p2'))}</small><b>${eur(r.savings.p2)}</b></div>
   <div><small>Revenus</small><b>${eur(r.income)}</b></div><div><small>Taux d’épargne</small><b>${r.income?Math.round(ep/r.income*100):0} %</b></div></div>
   <h3 class="group">Charges & dépenses</h3><ul class="bal-l"><li><span>Charges fixes</span><b>${eur(r.fixed)}</b></li><li><span>Dépenses diverses</span><small>${r.budget?`budget ${eur(r.budget)}`:''}</small><b class="${r.budget&&r.misc>r.budget?'neg':''}">${eur(r.misc)}</b></li>
   ${r.cats.map(([c,v])=>`<li><span>· ${esc((typeof catLabel==='function'?catLabel(c):c))}</span><b>${eur(v)}</b></li>`).join('')}</ul>
   <h3 class="group">Objectifs</h3>${r.goals.length?`<ul class="bal-l">${r.goals.map(g=>{const p=g.target?Math.min(100,g.saved/g.target*100):0,dd=g.id in pg?g.saved-pg[g.id]:null;return `<li><span>${esc(g.name)}</span><small>${p.toFixed(0)} %${dd?` · ${dd>0?'+':'−'}${eur(Math.abs(dd))}`:''}</small><b>${eur(g.saved)}</b></li>`}).join('')}</ul>`:'<p class="mut">Aucun objectif.</p>'}
   <h3 class="group">Placements & intérêts</h3><ul class="bal-l"><li><span>Total des placements (à la génération)</span><b>${eur(r.placements)}</b></li>${r.interests.map(i=>`<li><span>Intérêts ${i.year} · ${esc(pname(i.pid))}</span><b class="pos">${eur(i.amount)}</b></li>`).join('')}</ul>
   <p class="mut">Généré le ${new Date(r.created).toLocaleDateString('fr-FR')}. Instantané : il n’est pas recalculé si vous modifiez les données ensuite.</p>`}
function reportSheet(id){const r=D.reports.find(x=>x.id===id);if(!r)return;const s=seenRep();if(!s.includes(id)){s.push(id);localStorage.setItem('bc-rep-seen',JSON.stringify(s.slice(-36)))}
  openSheet(`Bilan de ${monthLabel(r.month)}`,reportHtml(r)+`<button class="btn ghost" data-rep-regen="${r.id}">${ic('repeat',16)} Recalculer avec les données actuelles</button>`,()=>{})}
function vBilans(){const L=[...D.reports].sort((a,b)=>b.month.localeCompare(a.month));
  return `<p class="mut">Un bilan est créé automatiquement le 1er de chaque mois pour le mois écoulé.</p>
  <div class="list">${L.map(r=>{const ep=r.savings.p1+r.savings.p2;return `<button class="item" data-rep="${r.id}"><span class="grow"><b>${esc(monthLabel(r.month))}</b><small>Épargne ${eur(ep)} · dépenses ${eur(r.misc)}</small></span>${ic('chev',16)}</button>`}).join('')||empty('chart','Le premier bilan apparaîtra le 1er du mois prochain.')}</div>
  <button class="btn ghost wide" id="repNow">Générer le bilan du mois en cours (provisoire)</button>`}
document.addEventListener('click',e=>{const t=e.target.closest('[data-rep],[data-rep-seen],[data-rep-regen],#repNow');if(!t)return;
  if(t.dataset.rep)reportSheet(t.dataset.rep);
  else if(t.dataset.repSeen){const s=seenRep();s.push(t.dataset.repSeen);localStorage.setItem('bc-rep-seen',JSON.stringify(s.slice(-36)));render()}
  else if(t.dataset.repRegen){const r=D.reports.find(x=>x.id===t.dataset.repRegen);if(!r)return;Object.assign(r,buildReport(r.month));save();reportSheet(r.id);toast('Bilan recalculé')}
  else{const m=curMonth(),r=buildReport(m);r.id='rep-'+m;r.provisional=true;const ex=D.reports.find(x=>x.id===r.id);if(ex)Object.assign(ex,r);else D.reports.push(r);save();reportSheet(r.id)}});
