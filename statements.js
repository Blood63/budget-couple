'use strict';
/* ---------- Import de relevés de compte (PDF, CSV, OFX, QIF) : tout est lu dans le navigateur ---------- */
const ST_TYPES=[['depense','Dépense diverse'],['charge','Charge fixe'],['virement','Virement interne'],['revenu','Revenu'],['epargne','Versement épargne'],['exclu','Exclure']];
let RV=null; // relevé en cours de revue
async function pdfStatementLines(buf){const lib=await pdfjs(),doc=await lib.getDocument({data:buf,isEvalSupported:false}).promise,L=[];
  for(let p=1;p<=Math.min(doc.numPages,30);p++){const pg=await doc.getPage(p),tc=await pg.getTextContent(),rows=[];
    tc.items.filter(i=>i.str&&i.str.trim()).forEach(i=>{const x=i.transform[4],y=i.transform[5],w=i.width||0;let r=rows.find(r=>Math.abs(r.y-y)<=2.5);if(!r){r={y,items:[]};rows.push(r)}r.items.push({str:i.str,x,w})});
    rows.sort((a,b)=>b.y-a.y).forEach(r=>{r.items.sort((a,b)=>a.x-b.x);// fusionne les morceaux d'un même mot/nombre
      const m=[];r.items.forEach(i=>{const l=m[m.length-1];if(l&&i.x-(l.x+l.w)<1.5&&!(AMT_ONLY.test(l.str.trim())&&/[A-Za-z]/.test(i.str))){l.str+=i.str;l.w=i.x+i.w-l.x}else m.push({...i})});L.push({y:r.y,items:m})})}
  return L}
async function readStatement(file){const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(isPdf){const L=await pdfStatementLines(await file.arrayBuffer());return{format:'PDF',ops:parseStatementLines(L)}}
  const buf=await file.arrayBuffer();let t=new TextDecoder('utf-8').decode(buf);if(t.includes('\ufffd'))t=new TextDecoder('windows-1252').decode(buf);return parseStatementText(file.name,t)}
const ownerPay=accId=>{const o=(D.accounts.find(a=>a.id===accId)||{}).owner;return o==='p1'||o==='p2'?o:'joint'};
function buildReview(ops,accId,file,format){const seen=new Set(D.imports.flatMap(i=>i.hashes||[])),R=[],inFile=new Set();
  ops.forEach(o=>{const hash=opHash(o),c=classifyOp(o,D,accId,{rules:D.catrules}),pay=ownerPay(accId);const r={...o,hash,...c,type:c.type,category:c.category||'autre',paidBy:pay,note:''};
    if(seen.has(hash)||inFile.has(hash)){r.type='exclu';r.dup=true;r.note='Déjà importé'}
    else if(o.amount<0&&D.misc.some(m=>!m.hash&&Math.abs(m.amount+o.amount)<0.01&&Math.abs((new Date(m.date)-new Date(o.date))/864e5)<=3)){r.type='exclu';r.dup=true;r.note='Doublon possible d’une dépense saisie à la main'}
    inFile.add(hash);R.push(r)});
  RV={acc:accId,file,format,rows:R.sort((a,b)=>a.date.localeCompare(b.date))};return RV}
function importSheet(accId){if(!D.accounts.length){toast('Ajoutez d’abord un compte courant');budgetSeg='comptes';return go('budget')}
  openSheet('Importer un relevé',`<form id="fImp"><label>Compte du relevé<select name="acc" id="impAcc">${accOpts(accId||D.accounts[0].id)}</select></label>
   <label class="btn ghost file-l">${ic('file',16)} Choisir le relevé (PDF, CSV, OFX, QIF)<input type="file" id="impFile" accept=".pdf,.csv,.txt,.ofx,.qfx,.qif,application/pdf,text/csv"></label>
   <p id="impStatus" class="mut" role="status" aria-live="polite"></p>
   <p class="disclaimer">${ic('info',14)} Le relevé est lu sur cet appareil : rien n’est envoyé à un service tiers et le fichier n’est pas conservé. Vous vérifiez chaque ligne avant validation.</p></form>`,()=>{
   on('#impFile','change',async e=>{const f=e.target.files[0],st=$('#impStatus');if(!f)return;st.textContent='Lecture du relevé…';
     try{const r=await readStatement(f);if(!r.ops.length){st.textContent=`Aucune opération reconnue dans ce fichier (${r.format}). Essayez l’export CSV ou OFX de votre banque.`;return}
       buildReview(r.ops,$('#impAcc').value,f.name,r.format);reviewSheet()}catch(x){st.textContent='Lecture impossible : '+(x&&x.message||x)}})})}
const fixedName=id=>{const f=D.fixed.find(x=>x.id===id);return f?f.label:''};
function rvRow(r,i){if(r.del)return'';const dep=r.type==='depense';
  return `<li class="rv ${r.type}" data-i="${i}"><div class="row-b"><span class="grow"><b>${esc(r.label||'Opération')}</b><small>${frDate(r.date)}${r.note?` · <span class="warn-t">${esc(r.note)}</span>`:''}${r.type==='charge'&&r.fixedId?` · ${esc(fixedName(r.fixedId))}`:''}</small></span>
   <b class="${r.amount<0?'':'pos'}">${r.amount<0?'−':'+'}${eur(Math.abs(r.amount))}</b></div>
   <div class="rv-f"><select data-k="type" aria-label="Type de « ${esc(r.label)} »">${ST_TYPES.map(([k,l])=>`<option value="${k}" ${r.type===k?'selected':''}>${l}</option>`).join('')}</select>
    ${dep?`<select data-k="category" aria-label="Catégorie de « ${esc(r.label)} »">${catOpts('misc',r.category)}</select><select data-k="paidBy" aria-label="Payeur de « ${esc(r.label)} »">${paidOpts().map(([v,l])=>`<option value="${v}" ${r.paidBy===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`:''}
    ${r.type==='charge'?`<select data-k="fixedId" aria-label="Charge correspondante">${D.fixed.map(f=>`<option value="${f.id}" ${r.fixedId===f.id?'selected':''}>${esc(f.label)} · ${eur(f.amount)}</option>`).join('')}</select>`:''}
    <button type="button" class="icon-btn" data-rv-del="${i}" aria-label="Supprimer la ligne « ${esc(r.label)} »">${ic('trash',16)}</button></div></li>`}
function rvSummary(){const L=RV.rows.filter(r=>!r.del),c=k=>L.filter(r=>r.type===k).length,dep=L.filter(r=>r.type==='depense').reduce((s,r)=>s-r.amount,0);
  return `<div class="hero-grid"><div><small>Dépenses diverses</small><b>${c('depense')} · ${eur(dep)}</b></div><div><small>Charges fixes reconnues</small><b>${c('charge')}</b></div>
   <div><small>Virements / épargne</small><b>${c('virement')+c('epargne')}</b></div><div><small>Revenus · exclues</small><b>${c('revenu')} · ${c('exclu')}</b></div></div>`}
function reviewSheet(){const R=RV;openSheet(`Relevé · ${accName(R.acc)}`,`<p class="mut">${esc(R.file)} · ${R.format} · ${R.rows.length} opération(s). Seules les lignes « Dépense diverse » seront ajoutées ; charges fixes, virements entre vos comptes, revenus et épargne ne sont pas comptés deux fois.</p>
   <div id="rvSum">${rvSummary()}</div><ul class="rv-l" id="rvList">${R.rows.map(rvRow).join('')}</ul>
   <button class="btn" id="rvOk">Valider l’import</button><button type="button" class="btn ghost" id="rvCancel">Annuler</button>`,()=>{
   const list=$('#rvList');
   list.addEventListener('change',e=>{const li=e.target.closest('[data-i]'),k=e.target.dataset.k;if(!li||!k)return;const r=R.rows[+li.dataset.i];r[k]=e.target.value;
     if(k==='category'){r.catChanged=true;const mk=merchantKey(r.label);if(mk)R.rows.forEach(x=>{if(x!==r&&!x.catChanged&&x.type==='depense'&&merchantKey(x.label)===mk)x.category=r.category})}
     if(k==='type'&&r.type==='charge'&&!r.fixedId&&D.fixed[0])r.fixedId=D.fixed[0].id;
     if(k==='type'||k==='category'){const y=$('#sheetBody').scrollTop;list.innerHTML=R.rows.map(rvRow).join('');$('#sheetBody').scrollTop=y;list.querySelector(`[data-i="${li.dataset.i}"] [data-k="${k}"]`)?.focus()}
     $('#rvSum').innerHTML=rvSummary()});
   list.addEventListener('click',e=>{const b=e.target.closest('[data-rv-del]');if(!b)return;const i=+b.dataset.rvDel;R.rows[i].del=true;b.closest('li').remove();$('#rvSum').innerHTML=rvSummary();
     toastUndo('Ligne supprimée',()=>{R.rows[i].del=false;list.innerHTML=R.rows.map(rvRow).join('');$('#rvSum').innerHTML=rvSummary()})});
   on('#rvCancel','click',()=>{RV=null;closeSheet()});on('#rvOk','click',commitImport)})}
function commitImport(){const R=RV;if(!R)return;const id='imp-'+uid(),acc=R.acc,L=R.rows.filter(r=>!r.del),dep=L.filter(r=>r.type==='depense');
  dep.forEach(r=>{const pb=r.paidBy||'joint',fo=pb==='joint'?'common':pb;D.misc.push({id:uid(),date:r.date,label:r.label,amount:r2(-r.amount),category:r.category||'autre',paidBy:pb,for:fo,payer:fo==='common'?'common':fo,account:acc,source:'import',importId:id,hash:r.hash})});
  L.filter(r=>r.catChanged&&r.type==='depense').forEach(r=>{const key=merchantKey(r.label);if(!key)return;const rid='kw-'+key.toLowerCase().replace(/[^a-z0-9]+/g,'-'),ex=D.catrules.find(x=>x.id===rid);if(ex)ex.category=r.category;else D.catrules.push({id:rid,key,category:r.category})});
  const months=[...new Set(L.map(r=>r.date.slice(0,7)))].sort(),cnt={};ST_TYPES.forEach(([k])=>cnt[k]=L.filter(r=>r.type===k).length);
  D.imports.push({id,account:acc,file:R.file,format:R.format,date:todayIso(),months,counts:cnt,total:r2(dep.reduce((s,r)=>s-r.amount,0)),hashes:R.rows.map(r=>r.hash),
    charges:L.filter(r=>r.type==='charge').map(r=>({fixedId:r.fixedId,date:r.date,amount:r2(-r.amount)}))});
  RV=null;const main=months.length?months.reduce((a,m)=>L.filter(r=>r.date.startsWith(m)).length>L.filter(r=>r.date.startsWith(a)).length?m:a):curMonth();
  D.miscMonth=main;save();importRecap(id);toast(`${dep.length} dépense(s) ajoutée(s)`)}
function importRecap(id){const I=D.imports.find(x=>x.id===id);if(!I)return closeSheet();const items=D.misc.filter(m=>m.importId===id),mo=I.months.length?I.months[I.months.length-1]:curMonth();
  const month=D.misc.filter(x=>x.date.startsWith(D.miscMonth||mo)),tot=month.reduce((s,x)=>s+x.amount,0);
  openSheet('Import terminé',`<div class="hero-grid"><div><small>Dépenses ajoutées</small><b>${items.length} · ${eur(items.reduce((s,x)=>s+x.amount,0))}</b></div><div><small>Charges fixes reconnues</small><b>${I.counts.charge||0}</b></div>
    <div><small>Virements / épargne exclus</small><b>${(I.counts.virement||0)+(I.counts.epargne||0)}</b></div><div><small>Revenus / exclues</small><b>${(I.counts.revenu||0)} · ${(I.counts.exclu||0)}</b></div></div>
   <h3 class="group">Dépenses diverses de ${monthLabel(D.miscMonth||mo)} par catégorie</h3>${tot?donut(catBreakdown('misc',month),tot,'ce mois'):'<p class="mut">Aucune dépense ce mois.</p>'}
   <button class="btn" data-goto="budget" data-seg-to="diverses">Voir les dépenses</button>
   <button type="button" class="btn danger" data-imp-undo="${id}">${ic('trash',16)} Annuler cet import (${items.length} dépense(s))</button>
   <p class="mut">${esc(I.file)} · importé le ${frDate(I.date)} sur ${esc(accName(I.account))}.</p>`,()=>{})}
function undoImport(id){const I=D.imports.find(x=>x.id===id);if(!I)return;const items=D.misc.filter(m=>m.importId===id);
  D.misc=D.misc.filter(m=>m.importId!==id);D.imports=D.imports.filter(x=>x.id!==id);closeSheet();save();
  toastUndo(`Import annulé (${items.length} dépense(s) retirée(s))`,()=>{D.misc.push(...items);D.imports.push(I);save()})}
function importsList(){if(!D.imports.length)return'';return `${sec('Relevés importés')}<div class="list">${[...D.imports].reverse().slice(0,24).map(I=>`<button class="item" data-imp="${I.id}"><span class="avatar">${ic('file',16)}</span><span class="grow"><b>${esc(I.file)}</b><small>${esc(accName(I.account))} · ${I.months.map(monthLabel).join(', ')} · ${D.misc.filter(m=>m.importId===I.id).length} dépense(s)</small></span>${ic('chev',16)}</button>`).join('')}</div>`}
/* Annulation : toast avec bouton */
function toastUndo(text,undo){toast(text);const el=$('#toast');const b=document.createElement('button');b.className='toast-undo';b.type='button';b.textContent='Annuler';
  b.addEventListener('click',()=>{el.classList.remove('show');undo()},{once:true});el.appendChild(b);clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),6000)}
/* Dépenses diverses : modification et suppression avec annulation */
function delMisc(id){const i=D.misc.findIndex(x=>x.id===id);if(i<0)return;const x=D.misc[i];D.misc.splice(i,1);closeSheet();save();
  toastUndo(`« ${x.label||catName('misc',x.category)} » supprimée`,()=>{if(!D.misc.some(m=>m.id===x.id)){D.misc.splice(Math.min(i,D.misc.length),0,x);delete D.deleted[x.id];save()}})}
document.addEventListener('click',e=>{const t=e.target.closest('[data-imp],[data-imp-undo],[data-del-misc],[data-edit-misc],#impStmt');if(!t)return;
  if(t.id==='impStmt')return importSheet(t.dataset.acc);if(t.dataset.impUndo)return undoImport(t.dataset.impUndo);if(t.dataset.imp)return importRecap(t.dataset.imp);
  if(t.dataset.delMisc)return delMisc(t.dataset.delMisc);if(t.dataset.editMisc)return miscSheet(t.dataset.editMisc)});
