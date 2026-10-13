'use strict';
const KEY='budget-couple-data',CFG='budget-couple-cfg';
const blank=()=>({version:2,names:{p1:'Emilien',p2:'Julie'},ratio:50,months:[],goals:[],fixed:[],transfer:{from:'p2',amount:0,label:'Virement loyer'},budget:{},misc:[],placements:[],updated:0});
let D=Object.assign(blank(),JSON.parse(localStorage.getItem(KEY)||'{}'));
let cfg=JSON.parse(localStorage.getItem(CFG)||'{}');
let tab='epargne';
const $=s=>document.querySelector(s),uid=()=>Math.random().toString(36).slice(2,10);
const eur=n=>(+n||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=k=>k==='p1'?D.names.p1:k==='p2'?D.names.p2:'Commun';
const COL={p1:'var(--p1)',p2:'var(--p2)',common:'var(--com)'};
const curMonth=()=>new Date().toISOString().slice(0,7);
function save(push=true){D.updated=Date.now();localStorage.setItem(KEY,JSON.stringify(D));render();if(push)pushRemote()}
const num=v=>parseFloat(String(v).replace(',','.'))||0;
const fd=f=>Object.fromEntries(new FormData(f));
function del(list,id){D[list]=D[list].filter(x=>x.id!==id);save()}
window.del=del;
const ownerOpts=(sel,withCommon=true)=>['p1','p2',...(withCommon?['common']:[])].map(k=>`<option value="${k}" ${k===sel?'selected':''}>${esc(N(k))}</option>`).join('');

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
const gName=id=>(D.goals.find(g=>g.id===id)||{name:'?'}).name;
function allocHtml(r,k){if(!r)return'';const e=Object.entries(r.alloc).filter(([,v])=>v>0);
  return `<div class="mut"><b style="color:${COL[k]}">${esc(N(k))}${r.manual?' (manuel)':''}</b> : ${e.map(([g,v])=>`${esc(gName(g))} ${eur(v)}`).join(' · ')||'—'}${r.unassigned>0.004?` · <span class="neg">Non affecté ${eur(r.unassigned)}</span>`:''}</div>`}
/* ---------- Épargne ---------- */
let editMonth=null,manualMode=false;
function vEpargne(){
  const m=[...D.months].sort((a,b)=>b.month.localeCompare(a.month)),C=compute();
  const t1=m.reduce((s,x)=>s+x.a,0),t2=m.reduce((s,x)=>s+x.b,0);
  const un=Object.values(C.res).reduce((s,r)=>s+(r.p1?.unassigned||0)+(r.p2?.unassigned||0),0);
  const ed=editMonth&&D.months.find(x=>x.id===editMonth);
  const manIn=k=>D.goals.filter(g=>g.owner===k||g.owner==='common').map(g=>`<label>${esc(g.name)}<input data-man="${k}|${g.id}" inputmode="decimal" placeholder="0" value="${ed?.manual?.[k]?.[g.id]??''}"></label>`).join('');
  return `<div class="card"><h2>Cumul épargné</h2><div class="grid">
   <div class="stat"><small>${esc(D.names.p1)}</small><b style="color:var(--p1)">${eur(t1)}</b></div>
   <div class="stat"><small>${esc(D.names.p2)}</small><b style="color:var(--p2)">${eur(t2)}</b></div>
   <div class="stat"><small>Total</small><b>${eur(t1+t2)}</b></div>
   <div class="stat"><small>Non affecté</small><b class="${un>0?'neg':''}">${eur(un)}</b></div></div></div>
  <div class="card"><h2>${ed?'Modifier le mois':'Saisir un mois'}</h2><form id="fMonth">
   <label>Mois<input type="month" name="month" value="${ed?ed.month:curMonth()}" required></label>
   <div class="f2"><label>${esc(D.names.p1)} (€)<input name="a" inputmode="decimal" placeholder="0" value="${ed?ed.a:''}"></label>
   <label>${esc(D.names.p2)} (€)<input name="b" inputmode="decimal" placeholder="0" value="${ed?ed.b:''}"></label></div>
   <label style="flex-direction:row;display:flex;gap:8px;align-items:center"><input type="checkbox" id="manualChk" style="width:auto" ${manualMode?'checked':''}> Répartition manuelle</label>
   ${manualMode?`<div class="f2"><div style="display:grid;gap:6px"><b style="color:var(--p1)">${esc(D.names.p1)}</b>${manIn('p1')}</div><div style="display:grid;gap:6px"><b style="color:var(--p2)">${esc(D.names.p2)}</b>${manIn('p2')}</div></div>`:''}
   <div id="preview" class="stat"></div>
   <button class="btn">${ed?'Valider la modification':'Valider la répartition'}</button>${ed?'<button type="button" class="btn ghost" id="cancelEdit">Annuler</button>':''}</form></div>
  <div class="card"><h2>Historique des affectations</h2>${m.length?m.map(x=>`<div class="row"><div class="grow"><b>${new Date(x.month+'-01').toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</b> <b style="float:right">${eur(x.a+x.b)}</b>
   <div class="mut">${esc(D.names.p1)} ${eur(x.a)} · ${esc(D.names.p2)} ${eur(x.b)}</div>${allocHtml(C.res[x.id].p1,'p1')}${allocHtml(C.res[x.id].p2,'p2')}</div>
   <button class="x" onclick="editM('${x.id}')">✎</button><button class="x" onclick="del('months','${x.id}')">✕</button></div>`).join(''):'<div class="empty">Aucun mois saisi</div>'}</div>`;
}
window.editM=id=>{editMonth=id;manualMode=!!D.months.find(x=>x.id===id)?.manual;render();scrollTo(0,0)};
function formEntry(){const f=$('#fMonth');if(!f)return null;const v=fd(f),e={id:editMonth||'__preview',month:v.month||curMonth(),a:num(v.a),b:num(v.b)};
  if(manualMode){e.manual={p1:{},p2:{}};document.querySelectorAll('[data-man]').forEach(i=>{const [k,g]=i.dataset.man.split('|');if(num(i.value))e.manual[k][g]=num(i.value)})}
  return e}
function updatePreview(){const e=formEntry(),p=$('#preview');if(!e||!p)return;
  if(!D.goals.length){p.innerHTML='<span class="mut">Ajoute des objectifs pour activer la répartition automatique.</span>';return}
  const r=compute(e).res[e.id];p.innerHTML='<small>Aperçu de la répartition</small>'+allocHtml(r.p1,'p1')+allocHtml(r.p2,'p2')}
/* ---------- Objectifs ---------- */
function vObjectifs(){
  const C=compute(),cm=curMonth();
  return `<div class="card"><h2>Nouvel objectif</h2><form id="fGoal">
   <label>Nom<input name="name" placeholder="ex. Voyage Japon" required></label>
   <div class="f2"><label>Pour<select name="owner">${ownerOpts('common')}</select></label>
   <label>Date cible<input type="month" name="date"></label></div>
   <div class="f2"><label>Montant cible (€)<input name="target" inputmode="decimal" required></label>
   <label>Déjà économisé avant (€)<input name="saved" inputmode="decimal" placeholder="0"></label></div>
   <button class="btn">Ajouter</button></form>
   <p class="mut">L’épargne saisie chaque mois est répartie automatiquement entre les objectifs perso et communs, au prorata du besoin mensuel (reste ÷ mois restants ; part de chacun selon la répartition des réglages pour les objectifs communs).</p></div>`+
  ['common','p1','p2'].map(g=>{const L=D.goals.filter(x=>x.owner===g);if(!L.length)return'';
   return `<div class="card"><h2><span class="tag" style="background:${COL[g]}">${esc(g==='common'?'Objectifs communs':N(g))}</span></h2>${L.map(x=>{
    const sv=C.saved[x.id],rest=Math.max(0,x.target-sv),p=x.target?Math.min(100,sv/x.target*100):0,mo=x.date?monthsBetween(cm,x.date):0,c=C.contrib[x.id];
    return `<div class="row"><div class="grow"><b>${esc(x.name)}</b> <span class="mut">${p.toFixed(0)} %</span>
     <div class="bar"><i style="width:${p}%"></i></div>
     <div class="mut">${eur(sv)} / ${eur(x.target)} · reste ${eur(rest)}${mo?` · <b>${eur(rest/mo)}/mois</b> sur ${mo} mois`:''}</div>
     <div class="mut">Contributions : <span style="color:var(--p1)">${esc(D.names.p1)} ${eur(c.p1)}</span> · <span style="color:var(--p2)">${esc(D.names.p2)} ${eur(c.p2)}</span>${x.saved?` · initial ${eur(x.saved)}`:''}</div>
     <label style="margin-top:6px">Montant initial (manuel)<input data-goal="${x.id}" inputmode="decimal" value="${x.saved||0}"></label></div>
     <button class="x" onclick="del('goals','${x.id}')">✕</button></div>`}).join('')}</div>`}).join('')+
  (D.goals.length?'':'<div class="empty">Aucun objectif pour l’instant</div>');
}
/* ---------- Dépenses fixes ---------- */
function shares(){
  const r=D.ratio/100;let p1=0,p2=0,c=0;
  D.fixed.forEach(x=>{if(x.payer==='p1')p1+=x.amount;else if(x.payer==='p2')p2+=x.amount;else c+=x.amount});
  return{p1,p2,c,s1:p1+c*r,s2:p2+c*(1-r),total:p1+p2+c};
}
function vFixes(){
  const s=shares(),L=[...D.fixed].sort((a,b)=>a.day-b.day),t=D.transfer,to=t.from==='p1'?'p2':'p1';
  return `<div class="card"><h2>Total mensuel : ${eur(s.total)}</h2><div class="grid">
   <div class="stat"><small>Part ${esc(D.names.p1)}</small><b style="color:var(--p1)">${eur(s.s1)}</b></div>
   <div class="stat"><small>Part ${esc(D.names.p2)}</small><b style="color:var(--p2)">${eur(s.s2)}</b></div>
   <div class="stat"><small>Commun</small><b style="color:var(--com)">${eur(s.c)}</b></div></div>
   <p class="mut">Dépenses communes réparties ${D.ratio} % / ${100-D.ratio} % (modifiable dans Réglages).</p></div>
  <div class="card"><h2>Virement entre vous</h2><form id="fTransfer">
   <label>Libellé<input name="label" value="${esc(t.label)}"></label>
   <div class="f2"><label>De<select name="from">${ownerOpts(t.from,false)}</select></label>
   <label>Montant (€)<input name="amount" inputmode="decimal" value="${t.amount||''}" placeholder="0"></label></div>
   <button class="btn ghost">Mettre à jour</button></form>
   ${t.amount?`<p>${esc(N(t.from))} → ${esc(N(to))} : <b>${eur(t.amount)}</b>/mois</p>`:''}</div>
  <div class="card"><h2>Ajouter une dépense fixe</h2><form id="fFixed">
   <label>Libellé<input name="label" placeholder="ex. Loyer" required></label>
   <div class="f2"><label>Montant (€)<input name="amount" inputmode="decimal" required></label>
   <label>Jour de prélèvement<input name="day" type="number" min="1" max="31" placeholder="1"></label></div>
   <label>Payé par<select name="payer">${ownerOpts('common')}</select></label>
   <button class="btn">Ajouter</button></form></div>
  <div class="card"><h2>Liste</h2>${L.length?L.map(x=>`<div class="row"><span class="dot" style="background:${COL[x.payer]}"></span>
   <div class="grow"><b>${esc(x.label)}</b><div class="mut">le ${x.day||'—'} · ${esc(N(x.payer))}</div></div><b>${eur(x.amount)}</b>
   <button class="x" onclick="del('fixed','${x.id}')">✕</button></div>`).join(''):'<div class="empty">Aucune dépense fixe</div>'}</div>`;
}
/* ---------- Dépenses diverses ---------- */
function vDiverses(){
  const m=D.miscMonth||curMonth(),b=D.budget[m]||0,L=D.misc.filter(x=>x.date.startsWith(m)).sort((a,b)=>b.date.localeCompare(a.date));
  const spent=L.reduce((s,x)=>s+x.amount,0),p=b?Math.min(100,spent/b*100):0;
  return `<div class="card"><label>Mois<input type="month" id="miscMonth" value="${m}"></label>
   <label style="margin-top:8px">Budget disponible ce mois (€)<input id="budgetIn" inputmode="decimal" value="${b||''}" placeholder="0"></label>
   <div class="grid" style="margin-top:10px"><div class="stat"><small>Dépensé</small><b>${eur(spent)}</b></div>
   <div class="stat"><small>Restant</small><b class="${b-spent<0?'neg':'pos'}">${eur(b-spent)}</b></div></div>
   <div class="bar ${spent>b&&b?'over':''}"><i style="width:${p}%"></i></div></div>
  <div class="card"><h2>Ajouter une dépense</h2><form id="fMisc">
   <div class="f2"><label>Date<input type="date" name="date" value="${m===curMonth()?new Date().toISOString().slice(0,10):m+'-01'}" required></label>
   <label>Montant (€)<input name="amount" inputmode="decimal" required></label></div>
   <div class="f2"><label>Libellé<input name="label" placeholder="ex. Courses" required></label>
   <label>Par<select name="payer">${ownerOpts('common')}</select></label></div>
   <button class="btn">Ajouter</button></form></div>
  <div class="card"><h2>Dépenses du mois</h2>${L.length?L.map(x=>`<div class="row"><span class="dot" style="background:${COL[x.payer]}"></span>
   <div class="grow"><b>${esc(x.label)}</b><div class="mut">${new Date(x.date).toLocaleDateString('fr-FR')} · ${esc(N(x.payer))}</div></div><b>${eur(x.amount)}</b>
   <button class="x" onclick="del('misc','${x.id}')">✕</button></div>`).join(''):'<div class="empty">Aucune dépense</div>'}</div>`;
}
/* ---------- Placements : projection 48 mois ---------- */
function project(list,months=48){ // intérêts composés mensuels, versement en fin de mois
  const series=[];let vals=list.map(p=>p.capital),inv=list.map(p=>p.capital);
  series.push({total:vals.reduce((a,b)=>a+b,0),inv:inv.reduce((a,b)=>a+b,0)});
  for(let m=1;m<=months;m++){vals=vals.map((v,i)=>v*(1+list[i].rate/100/12)+list[i].monthly);inv=inv.map((v,i)=>v+list[i].monthly);
    series.push({total:vals.reduce((a,b)=>a+b,0),inv:inv.reduce((a,b)=>a+b,0),vals:[...vals]})}
  return series;
}
function chart(s){
  const W=340,H=170,P=30,max=Math.max(1,...s.map(x=>x.total)),X=i=>P+i*(W-P-8)/48,Y=v=>H-20-v/max*(H-35);
  const line=k=>s.map((x,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(x[k]).toFixed(1)}`).join('');
  const ticks=[12,24,36,48].map(i=>`<line x1="${X(i)}" x2="${X(i)}" y1="10" y2="${H-20}" stroke="#2a3145"/><text x="${X(i)}" y="${H-5}" fill="#8a93a8" font-size="10" text-anchor="${i===48?"end":"middle"}">An ${i/12}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Projection sur 4 ans">${ticks}
   <path d="${line('total')} L${X(48)},${Y(0)} L${X(0)},${Y(0)}Z" fill="rgba(62,207,142,.15)"/>
   <path d="${line('total')}" stroke="#3ecf8e" stroke-width="2" fill="none"/><path d="${line('inv')}" stroke="#5b8cff" stroke-width="2" stroke-dasharray="4 3" fill="none"/>
   <text x="${P}" y="12" fill="#3ecf8e" font-size="10">— Valeur</text><text x="${P+60}" y="12" fill="#5b8cff" font-size="10">- - Versé</text></svg>`;
}
function vPlacements(){
  const L=D.placements,s=project(L);
  return `<div class="card"><h2>Ajouter un placement</h2><form id="fPlac">
   <div class="f2"><label>Nom<input name="name" placeholder="ex. Livret A" required></label><label>Titulaire<select name="owner">${ownerOpts('common')}</select></label></div>
   <div class="f2"><label>Capital actuel (€)<input name="capital" inputmode="decimal" placeholder="0"></label><label>Versement mensuel (€)<input name="monthly" inputmode="decimal" placeholder="0"></label></div>
   <label>Taux annuel (%)<input name="rate" inputmode="decimal" placeholder="ex. 3"></label>
   <button class="btn">Ajouter</button></form></div>
  <div class="card"><h2>Projection sur 4 ans (48 mois)</h2>
   ${L.length?chart(s)+[1,2,3,4].map(y=>{const x=s[y*12];return `<div class="row"><div class="grow"><b>Fin d’année ${y}</b><div class="mut">Versé ${eur(x.inv)} · intérêts <span class="pos">${eur(x.total-x.inv)}</span></div></div><b>${eur(x.total)}</b></div>`}).join('')
   :'<div class="empty">Ajoute un placement pour voir la projection</div>'}
   <p class="mut">Intérêts composés mensuellement (taux annuel / 12), versements permanents chaque fin de mois.</p></div>
  <div class="card"><h2>Placements</h2>${L.length?L.map((x,i)=>`<div class="row"><span class="dot" style="background:${COL[x.owner]}"></span>
   <div class="grow"><b>${esc(x.name)}</b><div class="mut">${eur(x.capital)} · +${eur(x.monthly)}/mois · ${x.rate} % · dans 4 ans ≈ ${eur(s[48].vals[i])}</div></div>
   <button class="x" onclick="del('placements','${x.id}')">✕</button></div>`).join(''):'<div class="empty">Aucun placement</div>'}</div>`;
}
/* ---------- Réglages ---------- */
function vReglages(){
  return `<div class="card"><h2>Prénoms & répartition</h2><form id="fNames">
   <div class="f2"><label>Personne 1<input name="p1" value="${esc(D.names.p1)}"></label><label>Personne 2<input name="p2" value="${esc(D.names.p2)}"></label></div>
   <label>Part de la personne 1 dans les dépenses communes (%)<input name="ratio" type="number" min="0" max="100" value="${D.ratio}"></label>
   <button class="btn">Enregistrer</button></form></div>
  <div class="card"><h2>Synchronisation Supabase (optionnel)</h2><form id="fSync">
   <label>URL du projet<input name="url" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url||'')}"></label>
   <label>Clé anon (publique)<input name="key" value="${esc(cfg.key||'')}"></label>
   <label>Code d’espace partagé (même code sur vos deux téléphones)<input name="space" value="${esc(cfg.space||'')}" placeholder="un code long et secret"></label>
   <button class="btn">Enregistrer & synchroniser</button>
   <button type="button" class="btn ghost" id="disconnect">Désactiver la synchro</button></form>
   <p class="mut" id="syncMsg"></p></div>
  <div class="card"><h2>Sauvegarde</h2><div class="f2"><button class="btn ghost" id="exp">Exporter (JSON)</button>
   <label class="btn ghost" style="text-align:center;color:var(--txt);font-size:15px">Importer<input type="file" id="imp" accept=".json" hidden></label></div>
   <button class="btn ghost" id="reset" style="margin-top:8px;width:100%;color:var(--bad)">Tout effacer</button></div>`;
}
/* ---------- Supabase (REST, sans SDK) ---------- */
const sbOn=()=>cfg.url&&cfg.key&&cfg.space;
const sbH=()=>({apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'});
function setSync(t,on){const b=$('#syncState');b.textContent=t;b.className='badge'+(on?' on':'')}
async function pullRemote(){
  if(!sbOn())return setSync('Local');
  try{const r=await fetch(`${cfg.url}/rest/v1/budget_spaces?code=eq.${encodeURIComponent(cfg.space)}&select=data,updated_at`,{headers:sbH()});
    if(!r.ok)throw new Error(r.status);const [row]=await r.json();
    if(row&&row.data&&(row.data.updated||0)>(D.updated||0)){D=Object.assign(blank(),row.data);save(false)}
    else if(!row||(D.updated||0)>(row.data?.updated||0))await pushRemote();
    setSync('Synchro ✓',true)}catch(e){setSync('Hors ligne');console.warn('sync',e)}
}
let pt;function pushRemote(){if(!sbOn())return;clearTimeout(pt);return new Promise(res=>pt=setTimeout(async()=>{
  try{const r=await fetch(`${cfg.url}/rest/v1/budget_spaces?on_conflict=code`,{method:'POST',headers:{...sbH(),Prefer:'resolution=merge-duplicates'},body:JSON.stringify({code:cfg.space,data:D,updated_at:new Date().toISOString()})});
   if(!r.ok)throw new Error(r.status);setSync('Synchro ✓',true)}catch(e){setSync('Hors ligne');console.warn('push',e)}res()},600))}
/* ---------- Rendu & événements ---------- */
const views={epargne:vEpargne,objectifs:vObjectifs,fixes:vFixes,diverses:vDiverses,placements:vPlacements,reglages:vReglages};
function render(){$('#view').innerHTML=views[tab]();bind()}
function on(sel,ev,fn){const e=$(sel);if(e)e.addEventListener(ev,fn)}
function bind(){
  on('#fMonth','submit',e=>{e.preventDefault();const en=formEntry();if(!manualMode)delete en.manual;
    const ex=D.months.find(x=>x.id===editMonth)||D.months.find(x=>x.month===en.month);
    if(ex)Object.assign(ex,{month:en.month,a:en.a,b:en.b,manual:en.manual});else{en.id=uid();D.months.push(en)}
    if(ex&&!en.manual)delete ex.manual;D.months=D.months.filter((x,i,arr)=>x===ex||!ex||x.month!==ex.month);editMonth=null;manualMode=false;save()});
  on('#fMonth','input',updatePreview);updatePreview();
  on('#manualChk','change',e=>{const keep=formEntry();manualMode=e.target.checked;render();const f=$('#fMonth');f.month.value=keep.month;f.a.value=keep.a||'';f.b.value=keep.b||'';updatePreview()});
  on('#cancelEdit','click',()=>{editMonth=null;manualMode=false;render()});
  on('#fGoal','submit',e=>{e.preventDefault();const f=fd(e.target);D.goals.push({id:uid(),name:f.name,owner:f.owner,date:f.date,target:num(f.target),saved:num(f.saved)});save()});
  document.querySelectorAll('[data-goal]').forEach(i=>i.addEventListener('change',()=>{D.goals.find(g=>g.id===i.dataset.goal).saved=num(i.value);save()}));
  on('#fFixed','submit',e=>{e.preventDefault();const f=fd(e.target);D.fixed.push({id:uid(),label:f.label,amount:num(f.amount),day:parseInt(f.day)||0,payer:f.payer});save()});
  on('#fTransfer','submit',e=>{e.preventDefault();const f=fd(e.target);D.transfer={label:f.label,from:f.from,amount:num(f.amount)};save()});
  on('#miscMonth','change',e=>{D.miscMonth=e.target.value;save(false)});
  on('#budgetIn','change',e=>{D.budget[D.miscMonth||curMonth()]=num(e.target.value);save()});
  on('#fMisc','submit',e=>{e.preventDefault();const f=fd(e.target);D.misc.push({id:uid(),date:f.date,label:f.label,amount:num(f.amount),payer:f.payer});save()});
  on('#fPlac','submit',e=>{e.preventDefault();const f=fd(e.target);D.placements.push({id:uid(),name:f.name,owner:f.owner,capital:num(f.capital),monthly:num(f.monthly),rate:num(f.rate)});save()});
  on('#fNames','submit',e=>{e.preventDefault();const f=fd(e.target);D.names={p1:f.p1||'Personne 1',p2:f.p2||'Personne 2'};D.ratio=Math.min(100,Math.max(0,num(f.ratio)));save()});
  on('#fSync','submit',async e=>{e.preventDefault();const f=fd(e.target);cfg={url:f.url.trim().replace(/\/$/,''),key:f.key.trim(),space:f.space.trim()};
    localStorage.setItem(CFG,JSON.stringify(cfg));$('#syncMsg').textContent='Connexion…';await pullRemote();$('#syncMsg').textContent=$('#syncState').textContent});
  on('#disconnect','click',()=>{cfg={};localStorage.removeItem(CFG);render();setSync('Local')});
  on('#exp','click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,2)],{type:'application/json'}));a.download='budget-couple.json';a.click()});
  on('#imp','change',async e=>{try{D=Object.assign(blank(),JSON.parse(await e.target.files[0].text()));save()}catch{alert('Fichier invalide')}});
  on('#reset','click',()=>{if(confirm('Effacer toutes les données de cet appareil ?')){D=blank();save()}});
}
document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('active',x===b));tab=b.dataset.tab;render();scrollTo(0,0)}));
render();pullRemote();
window.addEventListener('focus',pullRemote);
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
