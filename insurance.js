'use strict';
/* ---------- Assurances : liste, fiches, documents (Supabase Storage privé ou repli local), extraction locale ---------- */
const INS_TYPES=[['habitation','Habitation','home'],['auto','Auto','cart'],['moto','Moto / scooter','cart'],['trottinette','Trottinette / EDPM','cart'],['sante','Santé (mutuelle)','shield'],['prevoyance','Prévoyance','shield'],
  ['emprunteur','Emprunteur','home'],['animal','Animaux','shield'],['affinitaire','Appareil / affinitaire','shield'],['autre','Autre','shield']];
const insType=k=>INS_TYPES.find(t=>t[0]===k)||INS_TYPES[INS_TYPES.length-1];
const BUCKET='documents',MAX_DOC=10*1024*1024;
const yearly=i=>{const p=+i.premium||0;return i.premiumFreq==='mois'?p*12:i.premiumFreq==='trimestre'?p*4:p};
const isoFr=s=>s&&!s.startsWith('--')?s.split('-').reverse().join('/'):s?s.slice(2).split('-').reverse().join('/'):'';
/* --- stockage local (IndexedDB) : documents en repli et texte extrait (jamais synchronisé) --- */
function idb(){return new Promise((ok,ko)=>{const r=indexedDB.open('budget-couple-docs',1);r.onupgradeneeded=()=>r.result.createObjectStore('docs');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)})}
async function idbSet(k,v){const db=await idb();return new Promise((ok,ko)=>{const t=db.transaction('docs','readwrite');t.objectStore('docs').put(v,k);t.oncomplete=()=>ok();t.onerror=()=>ko(t.error)})}
async function idbGet(k){const db=await idb();return new Promise((ok,ko)=>{const r=db.transaction('docs').objectStore('docs').get(k);r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)})}
async function idbDel(k){const db=await idb();return new Promise(ok=>{const t=db.transaction('docs','readwrite');t.objectStore('docs').delete(k);t.oncomplete=()=>ok();t.onerror=()=>ok()})}
/* --- Supabase Storage --- */
async function spaceFolder(){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('budget-couple:'+cfg.space));return [...new Uint8Array(h)].slice(0,16).map(b=>b.toString(16).padStart(2,'0')).join('')}
const stHeaders=extra=>{const h=sbH();delete h['Content-Type'];return Object.assign(h,extra||{})};
const safeName=n=>String(n||'document').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').slice(-80);
let storageState='';// '', 'ok', 'missing', 'denied'
async function storageUpload(insId,file){const path=`${await spaceFolder()}/${insId}/${Date.now().toString(36)}-${safeName(file.name)}`;
  const r=await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${path}`,{method:'POST',headers:stHeaders({'Content-Type':file.type||'application/octet-stream','x-upsert':'true','cache-control':'3600'}),body:file});
  if(r.ok){storageState='ok';return path}let j={};try{j=await r.json()}catch{}const msg=(j.message||j.error||'')+'';
  storageState=/bucket not found/i.test(msg)||r.status===404?'missing':(r.status===401||r.status===403||/row-level security|policy|unauthorized/i.test(msg))?'denied':'error';
  const e=new Error(msg||('HTTP '+r.status));e.state=storageState;throw e}
async function storageGet(path){const r=await fetch(`${cfg.url}/storage/v1/object/authenticated/${BUCKET}/${path}`,{headers:stHeaders()});if(!r.ok)throw new Error('HTTP '+r.status);return r.blob()}
async function storageDelete(path){try{await fetch(`${cfg.url}/storage/v1/object/${BUCKET}`,{method:'DELETE',headers:stHeaders({'Content-Type':'application/json'}),body:JSON.stringify({prefixes:[path]})})}catch{}}
const STORAGE_HELP={missing:'Le bucket privé « documents » n’existe pas encore dans Supabase : exécutez supabase/storage.sql dans le SQL Editor. Le document est gardé sur cet appareil en attendant.',
  denied:'Supabase refuse l’envoi (politiques du bucket « documents » absentes) : exécutez supabase/storage.sql. Le document est gardé sur cet appareil en attendant.',
  error:'Envoi vers Supabase impossible pour le moment : le document est gardé sur cet appareil.',local:'Synchro non configurée : le document est gardé sur cet appareil uniquement.'};
async function saveDoc(ins,file){if(file.size>MAX_DOC)throw new Error('Fichier trop lourd (10 Mo maximum).');
  const meta={name:file.name,size:file.size,mime:file.type,date:todayIso()};
  if(sbOn()){try{const path=await storageUpload(ins.id,file);if(ins.doc&&ins.doc.storage==='supabase'&&ins.doc.path!==path)storageDelete(ins.doc.path);await idbDel('doc-'+ins.id);return{...meta,path,storage:'supabase'}}
    catch(e){await idbSet('doc-'+ins.id,file);toast('Document gardé sur cet appareil');return{...meta,storage:'local',why:e.state||'error'}}}
  await idbSet('doc-'+ins.id,file);return{...meta,storage:'local',why:'local'}}
async function loadDoc(ins){if(!ins.doc)return null;if(ins.doc.storage==='supabase'&&sbOn())return storageGet(ins.doc.path);const b=await idbGet('doc-'+ins.id);if(!b)throw new Error('Document absent de cet appareil (il a été ajouté sur l’autre téléphone sans synchro du fichier).');return b}
function insDocDelete(id){const ins=D.insurances.find(x=>x.id===id);if(ins&&ins.doc&&ins.doc.storage==='supabase'&&sbOn())storageDelete(ins.doc.path);idbDel('doc-'+id);idbDel('txt-'+id)}
/* --- extraction de texte locale : pdf.js puis OCR tesseract.js (optionnel) --- */
let _pdf=null;async function pdfjs(){if(!_pdf){_pdf=await import(new URL('vendor/pdfjs/pdf.min.mjs',location.href).href);_pdf.GlobalWorkerOptions.workerSrc=new URL('vendor/pdfjs/pdf.worker.min.mjs',location.href).href}return _pdf}
async function pdfText(buf){const lib=await pdfjs(),doc=await lib.getDocument({data:buf,isEvalSupported:false}).promise;let out='';
  for(let i=1;i<=Math.min(doc.numPages,12);i++){const pg=await doc.getPage(i),tc=await pg.getTextContent();let line='',lastY=null;
    tc.items.forEach(it=>{const y=it.transform?Math.round(it.transform[5]):null;if(lastY!==null&&y!==null&&Math.abs(y-lastY)>3){out+=line.trim()+'\n';line=''}line+=(line&&!line.endsWith(' ')&&it.str&&!it.str.startsWith(' ')?' ':'')+it.str;lastY=y;if(it.hasEOL){out+=line.trim()+'\n';line='';lastY=null}});
    out+=line.trim()+'\n\n'}return{text:out.replace(/\n{3,}/g,'\n\n'),doc}}
async function pdfPagesToCanvas(doc,max=3){const C=[];for(let i=1;i<=Math.min(doc.numPages,max);i++){const pg=await doc.getPage(i),vp=pg.getViewport({scale:2}),c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;C.push(c)}return C}
function loadScript(src){return new Promise((ok,ko)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('Chargement impossible : '+src));document.head.appendChild(s)})}
async function ocr(images,progress){await loadScript('vendor/tesseract/tesseract.min.js');const abs=p=>new URL(p,location.href).href;
  const w=await Tesseract.createWorker('fra',1,{workerPath:abs('vendor/tesseract/worker.min.js'),corePath:abs('vendor/tesseract/'),langPath:abs('vendor/tesseract/lang'),gzip:true,workerBlobURL:false,
    logger:m=>{if(progress&&m.status==='recognizing text')progress(Math.round(m.progress*100))}});
  let t='';try{for(const im of images){const r=await w.recognize(im);t+=r.data.text+'\n\n'}}finally{await w.terminate()}return t}
async function extractFromFile(file,{allowOcr=false,progress}={}){const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(isPdf){const {text,doc}=await pdfText(await file.arrayBuffer());if(text.replace(/\s/g,'').length>=60||!allowOcr)return{text,scanned:text.replace(/\s/g,'').length<60};
    return{text:await ocr(await pdfPagesToCanvas(doc),progress),ocr:true}}
  if(/^image\//.test(file.type)){if(!allowOcr)return{text:'',scanned:true};return{text:await ocr([file],progress),ocr:true}}
  return{text:'',unsupported:true}}
/* --- vues --- */
const INS_FIELDS=[['type','Type'],['label','Nom'],['insurer','Assureur'],['contract','N° de contrat'],['insured','Assuré(s)'],['object','Bien / véhicule assuré'],['premium','Cotisation (€)'],['premiumFreq','Fréquence'],
  ['start','Date d’effet'],['end','Échéance'],['renewal','Renouvellement'],['franchise','Franchises'],['guarantees','Garanties principales'],['ceilings','Plafonds'],['exclusions','Exclusions notables'],['phone','Assistance / sinistre'],['notes','Notes']];
function insDueList(days=60){const t=todayIso(),lim=new Date();lim.setDate(lim.getDate()+days);const L=lim.toISOString().slice(0,10);
  return D.insurances.map(i=>({i,d:nextDue(i,t)})).filter(x=>x.d&&x.d>=t&&x.d<=L).sort((a,b)=>a.d.localeCompare(b.d))}
function insRemindCard(){const L=insDueList(45).filter(x=>!(x.i.remindDone||[]).includes(x.d));if(!L.length)return'';
  return `<div class="card remind-card"><h2>${ic('shield',18)} Échéance d’assurance</h2>${L.map(({i,d})=>{const ci=cancelInfo(i);return `<div class="ins-due"><b>${esc(i.label||insType(i.type)[1])}</b> · ${esc(i.insurer||'')}<small>Échéance le ${isoFr(d)} · ${eur(yearly(i))}/an${ci?` · ${esc(ci.txt)}`:''}</small>
   <div class="row-b"><button class="link" data-edit-ins="${i.id}">Ouvrir la fiche</button><button class="link" data-ins-ack="${i.id}|${d}">C’est noté</button></div></div>`}).join('')}</div>`}
function vAssurances(){const tot=D.insurances.reduce((s,i)=>s+yearly(i),0),t=todayIso();
  return `<div class="card hero"><small>Assurances · coût annuel</small><div class="hero-n">${money(tot)}</div><div class="hero-grid"><div><small>Par mois</small>${money(tot/12)}</div><div><small>Contrats</small><span class="num">${D.insurances.length}</span></div></div></div>
  ${sec('Contrats',addBtn('addIns'))}
  <div class="list">${[...D.insurances].sort((a,b)=>(nextDue(a,t)||'9').localeCompare(nextDue(b,t)||'9')).map(i=>{const d=nextDue(i,t),soon=d&&(new Date(d)-new Date(t))/864e5<=60,ty=insType(i.type);
    return `<button class="item" data-edit-ins="${i.id}"><span class="avatar">${ic(ty[2],16)}</span><span class="grow"><b>${esc(i.label||ty[1])}</b><small>${esc(ty[1])}${i.insurer?' · '+esc(i.insurer):''}${i.doc?' · 📎':''}</small>
     ${d?`<small class="${soon?'warn-c':''}">Échéance ${isoFr(d)}</small>`:''}${i.fixedId&&D.fixed.find(f=>f.id===i.fixedId)?`<small>Charge liée : ${esc(D.fixed.find(f=>f.id===i.fixedId).label)}</small>`:''}</span>
     <span class="r">${money(yearly(i))}<small class="mut">/an</small></span></button>`}).join('')||empty('shield','Ajoutez vos contrats (habitation, auto, mutuelle…) et leur document : l’appli en extrait un récapitulatif, sur votre téléphone.')}</div>
  <p class="disclaimer" role="note">${ic('info',14)} Récapitulatif extrait automatiquement du document, sur cet appareil (aucun envoi à un service tiers) : vérifiez et corrigez les champs. Seules les conditions de votre contrat font foi.</p>
  ${storageNote()}`}
function storageNote(){const loc=D.insurances.filter(i=>i.doc&&i.doc.storage==='local').length;if(!loc)return'';
  return `<p class="mut note">${ic('alert',14)} ${loc} document${loc>1?'s':''} gardé${loc>1?'s':''} uniquement sur cet appareil. ${sbOn()?'Pour les partager, exécutez <code>supabase/storage.sql</code> dans Supabase puis rouvrez la fiche et touchez « Envoyer vers Supabase ».':'Configurez la synchro pour les partager.'}</p>`}
const draftIns={};
function insSheet(id,pre){const i=D.insurances.find(x=>x.id===id)||Object.assign({id:uid(),type:'habitation',premiumFreq:'an'},pre||{}),isNew=!D.insurances.find(x=>x.id===i.id);draftIns[i.id]=i;
  const v=k=>esc(i[k]??''),ci=cancelInfo(i),d=nextDue(i);
  const area=(k,l)=>`<label>${l}<textarea name="${k}" rows="${Math.min(6,Math.max(2,String(i[k]||'').split('\n').length))}">${v(k)}</textarea></label>`;
  openSheet(isNew?'Nouvelle assurance':'Assurance',`
   <div class="ins-doc">${i.doc?`<p>${ic('link',14)} <b>${esc(i.doc.name)}</b> <small class="mut">${Math.round(i.doc.size/1024)} Ko · ${i.doc.storage==='supabase'?'Supabase (privé)':'cet appareil uniquement'}</small></p>
    <div class="f2"><button type="button" class="btn ghost" id="insOpen">Ouvrir le document</button><button type="button" class="btn ghost" id="insReread">Relire le document</button></div>
    ${i.doc.storage==='local'&&sbOn()?`<button type="button" class="btn ghost wide" id="insPush">Envoyer vers Supabase</button>${i.doc.why&&STORAGE_HELP[i.doc.why]?`<p class="mut">${STORAGE_HELP[i.doc.why]}</p>`:''}`:''}`:''}
    <label class="file-l">${i.doc?'Remplacer le document':'Ajouter le document (PDF ou photo)'}<input type="file" id="insFile" accept="application/pdf,image/*"></label>
    <label class="check"><input type="checkbox" id="insOcr"> Reconnaissance de texte (OCR) pour les photos et scans <small class="mut">— plus lent, fait sur le téléphone</small></label>
    <p id="insStatus" class="mut" role="status" aria-live="polite"></p><div id="insPreview"></div></div>
   <form id="fIns" novalidate>
    <div class="f2"><label>Type<select name="type">${INS_TYPES.map(([k,l])=>`<option value="${k}" ${i.type===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Nom<input name="label" value="${v('label')}" placeholder="ex. Habitation appartement"></label></div>
    <div class="f2"><label>Assureur<input name="insurer" value="${v('insurer')}"></label><label>N° de contrat<input name="contract" value="${v('contract')}"></label></div>
    <label>Assuré(s)<input name="insured" value="${v('insured')}"></label><label>Bien / véhicule assuré<input name="object" value="${v('object')}"></label>
    <div class="f2"><label>Cotisation (€)<input name="premium" inputmode="decimal" value="${i.premium??''}"></label><label>Fréquence<select name="premiumFreq">${[['mois','par mois'],['trimestre','par trimestre'],['an','par an']].map(([k,l])=>`<option value="${k}" ${i.premiumFreq===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
    <div class="f2"><label>Date d’effet<input name="start" type="date" value="${i.start&&!i.start.startsWith('--')?i.start:''}"></label><label>Échéance<input name="end" value="${i.end?isoFr(i.end):''}" placeholder="jj/mm ou jj/mm/aaaa"></label></div>
    <label class="check"><input type="checkbox" name="tacit" ${i.tacit?'checked':''}> Renouvelé par tacite reconduction</label>
    ${area('guarantees','Garanties principales')}${area('franchise','Franchises')}${area('ceilings','Plafonds')}${area('exclusions','Exclusions notables')}
    <label>Téléphone assistance / sinistre<input name="phone" type="tel" value="${v('phone')}"></label>${i.phone?`<a class="btn ghost wide" href="tel:${esc(String(i.phone).replace(/\s/g,''))}">Appeler l’assistance</a>`:''}
    <label>Charge correspondante<select name="fixedId"><option value="">— Aucune —</option>${[...D.fixed].sort((a,b)=>(b.category==='assurance')-(a.category==='assurance')).map(f=>`<option value="${f.id}" ${i.fixedId===f.id?'selected':''}>${esc(f.label)} · ${eur(f.amount)}/mois</option>`).join('')}<option value="__new">+ Créer la charge mensuelle</option></select></label>
    ${area('notes','Notes')}
    ${ci||d?`<div class="preview">${d?`<small>Prochaine échéance</small><b>${isoFr(d)}</b>`:''}${ci?`<small>${esc(ci.txt)}</small>`:''}<small><a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F19083" target="_blank" rel="noopener">Règles de résiliation (service-public.gouv.fr)</a></small></div>`:''}
    <p id="insErr" class="neg" role="alert"></p><button class="btn">Enregistrer</button>${!isNew?`<button type="button" class="btn danger" data-del="insurances|${i.id}">${ic('trash',16)} Supprimer</button>`:''}</form>`,()=>bindIns(i,isNew))}
function fillIns(o){const f=$('#fIns');if(!f)return 0;let n=0;Object.entries(o).forEach(([k,v])=>{const el=f.elements[k];if(!el||v==null||v==='')return;
  if(el.type==='checkbox'){el.checked=!!v;n++;return}if(k==='end'||k==='renewal'){el.value=isoFr(v)}else el.value=v;n++;el.classList.add('filled')});if(o.renewal&&!o.end&&f.elements.end){f.elements.end.value=isoFr(o.renewal)}
  if(o.type&&!f.elements.label.value)f.elements.label.value=insType(o.type)[1]+(o.insurer?' '+o.insurer:'');return n}
function bindIns(i,isNew){const st=$('#insStatus');let pendingFile=null;
  const analyse=async(file)=>{st.textContent='Lecture du document…';try{const r=await extractFromFile(file,{allowOcr:$('#insOcr').checked,progress:p=>st.textContent=`Reconnaissance du texte… ${p} %`});
    if(r.unsupported){st.textContent='Format non pris en charge (PDF ou image).';return}
    if(!r.text.trim()){st.textContent=r.scanned?'Aucun texte lisible (document scanné ou photo) : cochez « Reconnaissance de texte (OCR) » : la lecture se relance aussitôt.':'Aucun texte trouvé.';return}
    idbSet('txt-'+i.id,r.text);const o=insuranceExtract(r.text),n=fillIns(o);st.textContent=n?`${n} information${n>1?'s':''} trouvée${n>1?'s':''}${r.ocr?' (OCR)':''} : vérifiez et corrigez avant d’enregistrer.`:'Texte lu mais aucune information reconnue : complétez la fiche à la main.'}
   catch(e){st.textContent='Lecture impossible : '+(e&&e.message||e)}};
  on('#insFile','change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>MAX_DOC){st.textContent='Fichier trop lourd (10 Mo maximum).';return}pendingFile=file;
    if(/^image\//.test(file.type)){const u=URL.createObjectURL(file);$('#insPreview').innerHTML=`<img src="${u}" alt="Aperçu du document" class="doc-img">`}await analyse(file)});
  on('#insOcr','change',e=>{if(e.target.checked&&pendingFile)analyse(pendingFile)});
  on('#insReread','click',async()=>{st.textContent='Chargement du document…';try{const b=pendingFile||await loadDoc(i);await analyse(new File([b],i.doc?.name||'document',{type:b.type||i.doc?.mime}))}catch(e){st.textContent=e.message}});
  on('#insOpen','click',async()=>{st.textContent='Ouverture…';try{const b=await loadDoc(i),u=URL.createObjectURL(b);
    if(/^image\//.test(b.type||i.doc.mime))$('#insPreview').innerHTML=`<img src="${u}" alt="Document ${esc(i.doc.name)}" class="doc-img">`;
    else{$('#insPreview').innerHTML=`<canvas class="doc-img" aria-label="Première page du document"></canvas><a class="btn ghost wide" href="${u}" download="${esc(i.doc.name)}">Télécharger le PDF</a>`;try{const lib=await pdfjs(),doc=await lib.getDocument({data:await b.arrayBuffer(),isEvalSupported:false}).promise,c=(await pdfPagesToCanvas(doc,1))[0],dst=$('#insPreview canvas');dst.width=c.width;dst.height=c.height;dst.getContext('2d').drawImage(c,0,0)}catch{}}
    st.textContent=''}catch(e){st.textContent='Ouverture impossible : '+e.message}});
  on('#insPush','click',async()=>{st.textContent='Envoi…';try{const b=await loadDoc(i);const doc=await saveDoc(i,new File([b],i.doc.name,{type:i.doc.mime}));i.doc=doc;save();insSheet(i.id);toast(doc.storage==='supabase'?'Document envoyé':'Envoi impossible')}catch(e){st.textContent=e.message}});
  $('#fIns').addEventListener('submit',async e=>{e.preventDefault();const v=fd(e.target),err=$('#insErr');err.textContent='';
    const pr=String(v.premium).trim(),premium=pr===''?null:parseFloat(pr.replace(/\s/g,'').replace(',','.'));if(pr!==''&&!(premium>=0)){err.textContent='Cotisation invalide.';return}
    let end='';if(v.end.trim()){end=frDateToIso(v.end.trim());if(!end){err.textContent='Échéance : format jj/mm ou jj/mm/aaaa.';return}}
    const o={type:v.type,label:v.label.trim()||insType(v.type)[1],insurer:v.insurer.trim(),contract:v.contract.trim(),insured:v.insured.trim(),object:v.object.trim(),premium:premium==null?null:r2(premium),premiumFreq:v.premiumFreq,
      start:v.start||'',end,tacit:!!v.tacit,guarantees:v.guarantees.trim(),franchise:v.franchise.trim(),ceilings:v.ceilings.trim(),exclusions:v.exclusions.trim(),phone:v.phone.trim(),notes:v.notes.trim()};
    if(v.fixedId==='__new'){const f={id:uid(),label:'Assurance '+o.label,amount:r2((yearly(o)||0)/12),day:5,split:D.ratio,category:'assurance',paidBy:'joint',account:accOfOwner(D,'joint')||D.accounts[0]?.id||null};D.fixed.push(f);o.fixedId=f.id}else o.fixedId=v.fixedId||null;
    if(pendingFile){const sb=e.submitter||$('#fIns button:not([type])');if(sb)sb.disabled=true;st.textContent='Envoi du document…';try{o.doc=await saveDoc(i,pendingFile)}catch(x){err.textContent=x.message;if(sb)sb.disabled=false;return}}
    Object.assign(i,o);if(isNew)D.insurances.push(i);delete draftIns[i.id];closeSheet();save();toast(o.doc&&o.doc.storage==='local'&&o.doc.why!=='local'?'Enregistré (document gardé sur cet appareil)':'Assurance enregistrée')})}
document.addEventListener('click',e=>{const t=e.target.closest('[data-edit-ins]');if(t)return insSheet(t.dataset.editIns);if(e.target.closest('#addIns'))return insSheet();
  const a=e.target.closest('[data-ins-ack]');if(a){const [id,d]=a.dataset.insAck.split('|'),i=D.insurances.find(x=>x.id===id);if(i){i.remindDone=[...(i.remindDone||[]),d].slice(-5);save();toast('Rappel masqué')}}});
