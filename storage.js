'use strict';
/* ---------- Espace utilisé : document JSON, localStorage, documents Storage ; secours IndexedDB si le quota local est atteint ---------- */
const LS_CHARS=5*1024*1024;            // ~5 M caractères par origine (Chrome, Safari, Firefox)
const SB_DB=500*1024*1024,SB_FILES=1024*1024*1024; // plan gratuit Supabase
const fmtSize=b=>b<1024?b+' o':b<1048576?(b/1024).toFixed(0)+' Ko':(b/1048576).toFixed(b<10485760?2:1).replace('.',',')+' Mo';
function spaceUsage(){const json=JSON.stringify(D),docBytes=json.length;let ls=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);ls+=k.length+(localStorage.getItem(k)||'').length}}catch{}
  const files=(D.insurances||[]).filter(i=>i.doc).reduce((s,i)=>s+(+i.doc.size||0),0),sbFiles=(D.insurances||[]).filter(i=>i.doc&&i.doc.storage==='supabase').reduce((s,i)=>s+(+i.doc.size||0),0);
  const counts={dépenses:D.misc.length,historique:(D.history||[]).length,suppressions:Object.keys(D.deleted||{}).length,relevés:(D.imports||[]).length};
  return{docBytes,lsChars:ls,lsPct:Math.max(ls,docBytes)/LS_CHARS*100,files,sbFiles,dbPct:docBytes/SB_DB*100,filePct:sbFiles/SB_FILES*100,counts,idb:!!localStorage.getItem(KEY+'-idb')}}
function spaceCard(){const u=spaceUsage(),lvl=p=>p>=80?'over':p>=50?'warn':'';
  return `<div class="card" id="spaceCard"><h2>Espace utilisé</h2>
   <div class="space-row"><div class="row-b"><span>Stockage local (ce téléphone)</span><b>${Math.min(999,Math.round(u.lsPct))} %</b></div>${bar(Math.min(100,u.lsPct),lvl(u.lsPct))}<small class="mut">${(Math.max(u.lsChars,u.docBytes)/1e6).toFixed(2).replace('.',',')} M caractères sur ≈ 5,2 M autorisés par le navigateur${u.idb?` · le document (${fmtSize(u.docBytes)}) dépasse la limite : copie de secours dans IndexedDB active`:''}</small></div>
   <div class="space-row"><div class="row-b"><span>Base Supabase (document partagé)</span><b>${fmtSize(u.docBytes)}</b></div>${bar(Math.max(.5,Math.min(100,u.dbPct)),lvl(u.dbPct))}<small class="mut">${u.dbPct<0.1?'< 0,1':u.dbPct.toFixed(1).replace('.',',')} % des 500 Mo du plan gratuit</small></div>
   <div class="space-row"><div class="row-b"><span>Documents d’assurance (Storage)</span><b>${fmtSize(u.sbFiles)}</b></div>${bar(Math.max(.5,Math.min(100,u.filePct)),lvl(u.filePct))}<small class="mut">${u.filePct<0.1?'< 0,1':u.filePct.toFixed(1).replace('.',',')} % de 1 Go${u.files>u.sbFiles?` · ${fmtSize(u.files-u.sbFiles)} gardés sur cet appareil`:''}</small></div>
   <p class="mut">${Object.entries(u.counts).map(([k,v])=>`${v} ${k}`).join(' · ')}. L’historique est limité aux 500 dernières actions.</p>
   ${u.lsPct>=70||u.idb?`<p class="warn-t">${ic('alert',14)} Le stockage local approche de sa limite : l’appli bascule automatiquement sur IndexedDB si besoin (aucune donnée n’est supprimée).</p>`:''}</div>`}
/* Secours IndexedDB : ne jamais perdre une sauvegarde trop grosse pour localStorage */
let _idbWarned=false,_idbReady=null,_lastOk=0;
function persistSafe(json){try{localStorage.setItem(KEY,json);_lastOk=Date.now();if(localStorage.getItem(KEY+'-idb'))localStorage.removeItem(KEY+'-idb');return true}
  catch(e){const ts=String(Date.now()),upd=D.updated||0;idbSet('data-full',{ts,json,updated:upd}).then(()=>{if(_lastOk>+ts)return;try{localStorage.setItem(KEY+'-idb',ts)}catch{}}).catch(()=>{});
    if(!_idbWarned){_idbWarned=true;setTimeout(()=>typeof toast==='function'&&toast('Stockage local plein : données enregistrées dans IndexedDB'),0)}return false}}
function restoreFromIdb(){if(_idbReady)return _idbReady;return _idbReady=(async()=>{try{const r=await idbGet('data-full');if(!r||!r.json)return;
  const d=migrate(JSON.parse(r.json)),loc=JSON.stringify(D).length;if((d.updated||0)<(D.updated||0)||((d.updated||0)===(D.updated||0)&&r.json.length<=loc))return;
  adoptLocal(d);try{localStorage.setItem(KEY+'-idb',r.ts||'1')}catch{};try{localStorage.setItem(KEY,r.json);localStorage.removeItem(KEY+'-idb')}catch{}}catch{}})()}
