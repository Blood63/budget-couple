'use strict';
/* ---------- Dettes entre nous : petites sommes avancées, suivies à part de l'équilibre mensuel ---------- */
const dOther=k=>k==='p1'?'p2':'p1';
let debtDraft={};
const debtsOpen=()=>(D.debts||[]).filter(x=>!x.repaid);
// net > 0 : p2 doit à p1
function debtTotals(L=debtsOpen()){const r2=x=>Math.round(x*100)/100,t={p1:0,p2:0};L.forEach(x=>{if(t[x.from]!==undefined)t[x.from]+=+x.amount||0});t.p1=r2(t.p1);t.p2=r2(t.p2);return{owes:t,net:r2(t.p2-t.p1)}}
const debtSentence=net=>Math.abs(net)<0.005?'Personne ne doit rien à l’autre.':`${N(net>0?'p2':'p1')} doit ${eur(Math.abs(net))} à ${N(net>0?'p1':'p2')}`;
function debtCard(){const L=debtsOpen().sort((a,b)=>(b.date||'').localeCompare(a.date||'')),A=(D.debts||[]).filter(x=>x.repaid).sort((a,b)=>(b.repaid||'').localeCompare(a.repaid||'')),T=debtTotals(L),def=me?dOther(me):'p2';
  return `<section class="card debts" aria-labelledby="debtsH"><div class="row-b"><h2 id="debtsH">${ic('swap',18)} Dettes entre nous</h2></div>
   <p class="bal-t" id="debtNet">${Math.abs(T.net)<0.005?'<span class="ok-t">Personne ne doit rien à l’autre.</span>':`<b style="color:${COL[T.net>0?'p2':'p1']}">${esc(N(T.net>0?'p2':'p1'))}</b> doit <b>${eur(Math.abs(T.net))}</b> à <b style="color:${COL[T.net>0?'p1':'p2']}">${esc(N(T.net>0?'p1':'p2'))}</b>`}</p>
   ${L.length?`<div class="hero-grid"><div><small>${esc(N('p1'))} doit</small><b>${eur(T.owes.p1)}</b></div><div><small>${esc(N('p2'))} doit</small><b>${eur(T.owes.p2)}</b></div></div>`:''}
   <form id="fDebtQ" class="debt-q" novalidate><div class="f3"><label>Qui doit<select name="from">${['p1','p2'].map(k=>`<option value="${k}" ${k===(debtDraft.from||def)?'selected':''}>${esc(N(k))} → ${esc(N(dOther(k)))}</option>`).join('')}</select></label>
    <label>Montant (€)<input name="amount" inputmode="decimal" placeholder="0" required value="${esc(debtDraft.amount||'')}"></label><label>Libellé<input name="label" placeholder="ex. Ciné, courses…" maxlength="80" value="${esc(debtDraft.label||'')}"></label></div>
    <p class="neg" id="debtErr" role="alert"></p><button class="btn ghost">${ic('plus',16)} Ajouter</button></form>
   <ul class="list debt-l">${L.map(x=>`<li class="item"><span class="grow"><b>${esc(x.label||'Sans libellé')}</b><small>${esc(N(x.from))} → ${esc(N(x.to))} · ${new Date(x.date+"T12:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"2-digit"})}</small></span><span class="debt-end"><b class="num">${eur(x.amount)}</b>
     <button type="button" class="icon-btn" data-debt-repay="${x.id}" aria-label="Marquer « ${esc(x.label||'dette')} » comme remboursé">${ic('check',16)}</button>
     <button type="button" class="icon-btn" data-debt-edit="${x.id}" aria-label="Modifier « ${esc(x.label||'dette')} »">${ic('edit',16)}</button>
     <button type="button" class="icon-btn" data-debt-del="${x.id}" aria-label="Supprimer « ${esc(x.label||'dette')} »">${ic('trash',16)}</button></span></li>`).join('')}</ul>
   ${L.length>1?`<button type="button" class="btn ghost wide" id="debtRepayAll">Tout marquer comme remboursé</button>`:''}
   ${A.length?`<details class="debt-arch"><summary>Remboursées (${A.length})</summary><ul class="bal-l">${A.map(x=>`<li><span>${esc(x.label||'Sans libellé')}</span><small>${esc(N(x.from))} → ${esc(N(x.to))} · ${frDate(x.date)} · remboursé le ${frDate(x.repaid)}</small><b>${eur(x.amount)}</b> <button type="button" class="link" data-debt-unrepay="${x.id}" aria-label="Remettre « ${esc(x.label||'dette')} » en cours">Rouvrir</button></li>`).join('')}</ul></details>`:''}
   <p class="mut">Suivi à part de l’équilibre du mois (charges et dépenses) : rien n’est compté deux fois.</p></section>`}
function debtSheet(id){const x=(D.debts||[]).find(d=>d.id===id);if(!x)return;
  openSheet('Modifier la dette',`<form id="fDebt" novalidate>
   <label>Qui doit<select name="from">${['p1','p2'].map(k=>`<option value="${k}" ${k===x.from?'selected':''}>${esc(N(k))} doit à ${esc(N(dOther(k)))}</option>`).join('')}</select></label>
   <div class="f2"><label>Montant (€)<input name="amount" inputmode="decimal" value="${String(x.amount).replace('.',',')}" required></label><label>Date<input type="date" name="date" value="${x.date||''}" required></label></div>
   <label>Libellé<input name="label" value="${esc(x.label||'')}" maxlength="80"></label><p class="neg" id="debtErr2" role="alert"></p>
   <button class="btn">Enregistrer</button><button type="button" class="btn danger" data-debt-del="${x.id}">${ic('trash',16)} Supprimer</button></form>`,()=>{
   $('#fDebt').addEventListener('submit',e=>{e.preventDefault();const f=fd(e.target),v=num(f.amount);if(!(v>0)){$('#debtErr2').textContent='Le montant doit être positif.';return}if(!f.date){$('#debtErr2').textContent='Indiquez une date.';return}
     const before={...x};Object.assign(x,{from:f.from,to:dOther(f.from),amount:Math.round(v*100)/100,label:f.label.trim(),date:f.date});save();closeSheet();
     toastUndo('Dette modifiée',()=>{const it=D.debts.find(d=>d.id===before.id);if(it){Object.assign(it,{from:before.from,to:before.to,amount:before.amount,label:before.label,date:before.date});save()}})})})}
const debtLabel=x=>x.label||'dette';
document.addEventListener('input',e=>{const f=e.target.closest&&e.target.closest('#fDebtQ');if(f&&e.target.name)debtDraft[e.target.name]=e.target.value});
document.addEventListener('change',e=>{const f=e.target.closest&&e.target.closest('#fDebtQ');if(f&&e.target.name)debtDraft[e.target.name]=e.target.value});
document.addEventListener('submit',e=>{if(e.target.id!=='fDebtQ')return;e.preventDefault();e.stopImmediatePropagation();const f=fd(e.target),v=num(f.amount);
  if(!(v>0)||!/^[\d\s.,]+$/.test(String(f.amount).trim())){$('#debtErr').textContent='Indiquez un montant positif.';e.target.elements.amount.focus();return}
  D.debts=D.debts||[];const o={id:uid(),from:f.from,to:dOther(f.from),amount:Math.round(v*100)/100,label:f.label.trim(),date:todayIso(),repaid:null};D.debts.push(o);debtDraft={};save();
  toastUndo(`Ajouté : ${N(o.from)} doit ${eur(o.amount)}`,()=>{D.debts=D.debts.filter(d=>d.id!==o.id);save()});setTimeout(()=>$('#fDebtQ [name=amount]')?.focus(),30)},true);
document.addEventListener('click',e=>{const t=e.target.closest('[data-debt-repay],[data-debt-edit],[data-debt-del],[data-debt-unrepay],#debtRepayAll');if(!t)return;e.stopPropagation();const d=t.dataset,find=id=>(D.debts||[]).find(x=>x.id===id);
  if(d.debtEdit)return debtSheet(d.debtEdit);
  if(d.debtRepay){const x=find(d.debtRepay);if(!x)return;x.repaid=todayIso();save();return toastUndo(`« ${debtLabel(x)} » remboursé`,()=>{const y=find(x.id);if(y){y.repaid=null;save()}})}
  if(d.debtUnrepay){const x=find(d.debtUnrepay);if(!x)return;const was=x.repaid;x.repaid=null;save();return toastUndo(`« ${debtLabel(x)} » rouvert`,()=>{const y=find(x.id);if(y){y.repaid=was;save()}})}
  if(d.debtDel){const x=find(d.debtDel);if(!x)return;const copy={...x};closeSheet();D.debts=D.debts.filter(y=>y.id!==x.id);save();
    return toastUndo(`« ${debtLabel(x)} » supprimé`,()=>{if(!find(copy.id)){const {u,...r}=copy;D.debts.push(r);save()}})}
  if(t.id==='debtRepayAll'){const L=debtsOpen(),day=todayIso();L.forEach(x=>x.repaid=day);save();
    return toastUndo(`${L.length} dettes marquées remboursées`,()=>{L.forEach(x=>{const y=find(x.id);if(y&&y.repaid===day)y.repaid=null});save()})}},true);
