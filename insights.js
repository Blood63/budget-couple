'use strict';
/* ---------- Épargne par personne et projection totale à 5 ans ---------- */
let savingsPerson='p1';
function personSavings(k,C){
  const months=[...D.months].sort((a,b)=>a.month.localeCompare(b.month)),field=k==='p1'?'a':'b';
  const monthly=months.map(m=>({month:m.month,value:+m[field]||0,total:(+m.a||0)+(+m.b||0)}));
  const total=monthly.reduce((s,m)=>s+m.value,0),last=monthly.slice(-12),lastTotal=last.reduce((s,m)=>s+m.value,0);
  const goals=D.goals.map(g=>{const p=goalPersons(g,C,curMonth()).find(x=>x.k===k);return{g,target:p.target,paid:p.paid,rest:p.rest,monthly:p.monthly}}).filter(x=>x.target>0||x.paid>0);
  const direct=D.placements.filter(p=>p.owner===k),common=D.placements.filter(p=>p.owner==='common');
  const directTotal=direct.reduce((s,p)=>s+placValue(p),0),shareRatio=k==='p1'?D.ratio/100:1-D.ratio/100;
  const commonTotal=common.reduce((s,p)=>s+placValue(p),0),commonShare=commonTotal*shareRatio;
  const placements=placementSummary(k);
  return{k,monthly,total,last,lastTotal,avg12:last.length?lastTotal/last.length:0,goals,direct,directTotal,common,commonTotal,commonShare,shareRatio,placements,
    goalsPaid:goals.reduce((s,x)=>s+x.paid,0),goalsTarget:goals.reduce((s,x)=>s+x.target,0)}}
/* ---------- Placements par personne : valorisations + livrets, communs séparés ---------- */
function placementSummary(k){const direct=D.placements.filter(p=>p.owner===k),common=D.placements.filter(p=>p.owner==='common');
  const val=p=>placValue(p),directTotal=direct.reduce((s,p)=>s+val(p),0),commonTotal=common.reduce((s,p)=>s+val(p),0),grandTotal=D.placements.reduce((s,p)=>s+val(p),0);
  const shareRatio=k==='p1'?D.ratio/100:1-D.ratio/100,commonShare=commonTotal*shareRatio,indicativeTotal=directTotal+commonShare;
  const known=list=>{let invested=0,investedCount=0,gains=0,gainsKnown=false;list.forEach(p=>{if(isEnv(p)&&+p.invested>0){invested+=+p.invested;investedCount++;const g=gain(p);gains+=g.d;gainsKnown=true}else{const ints=(D.interests||[]).filter(i=>i.pid===p.id&&!i.skipped);if(ints.length){gains+=ints.reduce((s,i)=>s+(+i.amount||0),0);gainsKnown=true}}});return{invested,investedCount,gains,gainsKnown}};
  const kd=known(direct),kc=known(common);
  return{k,direct,common,directTotal,commonTotal,commonShare,indicativeTotal,grandTotal,shareRatio,
    directPct:grandTotal?directTotal/grandTotal*100:0,indicativePct:grandTotal?indicativeTotal/grandTotal*100:0,
    invested:kd.invested,investedCount:kd.investedCount,gains:kd.gains,gainsKnown:kd.gainsKnown,monthly:direct.reduce((s,p)=>s+(+p.monthly||0),0),
    commonInvested:kc.invested,commonInvestedCount:kc.investedCount,commonGains:kc.gains,commonGainsKnown:kc.gainsKnown,commonMonthly:common.reduce((s,p)=>s+(+p.monthly||0),0)}}
function placementsByPersonHtml(){if(!D.placements.length)return'';const A=placementSummary('p1'),B=placementSummary('p2'),C=A;
  const pct1=x=>`${x.toFixed(1).replace('.',',')} %`;
  const card=x=>`<article class="pp-card" style="--pc:${COL[x.k]}" aria-label="Placements de ${esc(N(x.k))}"><span class="pname"><span class="dot"></span>${esc(N(x.k))}</span>
    <small>Placements personnels (valorisations + livrets)</small><span class="pp-total">${eur(x.directTotal)}</span>
    <span class="pp-indic">Avec part indicative des communs : <b>${eur(x.indicativeTotal)}</b> · ${pct1(x.indicativePct)} de l’ensemble</span>
    <div class="pp-grid"><div><small>Total versé connu</small><b>${x.investedCount?eur(x.invested):'—'}</b></div><div><small>Intérêts / plus-values connus</small><b>${x.gainsKnown?eur(x.gains):'—'}</b></div><div><small>Versements mensuels</small><b>${eur(x.monthly)}/mois</b></div><div><small>Part des placements personnels</small><b>${pct1(x.directPct)}</b></div></div>
    <small>${x.direct.length} placement${x.direct.length>1?'s':''} personnel${x.direct.length>1?'s':''}${x.investedCount?` · total versé connu pour ${x.investedCount} enveloppe${x.investedCount>1?'s':''}`:' · total versé des livrets non suivi'}</small></article>`;
  return `<section class="card placement-people" aria-labelledby="placPeopleH"><div class="sec"><h2 id="placPeopleH">${ic('chart',18)} Placements par personne</h2></div>
   <div class="two person-cards plac-person-cards">${card(A)}${card(B)}</div>
   <div class="common-plac"><span>Total des placements communs (séparé)</span><b>${eur(C.commonTotal)}</b>
    <small>Répartition indicative selon les réglages ${D.ratio}/${100-D.ratio} : ${esc(N('p1'))} ${eur(A.commonShare)} · ${esc(N('p2'))} ${eur(B.commonShare)}${C.commonInvestedCount?` · total versé connu ${eur(C.commonInvested)}`:''}${C.commonGainsKnown?` · intérêts / plus-values connus ${eur(C.commonGains)}`:''} · versements ${eur(C.commonMonthly)}/mois.</small></div>
   <p class="mut">Règle : le total personnel additionne les dernières valorisations des enveloppes et les soldes des livrets de la personne. Les placements communs restent séparés ; leur répartition ${D.ratio}/${100-D.ratio} est uniquement indicative et ne modifie ni leur propriété ni leur titulaire. « Total versé connu » = total versé saisi pour les enveloppes (les versements cumulés des livrets ne sont pas suivis) ; « intérêts / plus-values connus » = plus-values d’enveloppes calculées et intérêts de livrets déjà enregistrés.</p></section>`}
function personSavingsSection(){const C=compute(),A=personSavings('p1',C),B=personSavings('p2',C),P=savingsPerson==='p2'?B:A,other=P.k==='p1'?B:A;
  let run=0;const allPts=P.monthly.map(m=>{run+=m.value;return{label:monthLabel(m.month),short:new Date(m.month+'-01T12:00').toLocaleDateString('fr-FR',{month:'short'}),values:{month:m.value,cum:run},detail:`Part du couple ce mois : ${m.total?(m.value/m.total*100).toFixed(0):0} % · total du couple ${eur(m.total)}`}});
  const pts=allPts.slice(-24);
  return `<section class="person-savings" aria-labelledby="personSavH"><div class="sec"><h2 id="personSavH">${ic('chart',18)} Épargne par personne</h2></div>
   <div class="two person-cards">${[A,B].map(x=>`<button type="button" class="card pcard person-card ${x.k===P.k?'sel':''}" data-person-sav="${x.k}" style="--pc:${COL[x.k]}" aria-pressed="${x.k===P.k}"><span class="pname"><span class="dot"></span>${esc(N(x.k))}</span>
     <span class="person-total">${eur(x.total)}</span><small>épargne mensuelle cumulée · ${x.monthly.length} mois</small><small>12 derniers mois : ${eur(x.lastTotal)} (${eur(x.avg12)}/mois)</small><small>Objectifs financés : ${eur(x.goalsPaid)} / ${eur(x.goalsTarget)}</small><span class="person-plac-line">Placements personnels <b>${eur(x.directTotal)}</b></span></button>`).join('')}</div>
   <div class="card"><div class="row-b"><h3>${esc(N(P.k))} — détail</h3><span class="pct" style="--pc:${COL[P.k]}">${eur(P.total)}</span></div>
    <div class="hero-grid"><div><small>Total mensuel cumulé</small><b>${eur(P.total)}</b></div><div><small>Moyenne 12 derniers mois</small><b>${eur(P.avg12)}/mois</b></div><div><small>Objectifs : déjà financé</small><b>${eur(P.goalsPaid)}</b></div><div><small>Placements directs</small><b>${eur(P.directTotal)}</b></div></div>
    <button type="button" class="plac-total-banner" data-goto="placements" aria-label="Ouvrir l’onglet Placements, total des placements de ${esc(N(P.k))} : ${eur(P.directTotal)}"><span>Total placements de ${esc(N(P.k))}</span><strong>${eur(P.directTotal)}</strong><small>Valorisations + livrets personnels · ${P.placements.directPct.toFixed(1).replace('.',',')} % de l’ensemble · avec part indicative des communs (${Math.round(P.shareRatio*100)} %) : ${eur(P.placements.indicativeTotal)} · Ouvrir Placements ›</small></button>
    <h3 class="group">Par mois</h3>${pts.length?interactiveChart({title:`Épargne mensuelle et cumul de ${N(P.k)}`,type:'bars',series:[{key:'month',name:'Épargne du mois',color:P.k==='p1'?'#4ea8ff':'#ff7ab6'}],lineSeries:[{key:'cum',name:'Cumul',color:'#3ecf8e'}],points:pts}):'<p class="mut">Aucun mois d’épargne saisi.</p>'}
    <div class="month-mini">${[...P.monthly].slice(-6).reverse().map(m=>`<div><span>${monthLabel(m.month)}</span><b>${eur(m.value)}</b><small>${m.total?(m.value/m.total*100).toFixed(0):0} % du couple</small></div>`).join('')}</div>
    <h3 class="group">Par objectif</h3><div class="list">${P.goals.map(x=>`<div class="item col"><span class="row-b"><b>${esc(x.g.name)}</b><span>${eur(x.paid)} / ${eur(x.target)}</span></span>${bar(x.target?x.paid/x.target*100:0)}<small>Reste ${eur(x.rest)}${x.monthly!=null?` · besoin ${eur(x.monthly)}/mois`:''} · ${esc(x.g.owner==='common'?'objectif commun':N(x.g.owner))}</small></div>`).join('')||'<p class="mut">Aucun objectif attribué.</p>'}</div>
    <h3 class="group">Par placement</h3><ul class="bal-l">${P.direct.map(p=>`<li><span>${esc(p.name||ptype(p.type)[1])}</span><small>${ptype(p.type)[1]} · ${eur(+p.monthly||0)}/mois · ${esc(rateInfo(p).txt)}</small><b>${eur(placValue(p))}</b></li>`).join('')||'<li><span>Aucun placement personnel</span><b>0 €</b></li>'}
     ${P.common.length?`<li><span>Placements communs (part indicative)</span><small>${Math.round(P.shareRatio*100)} % selon les réglages · total commun ${eur(P.commonTotal)}</small><b>${eur(P.commonShare)}</b></li>`:''}</ul>
    <p class="mut">Les placements communs sont attribués ici à titre indicatif selon la répartition des réglages (${D.ratio}/${100-D.ratio}), sans modifier leur propriété. L’épargne mensuelle, les objectifs et les placements sont trois vues du parcours de l’argent : on ne les additionne pas entre eux.</p>
    <p class="mut">Autre personne : ${esc(N(other.k))} — ${eur(other.total)} d’épargne mensuelle cumulée.</p></div></section>`}
function projection5Data(){const cash=currentRate('livretA');return fiveYearProjection(streams(),{monthsData:D.months,cashRate:cash?cash.rate:0,asOf:todayIso()})}
function projection5Card(){const p=projection5Data(),S=p.scenarios,avg=x=>x?`${eur(x.value)}/mois (${x.count} mois)`:'—';
  const pts=[0,12,24,36,48,60].map(m=>({label:m===0?"Aujourd'hui":`Dans ${m/12} an${m>12?'s':''}`,short:m===0?'0':`${m/12} ans`,values:{prudent:p.prudent.series[m].total,realistic:p.realistic.series[m].total},detail:`Versements cumulés (réaliste) : ${eur(p.realistic.series[m].contributions)} · gains estimés : ${eur(p.realistic.series[m].gains)}`}));
  return `<section class="card projection5" aria-labelledby="proj5H"><div class="row-b"><h2 id="proj5H">${ic('trend',18)} Épargne totale dans 5 ans</h2><span class="pct">${eur(p.realistic.end.total)}</span></div>
   <p class="bal-t">Scénario réaliste : <b>${eur(p.realistic.end.total)}</b> · prudent : <b>${eur(p.prudent.end.total)}</b></p>
   <div class="hero-grid"><div><small>Point de départ (placements)</small><b>${eur(p.initial)}</b></div><div><small>Flux réaliste retenu</small><b>${eur(p.realistic.flow)}/mois</b></div><div><small>Flux prudent retenu</small><b>${eur(p.prudent.flow)}/mois</b></div><div><small>Versements permanents inclus</small><b>${eur(p.programmed)}/mois</b></div></div>
   ${interactiveChart({title:'Projection de l’épargne totale à 5 ans',type:'line',series:[{key:'realistic',name:'Scénario réaliste',color:'#3ecf8e'},{key:'prudent',name:'Scénario prudent',color:'#ffb547'}],points:pts})}
   <div class="years proj-years">${[1,2,3,4,5].map(y=>{const r=p.realistic.series[y*12],q=p.prudent.series[y*12];return `<div class="card yr"><small>Fin d’année ${y}</small><b>${eur(r.total)}</b><small>prudent ${eur(q.total)} · gains ${eur(r.gains)}</small></div>`}).join('')}</div>
   <details><summary>Hypothèses et calcul</summary><ul class="bal-l">
    <li><span>Historique d’épargne mensuelle saisie</span><b>3 mois : ${avg(S.avg.m3)} · 6 mois : ${avg(S.avg.m6)} · 12 mois : ${avg(S.avg.m12)}</b></li>
    <li><span>Scénario prudent</span><small>90 % de la plus faible moyenne disponible (3, 6 ou 12 mois)</small><b>${eur(p.prudent.requested)}/mois</b></li>
    <li><span>Scénario réaliste</span><small>moyenne des moyennes 6 et 12 mois (ou la plus longue disponible)</small><b>${eur(p.realistic.requested)}/mois</b></li>
    <li><span>Versements permanents des placements</span><small>inclus dans le flux mensuel, jamais ajoutés une deuxième fois ; si le flux historique est inférieur, le montant programmé sert de plancher</small><b>${eur(p.programmed)}/mois</b></li>
    <li><span>Excédent éventuel du flux</span><small>accumulé au taux Livret A actuel (${pct(p.cashRate)}), versements en fin de mois</small><b>${eur(Math.max(0,p.realistic.flow-p.programmed))}/mois</b></li>
    <li><span>Intérêts et valorisations</span><small>chaque livret et enveloppe est projeté à son taux actuel ou estimé (règle mensuelle simplifiée pour la vue 5 ans ; le détail quinzaine reste dans Intérêts). Les versements s’arrêtent au plafond de versement et, pour un PEL ouvert depuis mars 2011, après 10 ans ; l’excédent part dans la poche libre ci-dessus. AV/PEA/CTO/PER : rendement saisi, non garanti.</small><b>—</b></li></ul>
   <p class="mut">Projection indicative, hors inflation, impôts, frais et changements de taux ou de revenus. Elle ne constitue pas un conseil d’investissement.</p></details></section>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-person-sav]');if(!b)return;savingsPerson=b.dataset.personSav;render()});
/* ---------- Contrôle qualité des données (lecture seule) ---------- */
function dataQualityCard(){const issues=[];const add=(txt,tab)=>issues.push({txt,tab});
  D.placements.forEach(p=>{if(isEnv(p)&&!lastVal(p.id))add(`${p.name||ptype(p.type)[1]} : aucune valorisation saisie`,'placements');if(!isEnv(p)&&!(+p.capital>0))add(`${p.name||ptype(p.type)[1]} : capital à 0`,'placements');if(ptype(p.type)[2]==='env'&&!(+p.rate>0))add(`${p.name||ptype(p.type)[1]} : rendement estimé absent (projection à 0 %)`,'placements')});
  D.goals.forEach(g=>{if(!g.date)add(`Objectif « ${g.name} » : pas de date cible (besoin mensuel non calculé)`,'objectifs');if(!(g.target>0))add(`Objectif « ${g.name} » : cible à 0`,'objectifs')});
  const seen=new Set();D.months.forEach(m=>{if(seen.has(m.month))add(`Épargne : mois ${monthLabel(m.month)} en double`,'epargne');seen.add(m.month)});
  D.misc.forEach(x=>{if(!x.date||x.date>todayIso())add(`Dépense « ${x.label||x.id} » : date future ou absente`,'budget')});
  D.fixed.forEach(f=>{if(!f.day)add(`Charge « ${f.label} » : jour de prélèvement absent`,'budget')});
  if(!issues.length)return `<div class="card data-quality"><h2>${ic('check',18)} Contrôle des données</h2><p class="ok-t">Aucun problème évident détecté.</p></div>`;
  return `<div class="card data-quality"><h2>${ic('alert',18)} Contrôle des données (${issues.length})</h2><p class="mut">Vérifications de cohérence, en lecture seule : rien n’est modifié.</p><ul class="bal-l">${issues.slice(0,12).map(i=>`<li><span>${esc(i.txt)}</span><button type="button" class="link" data-goto="${i.tab}">Voir</button></li>`).join('')}</ul>${issues.length>12?`<p class="mut">… et ${issues.length-12} autre(s).</p>`:''}</div>`}
