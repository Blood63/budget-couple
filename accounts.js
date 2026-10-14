'use strict';
/* ---------- Comptes courants ---------- */
const OWN_L={joint:'Joint',p1:null,p2:null};
const ownerLabel=o=>o==='joint'?'Joint':N(o);
const accName=id=>{const a=D.accounts.find(x=>x.id===id);return a?a.label:'—'};
const accOpts=sel=>D.accounts.map(a=>`<option value="${a.id}" ${a.id===sel?'selected':''}>${esc(a.label)}${a.bank?' · '+esc(a.bank):''}</option>`).join('');
const accPaidBy=id=>{const a=D.accounts.find(x=>x.id===id);return a?(a.owner==='p1'||a.owner==='p2'?a.owner:'joint'):'joint'};
const transferAcc=()=>transferAccounts(D);
const todayIso=()=>new Date().toISOString().slice(0,10);
let accMonth=null;
function vComptes(){const m=accMonth||curMonth(),t=todayIso();
  const F=D.accounts.map(a=>({a,f:accountForecast(D,a,m,t)}));
  return `<div class="monthbar"><input type="month" id="accMonth" value="${m}" aria-label="Mois de la prévision"></div>
  ${sec('Comptes courants',addBtn('addAcc'))}
  ${F.length?F.map(({a,f})=>`<button class="card acc ${f.risk?'acc-risk':''}" data-edit-acc="${a.id}" aria-label="${esc(a.label)}">
    <div class="row-b"><span><b>${esc(a.label)}</b><small>${esc(a.bank||'Banque non précisée')} · ${esc(ownerLabel(a.owner))}</small></span>
     <span class="r">${f.hasBalance&&!f.future?`<small>Fin de mois</small>${money(f.end,f.end<0?'neg':'')}`:`<small>Solde du mois</small>${money(f.net,f.net<0?'neg':'')}`}</span></div>
    <div class="acc-k"><span><small>Entrées</small><b class="${f.inn?'pos':''}">${f.inn?'+':''}${eur(f.inn)}</b></span><span><small>Sorties</small><b class="${f.out?'neg':''}">${f.out?'−':''}${eur(f.out)}</b></span>
     <span><small>${f.hasBalance?`Solde au ${new Date(a.balanceDate+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}`:'Solde actuel'}</small><b>${f.hasBalance?eur(a.balance):'à saisir'}</b></span></div>
    ${f.risk?`<p class="neg acc-alert">${ic('alert',14)} ${f.hasBalance?`Risque de découvert : ${eur(f.min)} vers le ${f.minDay} ${monthLabel(m).split(' ')[0]}.`:`Les sorties dépassent les entrées : prévoir au moins ${eur(f.needed)} sur le compte en début de mois.`}</p>`:''}
    ${f.upcoming&&f.upcoming.length?`<ul class="acc-up">${f.upcoming.map(e=>`<li><span class="day">${e.day}</span><span>${esc(e.label)}</span><b>${eur(-e.amount)}</b></li>`).join('')}</ul>`:''}
   </button>`).join(''):empty('wallet','Ajoutez vos comptes courants (compte joint, comptes personnels) pour suivre les entrées, les sorties et le solde prévisionnel.')}
  ${F.length?`<p class="mut note">Prévision : solde saisi + revenus reçus − charges prélevées − dépenses diverses − épargne du mois − virements, jour par jour. Mettez à jour le solde de temps en temps pour une prévision fiable.</p>`:''}`}
function accSheet(id){const a=D.accounts.find(x=>x.id===id)||{owner:'joint'},used=id?D.fixed.filter(f=>f.account===id).length+D.incomes.filter(i=>i.account===id).length:0;
  openSheet(id?'Modifier le compte':'Nouveau compte',`<form id="fAcc" novalidate>
   <label>Libellé<input name="label" value="${esc(a.label||'')}" placeholder="ex. Compte joint" required></label>
   <div class="f2"><label>Banque<input name="bank" value="${esc(a.bank||'')}" placeholder="ex. Banque Exemple" list="bankList"></label>
   <label>Titulaire<select name="owner">${[['joint','Joint'],['p1',D.names.p1],['p2',D.names.p2]].map(([v,l])=>`<option value="${v}" ${a.owner===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div>
   <datalist id="bankList">${[...new Set(D.accounts.map(x=>x.bank).concat(D.placements.map(x=>x.bank)).filter(Boolean))].map(b=>`<option value="${esc(b)}">`).join('')}</datalist>
   <div class="f2"><label>Solde actuel (€)<input name="balance" inputmode="decimal" value="${typeof a.balance==='number'?a.balance:''}" placeholder="facultatif"></label>
   <label>À la date du<input name="balanceDate" type="date" value="${a.balanceDate||todayIso()}"></label></div>
   <fieldset class="feed" ${a.owner==='joint'?'':'hidden'}><legend>Alimentation mensuelle du compte</legend><div class="f2">
    <label>Versement de ${esc(D.names.p1)} (€)<input name="f1" inputmode="decimal" value="${a.feed?.p1||''}" placeholder="0"></label><label>Versement de ${esc(D.names.p2)} (€)<input name="f2" inputmode="decimal" value="${a.feed?.p2||''}" placeholder="0"></label></div>
    <label>Jour des versements<input name="fday" type="number" min="1" max="31" value="${a.feed?.day||''}" placeholder="1"></label><p class="mut">Prélevés sur le compte personnel de chacun.</p></fieldset>
   <p class="mut">Le solde sert de point de départ à la prévision. Un solde négatif est accepté.</p><p id="accErr" class="neg" role="alert"></p>
   <button class="btn">Enregistrer</button>${id?`<button type="button" class="btn danger" data-del="accounts|${id}" ${used?`data-used="${used}"`:''}>${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>{
   $('#fAcc [name=owner]').addEventListener('change',e=>{$('#fAcc .feed').hidden=e.target.value!=='joint'});
   $('#fAcc').addEventListener('submit',e=>{e.preventDefault();const v=fd(e.target),err=$('#accErr');if(!v.label.trim()){err.textContent='Indiquez un libellé.';return}
    const bs=String(v.balance).trim(),bal=bs===''?null:parseFloat(bs.replace(/\s/g,'').replace(',','.'));if(bs!==''&&!isFinite(bal)){err.textContent='Solde invalide.';return}
    const o={id:id||uid(),label:v.label.trim(),bank:v.bank.trim(),owner:v.owner,feed:v.owner==='joint'&&(num(v.f1)||num(v.f2))?{p1:r2(num(v.f1)),p2:r2(num(v.f2)),day:Math.min(31,parseInt(v.fday)||0)||null}:null};if(bal!==null){o.balance=r2(bal);o.balanceDate=v.balanceDate||todayIso()}else{delete a.balance;delete a.balanceDate}
    if(id)Object.assign(a,o);else D.accounts.push(o);closeSheet();save();toast('Compte enregistré')})})}
function accountAlerts(){const m=curMonth(),t=todayIso();return D.accounts.map(a=>({a,f:accountForecast(D,a,m,t)})).filter(x=>x.f.risk)}
function accountAlertCard(){const L=accountAlerts();if(!L.length)return'';
  return `<div class="card remind" role="status">${ic('alert',16)} <span>${L.map(({a,f})=>`<b>${esc(a.label)}</b> : ${f.hasBalance?`risque de découvert (${eur(f.min)} le ${f.minDay})`:`sorties supérieures aux entrées`}`).join(' · ')}</span> <button class="link" data-goto="budget" data-seg-to="comptes">Voir les comptes</button></div>`}
document.addEventListener('click',e=>{const t=e.target.closest('[data-edit-acc]');if(t)return accSheet(t.dataset.editAcc);if(e.target.closest('#addAcc'))return accSheet()});
document.addEventListener('change',e=>{if(e.target.id==='accMonth'){accMonth=e.target.value||null;render()}});
