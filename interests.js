'use strict';
/* ---------- Intérêts : livrets (quinzaines), fonds euros d'assurance vie, récapitulatif ---------- */
const isLivret=p=>LIVRETS_I.includes(p.type);
const euroAmount=(p,at)=>{if(p.type!=='av'||!(+p.euroValue>0))return 0;if(p.euroMode==='amount')return +p.euroValue;
  let v=placValue(p);if(at){const L=valsOf(p.id).filter(x=>x.date<=at);if(L.length)v=+L[L.length-1].value}return v*Math.min(100,+p.euroValue)/100};
const lastEuroRate=p=>{const L=D.interests.filter(i=>i.pid===p.id&&i.kind==='euro'&&i.rate).sort((a,b)=>b.year-a.year);return L.length?+L[0].rate:(+p.euroRate||null)};
const icx=()=>({rates:RATES,movements:D.movements,interests:D.interests,today:todayIso()});
const liInt=(p,Y)=>livretInterest(p,Y,icx());
function interestYear(today=new Date()){const m=today.getMonth()+1,d=today.getDate();return m===12&&d===31?today.getFullYear():m<=2?today.getFullYear()-1:null}
function pendingInterests(){const Y=interestYear();if(!Y)return{Y:null,L:[]};const has=pid=>D.interests.some(i=>i.pid===pid&&i.year===Y);
  const L=[];D.placements.forEach(p=>{if(has(p.id))return;
    if(isLivret(p)&&(+p.capital>0||D.movements.some(x=>x.pid===p.id))){const r=liInt(p,Y);if(r.amount>0)L.push({p,kind:'livret',amount:r.amount,r})}
    else if(p.type==='av'&&+p.euroValue>0){const base=r2(euroAmount(p,`${Y}-01-01`));L.push({p,kind:'euro',base,rate:lastEuroRate(p)})}});
  return{Y,L}}
function interestCard(){const {Y,L}=pendingInterests();if(!Y||!L.length)return'';
  return `<div class="card remind-card"><h2>${ic('trend',18)} Intérêts ${Y} à valider</h2><p class="mut">${new Date().getMonth()===11?'Les intérêts de l’année sont crédités au 31 décembre.':'Les intérêts de l’an dernier ont été crédités au 31 décembre.'} Vérifiez le montant réellement versé sur votre relevé et corrigez-le si besoin.</p>
   ${L.map(x=>{const nm=esc(x.p.name||ptype(x.p.type)[1]),cd=x.p.capitalDate||'',add=x.kind==='livret'?!(cd>=`${Y+1}-01-01`):x.p.euroMode==='amount';
    return `<form class="qint" data-pid="${x.p.id}" data-kind="${x.kind}" data-y="${Y}"><b>${nm}</b>
     ${x.kind==='livret'?`<small>Estimation (règle des quinzaines, taux ${Y}) : ${eur(x.amount)}</small>`:`<small>Fonds euros ≈ ${eur(x.base)} au 1er janvier ${Y}. Saisissez le rendement net ${Y} annoncé par l’assureur.</small>`}
     <div class="f2">${x.kind==='euro'?`<label>Rendement net (%)<input name="rate" inputmode="decimal" value="${x.rate!=null?String(x.rate).replace('.',','):''}" placeholder="ex. 2,5" required></label>`:''}
      <label>Intérêts crédités (€)<input name="amount" inputmode="decimal" value="${x.kind==='livret'?String(x.amount).replace('.',','):''}" ${x.kind==='livret'?'required':''} placeholder="${x.kind==='euro'?'calcul auto':''}"></label></div>
     <label class="check"><input type="checkbox" name="add" ${add?'checked':''}> ${x.kind==='livret'?'Ajouter au solde du livret':'Ajouter à la part fonds euros (montant)'}</label>
     <div class="f2"><button class="btn small">Valider</button><button type="button" class="btn ghost small" data-int-skip="${x.p.id}|${Y}">Ignorer</button></div></form>`}).join('')}</div>`}
function recordInterest(p,Y,amount,{kind,rate,computed,add}){const id=`int-${p.id}-${Y}`,ex=D.interests.find(i=>i.id===id),o={id,pid:p.id,year:Y,amount:r2(amount),kind,date:todayIso(),added:!!add};
  if(rate!=null)o.rate=rate;if(computed!=null)o.computed=r2(computed);if(ex)Object.assign(ex,o);else D.interests.push(o);
  if(add&&amount>0){if(kind==='livret'){p.capital=r2((+p.capital||0)+amount);p.capitalDate=todayIso()}else if(kind==='euro'&&p.euroMode==='amount')p.euroValue=r2((+p.euroValue||0)+amount)}}
document.addEventListener('submit',e=>{const f=e.target.closest('form.qint');if(!f)return;e.preventDefault();const p=D.placements.find(x=>x.id===f.dataset.pid);if(!p)return;const Y=+f.dataset.y,v=fd(f),kind=f.dataset.kind;
  let amount=String(v.amount||'').trim()===''?null:num(v.amount),rate=null,computed=null;
  if(kind==='euro'){rate=num(v.rate);if(String(v.rate||'').trim()===''||!(rate>-10&&rate<20)){f.elements.rate.focus();return toast('Rendement invalide')}computed=euroAmount(p,`${Y}-01-01`)*rate/100;if(amount===null)amount=computed}
  else computed=liInt(p,Y).amount;
  if(amount===null||!(amount>=0)){f.elements.amount.focus();return toast('Montant invalide')}
  recordInterest(p,Y,amount,{kind,rate,computed,add:!!v.add});save();toast(`Intérêts ${Y} enregistrés : ${eur(amount)}`)},true);
document.addEventListener('click',e=>{const s=e.target.closest('[data-int-skip]');if(!s)return;const [pid,Y]=s.dataset.intSkip.split('|'),p=D.placements.find(x=>x.id===pid);if(!p)return;
  D.interests.push({id:`int-${pid}-${Y}`,pid,year:+Y,amount:0,kind:isLivret(p)?'livret':'euro',skipped:true,date:todayIso()});save();toast('Ignoré : modifiable dans le récap des intérêts')});
/* --- blocs pour la fiche placement --- */
function livretBlock(p){if(!p||!D.placements.find(x=>x.id===p.id))return'';const Y=new Date().getFullYear(),r=liInt(p,Y),M=D.movements.filter(x=>x.pid===p.id).sort((a,b)=>b.date.localeCompare(a.date)),lastY=liInt(p,Y-1);
  return `<div class="sec"><h2>Intérêts & mouvements</h2></div>
   <div class="hero-grid"><div><small>Intérêts ${Y} estimés</small><b class="pos">${eur(r.amount)}</b></div><div><small>Solde au 1er janvier ${Y}${r.estimatedB0?' (estimé)':''}</small><b>${eur(r.B0)}</b></div></div>
   <details><summary>Détail par quinzaine</summary><ul class="bal-l">${r.quinzaines.map(q=>`<li><span>${new Date(q.date+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span><small>${eur(q.bal)} à ${pct(q.rate)}</small><b>${eur(q.i)}</b></li>`).join('')}</ul>
    <p class="mut">Règle officielle : un versement rapporte à partir du 1er ou du 16 qui suit ; un retrait cesse de rapporter dès le 1er ou le 16 qui précède. Intérêts = solde de chaque quinzaine × taux ÷ 24, crédités au 31 décembre.${p.monthly>0&&!p.noAuto?` Versement programmé de ${eur(p.monthly)} pris en compte chaque mois (le ${Math.min(28,Math.max(1,parseInt(p.payDay)||1))}).`:''}</p></details>
   <form id="fOpen" class="valform"><label>Solde réel au 1er janvier ${Y} (€, facultatif)<input name="open" inputmode="decimal" value="${p.open&&typeof p.open[Y]==='number'?String(p.open[Y]).replace('.',','):''}" placeholder="${eur(r.B0)} estimé"></label><button class="btn ghost small">Enregistrer le solde d’ouverture</button></form>
   <form id="fMov" class="valform"><div class="f2"><label>Date<input type="date" name="date" value="${todayIso()}" required></label><label>Montant (€)<input name="amount" inputmode="decimal" data-signed placeholder="+ versement / − retrait" required></label></div>
    <label>Libellé<input name="label" placeholder="ex. Versement exceptionnel"></label><button class="btn ghost">${ic('plus',16)} Ajouter un mouvement</button><p class="mut">Les versements programmés sont déjà comptés : n’ajoutez que les versements exceptionnels et les retraits.</p></form>
   <div class="list">${M.map(m=>`<div class="item"><span class="grow"><b class="${m.amount<0?'neg':'pos'}">${m.amount<0?'−':'+'}${eur(Math.abs(m.amount))}</b><small>${frDate(m.date)}${m.label?' · '+esc(m.label):''}</small></span><button type="button" class="icon-btn" data-del="movements|${m.id}" aria-label="Supprimer le mouvement du ${frDate(m.date)}">${ic('trash',16)}</button></div>`).join('')}</div>
   ${lastY.amount>0?`<p class="mut">Pour mémoire, intérêts ${Y-1} estimés : ${eur(lastY.amount)}.</p>`:''}`}
function bindLivretBlock(id){on('#fMov','submit',e=>{e.preventDefault();const v=fd(e.target),s=String(v.amount).trim().replace(/^\+/,''),a=parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
    if(!isFinite(a)||a===0){e.target.elements.amount.focus();return toast('Montant invalide')}D.movements.push({id:uid(),pid:id,date:v.date||todayIso(),amount:r2(a),label:v.label.trim()});save();placSheet(id);toast('Mouvement ajouté')});
  on('#fOpen','submit',e=>{e.preventDefault();const v=fd(e.target),p=D.placements.find(x=>x.id===id),Y=new Date().getFullYear(),s=String(v.open).trim();p.open={...(p.open||{})};
    if(s==='')delete p.open[Y];else{const a=num(s);if(!(a>=0))return toast('Montant invalide');p.open[Y]=r2(a)}save();placSheet(id);toast('Solde d’ouverture enregistré')})}
function avEuroFields(p){const m=p.euroMode||'pct';return `<fieldset class="feed"><legend>Répartition fonds euros / unités de compte</legend><div class="f2">
   <label>Part en fonds euros<select name="euroMode"><option value="pct" ${m==='pct'?'selected':''}>en % de la valorisation</option><option value="amount" ${m==='amount'?'selected':''}>en montant (€)</option></select></label>
   <label>Valeur<input name="euroValue" inputmode="decimal" value="${p.euroValue??''}" placeholder="${m==='pct'?'ex. 60':'ex. 8000'}"></label></div>
   ${p.id&&+p.euroValue>0?`<p class="mut">Fonds euros ≈ ${eur(euroAmount(p))} · unités de compte ≈ ${eur(Math.max(0,placValue(p)-euroAmount(p)))}.${lastEuroRate(p)!=null?` Dernier rendement net du fonds euros : ${pct(lastEuroRate(p))}.`:''}</p>`:''}
   <p class="mut">En janvier, l’appli vous demande le rendement net du fonds euros de l’année passée et calcule les intérêts crédités.</p></fieldset>`}
/* --- vue Récap des intérêts --- */
function vInterets(){const Y=new Date().getFullYear(),years=[...new Set(D.interests.filter(i=>!i.skipped).map(i=>i.year))].sort((a,b)=>b-a);
  const name=pid=>{const p=D.placements.find(x=>x.id===pid);return p?(p.name||ptype(p.type)[1]):'Placement supprimé'};
  const cur=D.placements.map(p=>{if(isLivret(p))return{p,v:liInt(p,Y).amount,how:'quinzaines, taux '+Y};if(p.type==='av'&&+p.euroValue>0&&lastEuroRate(p)!=null)return{p,v:r2(euroAmount(p,`${Y}-01-01`)*lastEuroRate(p)/100),how:'fonds euros au dernier rendement connu'};
    if(isEnv(p)&&+p.rate)return{p,v:r2(placValue(p)*p.rate/100),how:'rendement estimé, non garanti'};return null}).filter(x=>x&&x.v>0);
  const curT=cur.reduce((s,x)=>s+x.v,0),S=project(streams()),fut=[1,2,3,4].map(k=>{const a=S[(k-1)*12],b=S[k*12];return{y:Y+k,v:r2((b.total-b.inv)-(a.total-a.inv))}});
  const all=years.map(y=>({y,v:D.interests.filter(i=>i.year===y&&!i.skipped).reduce((s,i)=>s+(+i.amount||0),0)})),tot=all.reduce((s,x)=>s+x.v,0);
  const interestPoints=[...all.filter(x=>x.y<Y).reverse(),{y:Y,v:curT,status:'estimé'},...fut].map(x=>({label:`${x.y}${x.status?' · '+x.status:x.y>Y?' · potentiel':''}`,short:String(x.y),values:{v:x.v},detail:x.y>Y?'Projection au taux actuel, non garantie':x.status?'Estimation de l’année en cours':'Intérêts enregistrés'}));
  return `<div class="card hero"><small>Intérêts perçus · total enregistré</small><div class="hero-n">${money(tot)}</div><div class="hero-grid"><div><small>${Y} (estimé)</small>${money(curT)}</div><div><small>${Y+1} (potentiel)</small>${money(fut[0].v)}</div></div></div>
  <div class="card"><h2>Par année</h2>${interactiveChart({title:'Intérêts par année',type:'bars',series:[{key:'v',name:'Intérêts / gains estimés',color:'#3ecf8e'}],points:interestPoints})}
   <p class="mut">Potentiel : projection sur 4 ans (taux actuels, versements programmés, rendement estimé de chaque enveloppe y compris les unités de compte, non garanti). Pour une assurance vie dont la part fonds euros est renseignée, l’estimation de l’année en cours ne compte que les intérêts du fonds euros.</p></div>
  <div class="card"><h2>${Y} en cours (estimation)</h2>${cur.length?`<ul class="bal-l">${cur.map(x=>`<li><span>${esc(x.p.name||ptype(x.p.type)[1])}</span><small>${esc(x.how)}</small><b>${eur(x.v)}</b></li>`).join('')}</ul>`:'<p class="mut">Ajoutez des livrets ou une assurance vie pour estimer les intérêts.</p>'}</div>
  ${years.map(y=>`<div class="card"><h2>${y}</h2><ul class="bal-l">${D.interests.filter(i=>i.year===y).map(i=>`<li><span>${esc(name(i.pid))}</span><small>${i.skipped?'ignoré':i.kind==='euro'?`fonds euros${i.rate!=null?' · '+pct(i.rate):''}`:'livret'}${i.computed!=null&&Math.abs(i.computed-i.amount)>0.009?` · estimé ${eur(i.computed)}`:''}</small><b><button class="link" data-edit-int="${i.id}">${eur(i.amount)}</button></b></li>`).join('')}</ul></div>`).join('')}
  <div class="card"><h2>Ajouter des intérêts</h2><form id="fIntAdd"><div class="f2"><label>Placement<select name="pid">${D.placements.map(p=>`<option value="${p.id}">${esc(p.name||ptype(p.type)[1])}</option>`).join('')}</select></label><label>Année<input name="year" type="number" min="2000" max="${Y}" value="${Y-1}"></label></div>
   <label>Montant crédité (€)<input name="amount" inputmode="decimal" required></label><button class="btn ghost" ${D.placements.length?'':'disabled'}>Enregistrer</button></form></div>`}
document.addEventListener('submit',e=>{if(e.target.id!=='fIntAdd')return;e.preventDefault();const v=fd(e.target),p=D.placements.find(x=>x.id===v.pid),a=num(v.amount),y=parseInt(v.year);
  if(!p||!(a>=0)||String(v.amount).trim()===''||!(y>=2000&&y<=new Date().getFullYear()))return toast('Vérifiez le montant et l’année');recordInterest(p,y,a,{kind:isLivret(p)?'livret':p.type==='av'?'euro':'env',add:false});save();toast('Intérêts enregistrés')});
document.addEventListener('click',e=>{const b=e.target.closest('[data-edit-int]');if(!b)return;const i=D.interests.find(x=>x.id===b.dataset.editInt);if(!i)return;
  openSheet('Intérêts '+i.year,`<form id="fIntEd"><label>Montant crédité (€)<input name="amount" inputmode="decimal" value="${String(i.amount).replace('.',',')}" required></label>${i.kind==='euro'?`<label>Rendement net (%)<input name="rate" inputmode="decimal" value="${i.rate!=null?String(i.rate).replace('.',','):''}"></label>`:''}
   <p class="mut">${i.added?'Ce montant a été ajouté au solde lors de la validation ; le corriger ici ne modifie pas le solde.':'Ce montant n’a pas été ajouté au solde.'}</p><button class="btn">Enregistrer</button><button type="button" class="btn danger" data-del="interests|${i.id}">${ic('trash',16)} Supprimer</button></form>`,()=>{
   $('#fIntEd').addEventListener('submit',ev=>{ev.preventDefault();const v=fd(ev.target),a=num(v.amount);if(!(a>=0))return toast('Montant invalide');i.amount=r2(a);i.skipped=false;if('rate' in v&&String(v.rate).trim()!=='')i.rate=num(v.rate);closeSheet();save();toast('Corrigé')})})});
