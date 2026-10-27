'use strict';
/* v15 (interface) : charges annuelles, précaution, crédits, patrimoine, abonnements, bilan annuel, sauvegarde, rappels.
   Calculs dans plan.js (testés sous Node). Chargé avant app.js : n'utilise les fonctions d'app.js qu'à l'exécution. */
const H15=k=>{try{return({fixes:annualCard,diverses:subsCard,epargne:precauCard,placements:nwLinkCard}[k]||(()=>''))()}catch(e){console.error(e);return''}};
const MONTHS_FR=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const fr1=v=>(+v).toLocaleString('fr-FR',{maximumFractionDigits:1});
const splitOf=a=>a.split==null||a.split===''?D.ratio:+a.split;
const annIn=a=>({...a,split:splitOf(a)});
/* ---------- 1) Charges annuelles lissées (Budget › Charges) ---------- */
function annualCard(){const cm=curMonth(),L=D.annuals.map(a=>({a,p:annualPlan(annIn(a),cm)})).sort((x,y)=>x.p.due.localeCompare(y.p.due)),T=annualTotals(D.annuals.map(annIn),cm);
  return `<section id="sec-annuels" class="v15" aria-labelledby="h-ann"><div class="sec"><h2 id="h-ann" tabindex="-1">Charges annuelles lissées</h2>${addBtn('addAnnual')}</div>
  ${L.length?`<div class="card"><small class="mut">À provisionner ce mois-ci</small><div class="big num">${eur(T.monthly)}</div><small class="mut">${esc(N('p1'))} ${eur(T.p1)} · ${esc(N('p2'))} ${eur(T.p2)} · ${eur(T.year)} par an, soit ${eur(T.smoothed)}/mois si lissé sur 12 mois</small></div>`:''}
  <div class="list">${L.map(({a,p})=>`<div class="item col ann" data-id="${a.id}"><button class="plain row-b" data-ann-edit="${a.id}" aria-label="Modifier ${esc(a.label)}"><span class="grow"><b>${esc(a.label)}</b><small>Échéance ${monthLabel(p.due)} · ${eur(p.amount)}</small></span><span class="r">${money(p.monthly)}<small class="mut">${p.ready?'prête':'/mois · '+p.months+' mois'}</small></span></button>
    ${bar(p.pct,p.ready?'done':'')}<small class="mut">Provisionné ${eur(p.saved)} sur ${eur(p.amount)}${p.ready?'':` · ${esc(N('p1'))} ${eur(p.per.p1)} / ${esc(N('p2'))} ${eur(p.per.p2)} par mois`}</small>
    <div class="row-act"><button class="btn ghost small" data-ann-save="${a.id}" ${p.ready?'disabled':''}>${ic('plus',14)} Provision du mois</button><button class="btn ghost small" data-ann-paid="${a.id}">Marquer payée</button></div></div>`).join('')||empty('calendar','Taxe foncière, assurance auto, cadeaux de Noël… ajoutez vos dépenses annuelles pour les lisser sur l’année.')}</div></section>`}
function annualSheet(id){const a=D.annuals.find(x=>x.id===id)||{month:+curMonth().slice(5,7),split:D.ratio,saved:0};
  openSheet(id?'Modifier la charge annuelle':'Nouvelle charge annuelle',`<form id="fAnnual">
   <label>Libellé<input name="label" value="${esc(a.label||'')}" placeholder="ex. Taxe foncière" required></label>
   <div class="f2"><label>Montant annuel (€)<input name="amount" inputmode="decimal" value="${a.amount??''}" required></label>
   <label>Mois d’échéance<select name="month">${MONTHS_FR.map((n,i)=>`<option value="${i+1}" ${+a.month===i+1?'selected':''}>${n}</option>`).join('')}</select></label></div>
   <div class="f2"><label>Part de ${esc(N('p1'))} (%)<input name="split" type="number" min="0" max="100" step="5" value="${splitOf(a)}"></label>
   <label>Déjà provisionné (€)<input name="saved" inputmode="decimal" value="${a.saved||''}" placeholder="0"></label></div>
   <label>Catégorie<select name="category">${catOpts('fixed',a.category||'autre')}</select></label>
   <p class="mut">Le montant à mettre de côté chaque mois = reste à provisionner ÷ mois restants avant l’échéance. ${esc(N('p2'))} prend en charge le reste du pourcentage.</p>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="annuals|${id}">${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>{
   $('#fAnnual').addEventListener('submit',e=>{e.preventDefault();const v=fd(e.target),amt=r2(num(v.amount));if(!v.label.trim()||!(amt>0))return toast('Indiquez un libellé et un montant');
    const o={label:v.label.trim(),amount:amt,month:Math.min(12,Math.max(1,parseInt(v.month)||1)),split:Math.max(0,Math.min(100,parseInt(v.split)||0)),saved:r2(Math.max(0,num(v.saved))),category:v.category};
    if(id)Object.assign(D.annuals.find(x=>x.id===id),o);else D.annuals.push({id:uid(),...o});closeSheet();save();toast('Charge annuelle enregistrée')})})}
/* ---------- 2) Épargne de précaution (Épargne) ---------- */
function precauData(){const fixed=D.fixed.reduce((s,f)=>s+(+f.amount||0),0),am=avgMisc(3),liv=D.placements.filter(p=>LIVRETS.includes(p.type));
  return{...precaution(liv.reduce((s,p)=>s+placValue(p),0),fixed+am.avg),fixed,misc:am.avg,miscMonths:am.months,count:liv.length}}
function precauCard(){const P=precauData();if(P.level==='none')return `<div class="card v15" id="precau"><h2>${ic('shield',18)} Épargne de précaution</h2><p class="mut">Ajoutez vos charges fixes ou quelques dépenses pour estimer combien de mois de dépenses vos livrets couvrent.</p></div>`;
  const w=Math.min(100,P.months/6*100),txt={critical:'Moins d’un mois de dépenses de côté : un imprévu (panne, réparation) serait difficile à absorber sans découvert.',low:'Entre 1 et 3 mois de dépenses : c’est un début. Le repère souvent cité est de 3 à 6 mois.',ok:'Vous êtes dans la fourchette souvent citée de 3 à 6 mois de dépenses.',high:'Au-delà de 6 mois : la réserve dépasse le repère habituel ; c’est un choix personnel selon votre situation.'}[P.level];
  return `<div class="card v15" id="precau"><h2>${ic('shield',18)} Épargne de précaution</h2>
  <div class="row-b"><div><div class="big num">${fr1(P.months)} mois</div><small class="mut">de dépenses couvertes par vos livrets</small></div><span class="tag lv-${P.level}">${{critical:'À constituer',low:'En cours',ok:'Dans le repère',high:'Au-delà du repère'}[P.level]}</span></div>
  <div class="gauge" role="meter" aria-label="Mois de dépenses couverts" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${Math.min(6,+P.months.toFixed(1))}" aria-valuetext="${fr1(P.months)} mois sur un repère de 3 à 6 mois"><b class="zone"></b><i class="lv-${P.level}" style="width:${w}%"></i></div>
  <div class="gauge-l" aria-hidden="true"><span>0</span><span>3 mois</span><span>6 mois +</span></div>
  <p>${txt}</p><ul class="bal-l"><li><span>Livrets disponibles (${P.count})</span><b>${eur(P.available)}</b></li><li><span>Dépenses mensuelles</span><b>${eur(P.monthly)}</b><small>${eur(P.fixed)} de charges fixes${P.miscMonths?` + ${eur(P.misc)} de dépenses diverses (moyenne ${P.miscMonths} mois)`:''}</small></li><li><span>Repère 3 à 6 mois</span><b>${eur(P.low)} – ${eur(P.high)}</b></li></ul>
  <p class="mut note">Calcul indicatif et pédagogique, pas un conseil : seuls les livrets (A, LDDS, LEP, CEL, Livret Jeune) sont comptés, car disponibles à tout moment.</p></div>`}
/* ---------- 3) Crédits + 4) Patrimoine net (vue « Patrimoine ») ---------- */
const OWN=o=>o==='joint'?'common':o==='p1'||o==='p2'?o:'common';
function nwNow(){const cm=curMonth(),assets=[...D.accounts.filter(a=>a.balance!==undefined&&a.balance!==null&&a.balance!=='').map(a=>({owner:OWN(a.owner),value:+a.balance||0,label:a.label||'Compte',kind:'Compte'})),
  ...D.placements.map(p=>({owner:OWN(p.owner),value:placValue(p),label:p.name||(PTYPES.find(t=>t[0]===p.type)||[,'Placement'])[1],kind:'Placement'}))];
  const debts=D.loans.map(l=>({owner:OWN(l.owner),value:loanStatus(l,cm).remaining,label:l.label||'Crédit',kind:'Crédit'}));return{assets,debts,W:netWorth(assets,debts)}}
let nwPending=false;
function nwSnapshot(W){const m=curMonth(),id='nw-'+m,v={month:m,p1:W.net.p1,p2:W.net.p2,common:W.net.common,total:W.net.total,assets:W.assets.total,debts:W.debts.total},x=D.networth.find(n=>n.id===id);
  if(!W.assets.total&&!W.debts.total&&!x)return;if(x&&['p1','p2','common','total','assets','debts'].every(k=>x[k]===v[k]))return;
  if(nwPending)return;nwPending=true;setTimeout(()=>{nwPending=false;const y=D.networth.find(n=>n.id===id);if(y)Object.assign(y,v);else D.networth.push({id,...v});save()},0)}
function nwLinkCard(){const {W}=nwNow();if(!D.loans.length&&!W.assets.total)return'';
  return `<button class="card item v15 nwlink" data-goto="patrimoine"><span class="grow"><small class="mut">Patrimoine net (actifs − crédits)</small><b class="num">${eur(W.net.total)}</b><small class="mut">${D.loans.length?`${D.loans.length} crédit${D.loans.length>1?'s':''} · `:''}détail et évolution</small></span>${ic('chev',16)}</button>`}
function vPatrimoine(){const {assets,debts,W}=nwNow(),cm=curMonth();nwSnapshot(W);
  const H=D.networth.filter(n=>/^\d{4}-\d{2}$/.test(n.month||'')).sort((a,b)=>a.month.localeCompare(b.month));
  const col=k=>`<td class="num">${eur(W.assets[k])}</td>`,row=(lab,o,cls='')=>`<tr class="${cls}"><th scope="row">${lab}</th>${['p1','p2','common','total'].map(k=>`<td class="num ${cls&&o[k]<0?'neg':''}">${eur(cls==='debt'?-o[k]:o[k])}</td>`).join('')}</tr>`;
  return `<div class="card hero"><small>Patrimoine net du couple</small><div class="hero-n">${money(W.net.total,W.net.total<0?'neg':'')}</div>
   <div class="two-k"><div style="--pc:var(--p1)"><small><span class="dot"></span>${esc(N('p1'))}</small>${money(W.net.p1)}</div><div style="--pc:var(--p2)"><small><span class="dot"></span>${esc(N('p2'))}</small>${money(W.net.p2)}</div></div><small>Commun : ${eur(W.net.common)}</small></div>
  <div class="card"><h2>Répartition</h2><div class="tbl-w" tabindex="0" role="region" aria-label="Tableau défilant"><table class="tbl"><caption class="sr-only">Actifs, crédits et patrimoine net par personne</caption><thead><tr><th scope="col"></th><th scope="col">${esc(N('p1'))}</th><th scope="col">${esc(N('p2'))}</th><th scope="col">Commun</th><th scope="col">Total</th></tr></thead>
   <tbody>${row('Actifs',W.assets)}${row('Crédits',W.debts,'debt')}${row('<b>Net</b>',W.net,'net')}</tbody></table></div>
   <p class="mut note">Actifs = dernier solde saisi des comptes + valeur actuelle des placements. Crédits = capital restant dû au ${monthLabel(cm)}. Un crédit commun compte dans la colonne Commun.</p></div>
  <div class="card"><h2>${ic('trend',18)} Évolution mensuelle</h2>${H.length>=2?interactiveChart({title:'Évolution du patrimoine net',type:'line',series:[{key:'total',name:'Net total',color:'#3ecf8e'},{key:'p1',name:N('p1'),color:'#4ea8ff'},{key:'p2',name:N('p2'),color:'#ff7ab6'}],
     points:H.map((h,i)=>({label:monthLabel(h.month),short:new Date(h.month+'-15T12:00').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}),values:{total:h.total,p1:h.p1,p2:h.p2},detail:`Actifs ${eur(h.assets)} · crédits ${eur(h.debts)}${i?` · variation ${eur(h.total-H[i-1].total)}`:''}`}))})
    :`<p class="mut">Un point est enregistré chaque mois où cette page est ouverte : la courbe apparaît dès le 2ᵉ mois.${H.length?` Premier point : ${monthLabel(H[0].month)}.`:''}</p>`}</div>
  ${sec('Crédits',addBtn('addLoan'))}<div class="list">${D.loans.map(l=>{const s=loanStatus(l,cm);return `<button class="item col" data-loan="${l.id}"><span class="row-b"><b>${esc(l.label||'Crédit')}</b>${money(s.remaining)}</span>${bar(s.pct,s.done?'done':'')}
    <small>${s.error?`<span class="neg">${esc(s.error)}</span>`:`${eur(s.payment)}/mois${s.insurance?` + ${eur(s.insurance)} d’assurance`:''} · fin ${monthLabel(s.end)} · ${esc(N(OWN(l.owner)))}`}</small></button>`}).join('')||empty('home','Ajoutez un crédit immobilier, auto ou conso pour suivre le capital restant dû.')}</div>
  ${sec('Actifs')}<div class="list">${assets.map(a=>`<div class="item"><span class="grow"><b>${esc(a.label)}</b><small>${a.kind} · ${esc(N(a.owner))}</small></span>${money(a.value)}</div>`).join('')||empty('wallet','Aucun compte avec solde ni placement.')}</div>`}
function loanSheet(id){const l=D.loans.find(x=>x.id===id)||{owner:'common',start:curMonth()};
  openSheet(id?'Modifier le crédit':'Nouveau crédit',`<form id="fLoan">
   <label>Libellé<input name="label" value="${esc(l.label||'')}" placeholder="ex. Prêt immobilier" required></label>
   <div class="f2"><label>Capital emprunté (€)<input name="principal" inputmode="decimal" value="${l.principal??''}" required></label><label>Taux annuel (%)<input name="rate" inputmode="decimal" value="${l.rate??''}" placeholder="ex. 3,2"></label></div>
   <div class="f2"><label>Durée (mois)<input name="months" type="number" min="1" max="600" value="${l.months||''}" required></label><label>1re échéance<input name="start" type="month" value="${l.start||''}" required></label></div>
   <div class="f2"><label>Mensualité hors assurance (€)<input name="payment" inputmode="decimal" value="${l.payment||''}" placeholder="calculée si vide"></label><label>Assurance (€/mois)<input name="insurance" inputmode="decimal" value="${l.insurance||''}" placeholder="0"></label></div>
   <label>Emprunteur<select name="owner">${ownerOpts(OWN(l.owner))}</select></label>
   <p class="mut" id="loanPrev" aria-live="polite"></p>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="loans|${id}">${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>{
   const F=$('#fLoan'),val=()=>{const v=fd(F);return{label:v.label.trim(),principal:r2(num(v.principal)),rate:Math.max(0,num(v.rate)),months:parseInt(v.months)||0,start:v.start,payment:r2(num(v.payment)),insurance:r2(Math.max(0,num(v.insurance))),owner:v.owner}},
    prev=()=>{const o=val();if(!(o.principal>0&&o.months>0&&o.start)){$('#loanPrev').textContent='';return}const S=loanSchedule(o);$('#loanPrev').textContent=S.error||`Mensualité ${eur(S.payment)} · fin ${monthLabel(S.end)} · intérêts ${eur(S.totalInterest)}${S.totalInsurance?` · assurance ${eur(S.totalInsurance)}`:''}`};
   F.addEventListener('input',prev);prev();
   F.addEventListener('submit',e=>{e.preventDefault();const o=val();if(!o.label||!(o.principal>0)||!(o.months>0)||!o.start)return toast('Complétez libellé, capital, durée et date');const S=loanSchedule(o);if(S.error)return toast(S.error);
    if(!(o.payment>0))o.payment=null;if(id)Object.assign(D.loans.find(x=>x.id===id),o);else D.loans.push({id:uid(),...o});closeSheet();save();toast('Crédit enregistré')})})}
function loanDetail(id){const l=D.loans.find(x=>x.id===id);if(!l)return;const cm=curMonth(),s=loanStatus(l,cm),Y=s.rows.length?loanYears(s):[];
  openSheet(l.label||'Crédit',`${s.error?`<p class="neg">${esc(s.error)}</p>`:`<ul class="bal-l"><li><span>Capital restant dû (${monthLabel(cm)})</span><b>${eur(s.remaining)}</b></li><li><span>Mensualité</span><b>${eur(s.payment)}${s.insurance?` + ${eur(s.insurance)}`:''}</b></li>
   <li><span>Date de fin</span><b>${monthLabel(s.end)}</b><small>${s.left} échéance${s.left>1?'s':''} restante${s.left>1?'s':''} sur ${s.count}</small></li><li><span>Coût total des intérêts</span><b>${eur(s.totalInterest)}</b><small>dont ${eur(s.interestLeft)} encore à payer</small></li>${s.totalInsurance?`<li><span>Coût de l’assurance</span><b>${eur(s.totalInsurance)}</b></li>`:''}<li><span>Coût total du crédit</span><b>${eur(s.totalCost)}</b></li></ul>
   <h3>Tableau d’amortissement par année</h3><div class="tbl-w" tabindex="0" role="region" aria-label="Tableau défilant"><table class="tbl"><thead><tr><th scope="col">Année</th><th scope="col">Intérêts</th><th scope="col">Capital remboursé</th><th scope="col">Reste dû</th></tr></thead><tbody>${Y.map(y=>`<tr><th scope="row">${y.year}</th><td class="num">${eur(y.int)}</td><td class="num">${eur(y.princ)}</td><td class="num">${eur(y.cap)}</td></tr>`).join('')}</tbody></table></div>
   <details class="amort"><summary>Détail mois par mois (${s.count} échéances)</summary><div class="tbl-w" tabindex="0" role="region" aria-label="Tableau défilant"><table class="tbl"><thead><tr><th scope="col">N°</th><th scope="col">Mois</th><th scope="col">Intérêts</th><th scope="col">Capital</th><th scope="col">Reste dû</th></tr></thead><tbody>${s.rows.map(r=>`<tr class="${r.month===cm?'cur':''}"><td>${r.k}</td><td>${r.month.slice(5)}/${r.month.slice(0,4)}</td><td class="num">${eur(r.int)}</td><td class="num">${eur(r.princ)}</td><td class="num">${eur(r.cap)}</td></tr>`).join('')}</tbody></table></div></details>
   <p class="mut note">Calcul standard à échéances constantes (taux ÷ 12 chaque mois). Le tableau de votre banque fait foi (arrondis, différé, remboursement anticipé).</p>`}
   <div class="f2"><button class="btn ghost" data-loan-edit="${id}">Modifier</button><button class="btn danger" data-del="loans|${id}">${ic('trash',16)} Supprimer</button></div>`)}
/* ---------- 5) Abonnements détectés (Budget › Dépenses) ---------- */
let subsOpen=false;
function subsCard(){if(!D.misc.some(x=>x.source==='import'))return'';const R=detectSubs(D.misc,D.fixed,D.subsoff,todayIso()),act=R.list.filter(s=>s.active&&!s.ignored),fx=act.filter(s=>s.fixedId),L=act.filter(s=>!s.fixedId),ign=R.list.filter(s=>s.ignored);
  if(!R.list.length)return '';
  return `<details class="card v15 subs" id="subsCard" ${subsOpen?'open':''}><summary><span><b>${ic('calendar',16)} Abonnements détectés</b><small class="mut">${L.length?`${eur(R.monthly)}/mois · ${eur(R.yearly)}/an`:'aucun hors charges fixes'}${R.rises.length?` · <span class="warn-c">${R.rises.length} hausse${R.rises.length>1?'s':''}</span>`:''}</small></span></summary>
  <div class="list">${L.map(s=>`<div class="item col"><span class="row-b"><b>${esc(s.label)}</b>${money(s.amount)}</span><small class="mut">${s.period} · ${s.count} prélèvements · dernier le ${frDate(s.last)}${s.period!=='mensuel'?` · ${eur(s.monthly)}/mois`:''}</small>
    ${s.rise?`<small class="warn-c">${ic('alert',12)} Hausse de prix : ${eur(s.rise.from)} → ${eur(s.rise.to)} (+${fr1(s.rise.pct)} %)</small>`:''}
    <div class="row-act"><button class="btn ghost small" data-sub-fix="${esc(s.key)}">Ajouter aux charges fixes</button><button class="btn ghost small" data-sub-off="${esc(s.key)}" aria-label="Ignorer ${esc(s.label)}">Ignorer</button></div></div>`).join('')}</div>
  ${fx.length?`<p class="mut">Déjà dans vos charges fixes, non comptés ici : ${fx.map(s=>esc(s.label)).join(', ')}.</p>`:''}
  ${ign.length?`<p class="mut">Ignorés : ${ign.map(s=>`${esc(s.label)} <button class="link" data-sub-on="${esc(s.key)}">Réafficher</button>`).join(' · ')}</p>`:''}
  <p class="mut note">Repérés dans les relevés importés : même libellé, montant proche, intervalle régulier (mensuel, trimestriel ou annuel). Les abonnements arrêtés depuis plus d’une période ne sont pas comptés.</p></details>`}
/* ---------- 6) Bilan annuel (vue « Bilan de l’année ») ---------- */
let yrSel=null;
function reportYears(){const Y=new Set([String(new Date().getFullYear())]);D.misc.forEach(x=>x.date&&Y.add(x.date.slice(0,4)));D.months.forEach(m=>m.month&&Y.add(m.month.slice(0,4)));D.interests.forEach(i=>Y.add(String(i.year)));return[...Y].filter(y=>/^\d{4}$/.test(y)).sort().reverse()}
function vAnnuel(){const ys=reportYears();if(!yrSel||!ys.includes(yrSel))yrSel=ys[0];const B=yearReport(D,yrSel,todayIso()),cur=yrSel===String(new Date().getFullYear());
  const tri=o=>`<ul class="bal-l"><li><span>${esc(N('p1'))}</span><b>${eur(o.p1)}</b></li><li><span>${esc(N('p2'))}</span><b>${eur(o.p2)}</b></li>${'common' in o?`<li><span>Commun</span><b>${eur(o.common)}</b></li>`:''}<li><span><b>Total</b></span><b>${eur(o.total)}</b></li></ul>`,max=B.categories[0]?.amount||1;
  return `<label class="yr-sel">Année<select id="yrSel">${ys.map(y=>`<option ${y===yrSel?'selected':''}>${y}</option>`).join('')}</select></label>${cur?`<p class="mut">Année en cours : ${B.months} mois pris en compte.</p>`:''}
  <div class="card hero"><small>Épargne ${yrSel}</small><div class="hero-n">${money(B.savings.total)}</div><div class="two-k"><div style="--pc:var(--p1)"><small><span class="dot"></span>${esc(N('p1'))}</small>${money(B.savings.p1)}</div><div style="--pc:var(--p2)"><small><span class="dot"></span>${esc(N('p2'))}</small>${money(B.savings.p2)}</div></div></div>
  <div class="card"><h2>Dépenses diverses par catégorie</h2>${B.categories.length?`<ul class="bal-l cats">${B.categories.map(c=>`<li><span>${esc(catName('misc',c.key))}</span><b>${eur(c.amount)}</b><small>${bar(c.amount/max*100)}</small></li>`).join('')}</ul><h3>Par personne</h3>${tri(B.misc)}`:'<p class="mut">Aucune dépense diverse cette année.</p>'}</div>
  <div class="card"><h2>Charges fixes (estimation)</h2><div class="big num">${eur(B.fixed)}</div><small class="mut">Charges fixes actuelles × ${B.months} mois · ${esc(N('p1'))} ${eur(B.fixedShare.p1)} / ${esc(N('p2'))} ${eur(B.fixedShare.p2)} selon la répartition</small>${B.fixedCategories.length?`<ul class="bal-l">${B.fixedCategories.map(c=>`<li><span>${esc(catName('fixed',c.key))}</span><b>${eur(c.amount)}</b></li>`).join('')}</ul>`:''}</div>
  <div class="card"><h2>Intérêts perçus</h2>${B.interests.total?tri(B.interests):'<p class="mut">Aucun intérêt enregistré pour cette année (récap dans Épargne › Intérêts).</p>'}</div>
  <div class="card"><h2>Versements PER</h2>${B.perList.length?`<ul class="bal-l">${B.perList.map(p=>`<li><span>${esc(p.name)} · ${esc(N(p.owner))}</span><b>${eur(p.amount)}</b><small>${p.estimated?'estimé : versement mensuel × mois':'d’après les versements saisis'}</small></li>`).join('')}</ul>${tri(B.per)}`:'<p class="mut">Aucun PER renseigné.</p>'}
   <p class="mut note">Indicatif, utile pour préparer la déclaration de revenus (versements déductibles : cases 6NS / 6NT de la 2042, à vérifier sur votre relevé annuel et sur impots.gouv.fr). Ce n’est pas un conseil fiscal.</p></div>`}
/* ---------- 7) Sauvegarde : export avec empreinte, restauration par ajout ---------- */
async function sha256Hex(s){if(!crypto?.subtle)return null;const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
const dl=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
async function backupExport(){const data=JSON.parse(JSON.stringify(D));delete data.miscMonth;const body=backupBody(data),sha=await sha256Hex(body);
  const env={format:BACKUP_FMT,v:1,exported:new Date().toISOString(),dataVersion:DATA_VERSION,counts:countsOf(data,LISTS),sha256:sha,data};
  dl(new Blob([JSON.stringify(env,null,1)],{type:'application/json'}),`budget-couple-${todayIso()}.json`);localStorage.setItem('budget-couple-lastbackup',todayIso());toast('Sauvegarde exportée');if(tab==='reglages')render()}
const LIST_FR={months:'mois d’épargne',goals:'objectifs',fixed:'charges fixes',misc:'dépenses',placements:'placements',incomes:'revenus',settlements:'règlements',positions:'positions',valuations:'valorisations',dismissed:'conseils masqués',accounts:'comptes',insurances:'assurances',interests:'intérêts',movements:'mouvements',reports:'bilans',imports:'relevés importés',catrules:'règles de catégorie',debts:'dettes',annuals:'charges annuelles',loans:'crédits',networth:'points de patrimoine',subsoff:'abonnements ignorés'};
async function readBackup(text){let j;try{j=JSON.parse(text)}catch{return{error:'Ce fichier n’est pas un JSON valide.'}}if(!j||typeof j!=='object')return{error:'Fichier vide ou illisible.'};
  let data=j,check={level:'warn',msg:'Ancien format de sauvegarde (sans empreinte) : intégrité non vérifiable.'};
  if(j.format===BACKUP_FMT){data=j.data;if(!data||typeof data!=='object')return{error:'Sauvegarde incomplète : données absentes.'};
    const sha=await sha256Hex(backupBody(data));if(j.sha256&&sha&&sha!==j.sha256)return{error:'Empreinte SHA-256 différente : le fichier a été modifié ou tronqué. Restauration refusée.'};
    const bad=Object.entries(j.counts||{}).filter(([l,n])=>(Array.isArray(data[l])?data[l].length:0)!==n);if(bad.length)return{error:`Nombre d’éléments incohérent (${bad.map(b=>LIST_FR[b[0]]||b[0]).join(', ')}). Restauration refusée.`};
    check={level:'ok',msg:j.sha256&&sha?`Intégrité vérifiée (SHA-256) · exportée le ${new Date(j.exported).toLocaleString('fr-FR')}`:'Sauvegarde reconnue (empreinte non vérifiable dans ce navigateur).'}}
  else if(!('version' in j)&&!LISTS.some(l=>Array.isArray(j[l])))return{error:'Ce fichier ne ressemble pas à une sauvegarde Budget couple.'};
  const badL=LISTS.filter(l=>data[l]!==undefined&&!Array.isArray(data[l]));if(badL.length)return{error:'Structure invalide : '+badL.join(', ')};
  if((+data.version||0)>DATA_VERSION)check={level:'warn',msg:`Sauvegarde créée par une version plus récente (v${data.version}) : seuls les éléments connus seront ajoutés.`};
  let bak;try{bak=migrateData(JSON.parse(JSON.stringify(data)))}catch{return{error:'Données illisibles après conversion.'}}return{bak,check}}
function restoreSheet(R){const B0=blankData(),isDef=(k,v)=>v===undefined||v===null||JSON.stringify(v)===JSON.stringify(B0[k]),P=restorePlan(D,R.bak,LISTS,SCAL,isDef);
  const grp=L=>{const c={};L.forEach(e=>c[e.list]=(c[e.list]||0)+1);return Object.entries(c).map(([l,n])=>`<li><span>${LIST_FR[l]||l}</span><b>${n}</b></li>`).join('')},nothing=!P.add.length&&!P.deleted.length&&!P.scal.length&&!P.budget.length;
  openSheet('Restaurer une sauvegarde',`<p class="${R.check.level==='ok'?'pos':'warn-c'}">${ic(R.check.level==='ok'?'check':'alert',14)} ${esc(R.check.msg)}</p>
   <p>La restauration <b>ajoute</b> seulement ce qui manque : aucune donnée actuelle n’est modifiée ni supprimée.</p>
   ${P.add.length?`<h3>À ajouter (${P.add.length})</h3><ul class="bal-l">${grp(P.add)}</ul>`:''}
   ${P.scal.length||P.budget.length?`<p class="mut">Réglages vides complétés : ${[...P.scal.map(k=>({names:'prénoms',ratio:'répartition',transfer:'virement',reminderDay:'jour de rappel',births:'dates de naissance',tax:'impôt',notify:'notifications',catBudget:'plafonds'}[k]||k)),...(P.budget.length?[`budget de ${P.budget.length} mois`]:[])].join(', ')}.</p>`:''}
   ${P.deleted.length?`<label class="switch"><input type="checkbox" id="rsDel"><span></span>Restaurer aussi ${P.deleted.length} élément${P.deleted.length>1?'s':''} supprimé${P.deleted.length>1?'s':''} depuis cette sauvegarde</label><ul class="bal-l">${grp(P.deleted)}</ul>`:''}
   ${P.differs?`<p class="mut">${P.differs} élément${P.differs>1?'s':''} existe${P.differs>1?'nt':''} déjà avec une autre version : la version actuelle est conservée.</p>`:''}
   ${nothing?'<p class="pos">Rien à restaurer : tout est déjà présent.</p>':'<button class="btn" id="rsGo">Confirmer la restauration</button>'}<button type="button" class="btn ghost" id="rsCancel">Annuler</button>`,()=>{
   on('#rsCancel','click',closeSheet);on('#rsGo','click',()=>{const wd=!!$('#rsDel')?.checked,out=applyRestore(D,R.bak,P,wd),n=P.add.length+(wd?P.deleted.length:0);
     LISTS.forEach(l=>D[l]=out[l]);SCAL.forEach(k=>D[k]=out[k]);D.budget=out.budget;D.deleted=out.deleted;closeSheet();save();toast(`Restauration terminée : ${n} élément${n>1?'s':''} ajouté${n>1?'s':''}`)})})}
async function backupImport(file){if(!file)return;const R=await readBackup(await file.text());if(R.error){alert(R.error);return}restoreSheet(R)}
function integrityCheck(){const ids=new Map(),dup=[],bad=[];LISTS.forEach(l=>{if(!Array.isArray(D[l]))return bad.push(l);D[l].forEach(x=>{if(!x||!x.id)return bad.push(l);const k=l+'|'+x.id;if(ids.has(k))dup.push(l);ids.set(k,1)})});
  const neg=D.misc.filter(x=>!isFinite(+x.amount)).length+D.fixed.filter(x=>!isFinite(+x.amount)).length;return{ok:!dup.length&&!bad.length&&!neg,dup,bad,neg,total:ids.size}}
function backupCard(){const last=localStorage.getItem('budget-couple-lastbackup'),I=integrityCheck();
  return `<div class="card" id="backupCard"><h2>Sauvegarde</h2><div class="f2"><button class="btn ghost" id="exp">Exporter (JSON complet)</button><button class="btn ghost" id="expCsv">Exporter (CSV)</button></div>
   <label class="btn ghost wide">Restaurer depuis un fichier…<input type="file" id="imp" accept=".json,application/json" hidden></label>
   <p class="mut">${last?`Dernier export depuis cet appareil : ${frDate(last)}. `:''}La restauration vérifie l’empreinte du fichier, montre un aperçu et n’ajoute que ce qui manque (rien n’est écrasé).</p>
   <p class="${I.ok?'pos':'neg'}" id="integ">${ic(I.ok?'check':'alert',14)} ${I.ok?`Données cohérentes : ${I.total} éléments vérifiés.`:`Anomalie détectée (${[I.dup.length?'doublons':'',I.bad.length?'éléments sans identifiant':'',I.neg?'montants invalides':''].filter(Boolean).join(', ')}). Exportez une sauvegarde avant toute manipulation.`}</p>
   <button class="btn danger" id="reset">${sbOn()?'Vider le cache et recharger':'Tout effacer sur cet appareil'}</button><p class="mut">Format de données v${DATA_VERSION}</p></div>`}
/* ---------- 8) Rappels (propres à l'appareil, sans serveur) ---------- */
const REM_KEY='budget-couple-reminders',REM_TOPICS=[['saving','Épargne du mois à saisir'],['valuations','Valorisations à mettre à jour'],['goals','Échéances d’objectifs'],['annuals','Charges annuelles à venir'],['loans','Fin de crédit']];
const remPrefs=()=>{let p={};try{p=JSON.parse(localStorage.getItem(REM_KEY)||'{}')||{}}catch{}return{on:!!p.on,notif:!!p.notif,topics:Object.assign(Object.fromEntries(REM_TOPICS.map(t=>[t[0],true])),p.topics||{})}};
const remSave=p=>localStorage.setItem(REM_KEY,JSON.stringify(p));
function dueReminders(){const P=remPrefs(),cm=curMonth(),day=new Date().getDate(),R=[],T=P.topics;
  if(T.saving&&(D.goals.length||D.months.length)&&day>=(+D.reminderDay||1)&&!D.months.some(m=>m.month===cm&&(m.a||m.b)))R.push({key:'saving-'+cm,title:`Épargne de ${monthLabel(cm)} à saisir`,goto:'epargne'});
  if(T.valuations&&typeof dueValuations==='function'){const n=dueValuations().length;if(n)R.push({key:'val-'+cm,title:`${n} valorisation${n>1?'s':''} à mettre à jour`,goto:'placements'})}
  if(T.goals){const C=compute();D.goals.forEach(g=>{if(!g.date||!g.target)return;const k=ymDiff(cm,g.date.slice(0,7));if(k>=0&&k<=2&&(C.saved[g.id]||0)<g.target)R.push({key:'goal-'+g.id+'-'+cm,title:`Objectif « ${g.name} » : échéance ${monthLabel(g.date.slice(0,7))}, ${eur(g.target-(C.saved[g.id]||0))} restants`,goto:'objectifs'})})}
  if(T.annuals)D.annuals.forEach(a=>{const p=annualPlan(annIn(a),cm);if(p.inMonths<=1&&!(+a.paidYear>=+p.due.slice(0,4)))R.push({key:'ann-'+a.id+'-'+p.due,title:`${a.label} : ${eur(p.amount)} en ${monthLabel(p.due)}${p.ready?'':` (provision ${eur(p.saved)})`}`,goto:'budget',seg:'fixes'})});
  if(T.loans)D.loans.forEach(l=>{const s=loanStatus(l,cm);if(!s.error&&s.left>0&&s.left<=3)R.push({key:'loan-'+l.id+'-'+cm,title:`Crédit « ${l.label} » : dernière échéance en ${monthLabel(s.end)}`,goto:'patrimoine'})});
  return R}
function reminderCard(){if(!remPrefs().on)return'';const R=dueReminders();if(!R.length)return'';
  return `<div class="card v15 remind-card" id="remCard"><h2>${ic('calendar',18)} Rappels</h2><ul class="bal-l">${R.slice(0,4).map(r=>`<li><span>${esc(r.title)}</span><button class="link" data-goto="${r.goto}" ${r.seg?`data-seg-to="${r.seg}"`:''}>Voir</button></li>`).join('')}</ul>${R.length>4?`<p class="mut">+ ${R.length-4} autre${R.length>5?'s':''}</p>`:''}</div>`}
function remTick(){const P=remPrefs();if(!P.on||!P.notif||!('Notification' in window)||Notification.permission!=='granted')return;let seen={};try{seen=JSON.parse(localStorage.getItem('budget-couple-rem-seen')||'{}')}catch{}
  const t=todayIso(),fresh=dueReminders().filter(r=>!seen[r.key]);Object.keys(seen).forEach(k=>{if(seen[k]<t.slice(0,7))delete seen[k]});if(!fresh.length)return;
  fresh.forEach(r=>seen[r.key]=t);localStorage.setItem('budget-couple-rem-seen',JSON.stringify(seen));const title=fresh.length>1?`${fresh.length} rappels Budget couple`:'Rappel Budget couple',body=fresh.map(r=>r.title).join('\n');
  navigator.serviceWorker?.getRegistration().then(g=>g?g.showNotification(title,{body,icon:'icons/icon-192.png',tag:'rappels'}):new Notification(title,{body})).catch(()=>{try{new Notification(title,{body})}catch{}})}
function remindersCard(){const P=remPrefs(),can='Notification' in window;
  return `<div class="card" id="remSettings"><h2>${ic('calendar',18)} Rappels</h2>
   <label class="switch"><input type="checkbox" id="remOn" ${P.on?'checked':''}><span></span>Rappels dans l’appli (carte sur l’Accueil)</label>
   <fieldset class="rem-topics" ${P.on?'':'disabled'}><legend class="sr-only">Sujets des rappels</legend>${REM_TOPICS.map(([k,l])=>`<label class="chk"><input type="checkbox" data-rem-topic="${k}" ${P.topics[k]?'checked':''}> ${l}</label>`).join('')}</fieldset>
   ${can?`<label class="switch"><input type="checkbox" id="remNotif" ${P.on&&P.notif&&Notification.permission==='granted'?'checked':''} ${P.on?'':'disabled'}><span></span>Notification à l’ouverture de l’appli</label>`:'<p class="mut">Ce navigateur ne gère pas les notifications : les rappels restent visibles dans l’appli.</p>'}
   <p class="mut">Sans serveur, les rappels sont vérifiés <b>quand l’appli est ouverte</b> (ou revient au premier plan) : aucune notification n’arrive si elle est fermée. Une notification par sujet et par jour au plus. Réglage propre à cet appareil.</p></div>`}
/* ---------- Événements v15 ---------- */
document.addEventListener('click',e=>{const t=e.target.closest('[data-ann-edit],[data-ann-save],[data-ann-paid],[data-loan],[data-loan-edit],[data-sub-off],[data-sub-on],[data-sub-fix],#addAnnual,#addLoan,#yrOpen');if(!t)return;const d=t.dataset;
  if(t.id==='addAnnual')return annualSheet();if(t.id==='addLoan')return loanSheet();if(d.annEdit)return annualSheet(d.annEdit);
  if(d.annSave){const a=D.annuals.find(x=>x.id===d.annSave);if(!a)return;const p=annualPlan(annIn(a),curMonth());a.saved=r2((+a.saved||0)+p.monthly);save();return toast(`${eur(p.monthly)} provisionnés pour ${a.label}`)}
  if(d.annPaid){const a=D.annuals.find(x=>x.id===d.annPaid);if(!a)return;const p=annualPlan(annIn(a),curMonth());if(!confirm(`Marquer « ${a.label} » de ${monthLabel(p.due)} comme payée ? La provision repart pour l’échéance suivante.`))return;
    a.paidYear=+p.due.slice(0,4);a.saved=r2(Math.max(0,(+a.saved||0)-p.amount));save();return toast('Échéance payée : provision remise à zéro')}
  if(d.loan)return loanDetail(d.loan);if(d.loanEdit){closeSheet();return setTimeout(()=>loanSheet(d.loanEdit),0)}
  if(d.subOff||d.subOn||d.subFix)subsOpen=true;
  if(d.subOff){if(!D.subsoff.some(x=>x.key===d.subOff))D.subsoff.push({id:'so-'+d.subOff.replace(/[^a-z0-9]+/gi,'-').slice(0,40)+'-'+uid().slice(0,4),key:d.subOff});save();return toast('Abonnement ignoré')}
  if(d.subOn){D.subsoff=D.subsoff.filter(x=>x.key!==d.subOn);save();return toast('Abonnement réaffiché')}
  if(d.subFix){const s=detectSubs(D.misc,D.fixed,D.subsoff,todayIso()).list.find(x=>x.key===d.subFix);if(!s)return;
    const cat=catList('fixed').some(c=>c[0]==='abonnements')?'abonnements':catList('fixed').some(c=>c[0]==='loisirs')?'loisirs':'autre';
    if(!confirm(`Ajouter « ${s.label} » (${eur(s.monthly)}/mois) aux charges fixes ?`))return;D.fixed.push({id:uid(),label:s.label,amount:s.monthly,day:+s.last.slice(8,10)||1,category:cat,split:D.ratio,paidBy:'joint'});save();return toast('Ajouté aux charges fixes')}
});
document.addEventListener('toggle',e=>{if(e.target.id==='subsCard')subsOpen=e.target.open},true);
document.addEventListener('change',async e=>{const t=e.target;
  if(t.id==='yrSel'){yrSel=t.value;render();return}
  if(t.id==='remOn'){const p=remPrefs();p.on=t.checked;if(!t.checked)p.notif=false;remSave(p);render();toast(t.checked?'Rappels activés':'Rappels désactivés');return}
  if(t.dataset.remTopic){const p=remPrefs();p.topics[t.dataset.remTopic]=t.checked;remSave(p);return}
  if(t.id==='remNotif'){const p=remPrefs();if(t.checked){const r=await Notification.requestPermission().catch(()=>'denied');if(r!=='granted'){t.checked=false;toast('Notifications refusées par le navigateur');return}}p.notif=t.checked;remSave(p);toast(t.checked?'Notification activée':'Notification désactivée');if(t.checked)remTick();return}
});
