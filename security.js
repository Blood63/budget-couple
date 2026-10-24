'use strict';
/* ---------- Sécurité de l'espace : état, code fort, changement de code, invitation « code seul » ---------- */
const OLD_SPACE='budget-couple-old-space'; // ancien code conservé sur CET appareil après un changement (pour pouvoir le vider plus tard)
const CODE_ABC='abcdefghijkmnpqrstuvwxyz23456789'; // 32 symboles sans l/o/0/1 : 26 symboles = 130 bits
function genSpaceCode(){const b=crypto.getRandomValues(new Uint8Array(26));const c=[...b].map(x=>CODE_ABC[x&31]).join('');return 'bc-'+c.match(/.{1,5}/g).slice(0,4).join('-')+'-'+c.slice(20)}
/* Robustesse indicative du code d'espace (aucun envoi : calcul local) */
function codeStrength(code){code=String(code||'');if(/^bc-([a-z2-9]{5}-){4}[a-z2-9]{6}$/.test(code))return{lvl:'fort',txt:'Fort (aléatoire, 130 bits)'};
  const low=code.toLowerCase(),names=[D.names?.p1,D.names?.p2].filter(n=>n&&!/^personne \d$/i.test(n)).map(n=>n.toLowerCase());
  const guessable=names.some(n=>low.includes(n))||/(19|20)\d{2}|\d{4}$/.test(code)||/(code|key|cle|budget|couple|password|motdepasse)/i.test(code);
  const classes=[/[a-z]/,/[A-Z]/,/\d/,/[^A-Za-z0-9]/].filter(r=>r.test(code)).length,bits=Math.round(code.length*Math.log2([0,26,52,62,80][classes]||26));
  if(guessable||code.length<16)return{lvl:'faible',txt:'Faible : devinable (prénoms, date ou mot courant)'};
  return bits>=100?{lvl:'moyen',txt:'Correct, mais un code aléatoire est préférable'}:{lvl:'faible',txt:'Faible : trop court'}}
const secLabel=()=>secureMode===true?'<b class="pos">Oui</b>':secureMode===false?'<b class="neg">Non</b> : exécutez supabase/secure.sql':'<span class="mut">vérification à la prochaine synchro…</span>';
function securityCard(){if(!sbOn())return'';const st=codeStrength(cfg.space),old=localStorage.getItem(OLD_SPACE);
  return `<div class="card" id="securityCard"><h2>${ic('shield',18)} Sécurité de l’espace</h2>
   <p>Sécurité renforcée : <span id="secState">${secLabel()}</span></p>
   <p>Code d’espace : <b class="${st.lvl==='fort'?'pos':st.lvl==='faible'?'neg':'warn-t'}">${esc(st.txt)}</b></p>
   <p class="mut">La clé publishable est publique par nature (elle est dans l’appli). Avec la sécurité renforcée, personne ne peut lister les espaces ni les documents : <b>tout repose sur le secret du code d’espace</b>. Un code aléatoire long rend les essais impossibles en pratique.</p>
   ${spaceMoved?`<p class="neg">${esc(MOVED_MSG)}</p>`:''}
   <button type="button" class="btn ghost" id="changeCode" ${secureMode===true&&!spaceMoved?'':'disabled'}>${ic('repeat',16)} Changer le code d’espace</button>
   ${secureMode!==true?'<p class="mut">Disponible une fois supabase/secure.sql installé (sinon un nouveau code resterait listable).</p>':''}
   ${old?`<div class="invite" style="margin-top:10px"><b>Ancien code encore actif</b><p class="mut" style="margin:0">Vos données sont toujours lisibles avec l’ancien code. Quand votre partenaire a rejoint le nouveau code, videz l’ancien espace (vos données restent intactes dans le nouveau).</p>
     <button type="button" class="btn danger" id="clearOld">Vider l’ancien espace</button></div>`:''}</div>`}
function refreshSecurity(){const s=$('#secState');if(s&&s.dataset.v!==String(secureMode)){s.dataset.v=String(secureMode);if($('#securityCard')&&!document.querySelector('#sheet.open')&&!document.activeElement?.closest?.('form'))$('#securityCard').outerHTML=securityCard()}}
/* Changement de code : tout est COPIÉ vers le nouveau code (données + documents) ; l'ancien espace n'est pas effacé, seulement marqué « déplacé » */
async function changeSpaceCode(){
  if(secureMode!==true)return alert('Installez d’abord supabase/secure.sql.');
  if(!confirm('Créer un nouveau code d’espace aléatoire et y copier toutes les données et documents ?\n\nL’ancien espace n’est pas effacé. Votre partenaire devra saisir le nouveau code (Inviter › Code seul).'))return;
  const btn=$('#changeCode');if(btn){btn.disabled=true;btn.textContent='Copie en cours…'}
  const fail=m=>{alert('Changement annulé, rien n’a été modifié : '+m);render()};
  try{
    await pullRemote();if(spaceMoved||!/Synchronisé/.test(lastErr))return fail('synchronisez d’abord (connexion ?).');
    const oldCode=cfg.space,nw=genSpaceCode();
    if(await remote.get(nw))return fail('code déjà pris, réessayez.');
    // 1) documents : copie vers le dossier du nouveau code (les anciens fichiers restent en place)
    const moves=[];
    for(const ins of D.insurances.filter(i=>i.doc&&i.doc.storage==='supabase')){
      const blob=await storageGet(ins.doc.path),file=new File([blob],ins.doc.name||'document',{type:ins.doc.mime||blob.type});
      moves.push([ins.id,await storageUpload(ins.id,file,nw)])}
    // 2) données : nouvel espace créé avec l'état complet
    const copy=JSON.parse(JSON.stringify(D));moves.forEach(([id,path])=>{const i=copy.insurances.find(x=>x.id===id);i.doc.path=path});
    const w=await remote.save(copy,null,nw);if(!w.ok)return fail('création du nouvel espace refusée.');
    const back=await remote.get(nw);if(!back||canon(migrate(back.data))!==canon(migrate(copy)))return fail('vérification de la copie échouée.');
    // 3) l'appareil passe sur le nouveau code (fusion normale : les chemins de documents sont horodatés comme une modification)
    cfg={...cfg,space:nw};localStorage.setItem(CFG,JSON.stringify(cfg));localStorage.setItem(OLD_SPACE,oldCode);resetSync();
    moves.forEach(([id,path])=>{const i=D.insurances.find(x=>x.id===id);if(i)i.doc={...i.doc,path}});save();await pullRemote();
    // 4) ancien espace marqué « déplacé » (sans révéler le nouveau code) : l'autre appareil cesse d'y écrire
    for(let k=0;k<4;k++){const o=await remote.get(oldCode);if(!o)break;const r=await remote.save({...o.data,moved:{at:Date.now(),by:me||null}},o.updated_at,oldCode);if(r.ok)break}
    render();go('reglages');setTimeout(()=>{showInvite('code');$('#invitePanel')?.scrollIntoView({block:'center'})},50);toast('Nouveau code actif ✓');
  }catch(e){fail(netErr(e))}}
/* Vider l'ancien espace : seulement si TOUT son contenu est présent (ou supprimé volontairement) dans l'espace actuel */
async function clearOldSpace(){const oldCode=localStorage.getItem(OLD_SPACE);if(!oldCode)return;
  try{await pullRemote();const o=await remote.get(oldCode);if(!o||o.data?.emptied){localStorage.removeItem(OLD_SPACE);toast('Ancien espace déjà vide');return render()}
    const old=migrate(o.data),missing=LISTS.reduce((n,l)=>n+(old[l]||[]).filter(x=>!D[l].some(y=>y.id===x.id)&&!D.deleted[x.id]).length,0);
    if(missing)return alert(`${missing} élément(s) de l’ancien espace ne sont pas dans le nouveau : synchronisez l’autre appareil sur le nouveau code avant de vider.`);
    if(!confirm('Vider l’ancien espace ? Ses données sont toutes présentes dans le nouveau code ; l’ancien ne contiendra plus qu’un marqueur « déplacé ».'))return;
    const r=await remote.save({version:DATA_VERSION,moved:o.data.moved||{at:Date.now(),by:me||null},emptied:true},o.updated_at,oldCode);
    if(!r.ok)return alert('L’ancien espace vient d’être modifié : réessayez.');localStorage.removeItem(OLD_SPACE);toast('Ancien espace vidé ✓');render()}
  catch(e){alert(netErr(e))}}
/* Invitation : lien complet (URL + clé + code) ou code seul (pour un appareil déjà configuré) */
let inviteMode='link';
function showInvite(mode){if(mode)inviteMode=mode;const P=$('#invitePanel');if(!sbOn()){P.innerHTML='<p class="neg">Configurez et enregistrez d’abord la synchro.</p>';return}
  const full=inviteMode==='link',L=full?inviteLink():cfg.space,qr=qrcode(0,'M');qr.addData(full?L:APP_URL+'#join='+encodeURIComponent(cfg.space));qr.make();
  P.innerHTML=`<div class="invite"><b>Inviter dans l’espace</b>
   <div class="seg inv-seg" role="tablist" aria-label="Type d’invitation"><button type="button" role="tab" aria-selected="${full}" class="${full?'on':''}" data-inv="link">Lien complet</button><button type="button" role="tab" aria-selected="${!full}" class="${!full?'on':''}" data-inv="code">Code seul</button></div>
   <p class="mut" style="margin:0">${full?'Pour un appareil neuf : contient l’adresse du projet, la clé publishable (publique) et le code d’espace.':'Pour un appareil déjà configuré (même projet) : seul le code est transmis ; l’autre appareil le saisit dans « Code d’espace » ou scanne ce QR.'}</p>
   <p class="warn-t" style="margin:0">${ic('alert',14)} La clé est publique ; <b>le code d’espace est le vrai secret</b> : ${full?'ce lien':'ce code'} donne accès à toutes vos données. Ne l’envoyez qu’à votre partenaire, par un canal privé.</p>
   <div style="background:#fff;padding:10px;border-radius:10px;justify-self:center">${qr.createSvgTag({cellSize:4,margin:0,scalable:true}).replace('<svg ','<svg role="img" aria-label="QR code d’invitation" style="width:220px;height:220px;display:block" ')}</div>
   <input id="inviteLink" type="password" readonly autocomplete="off" value="${esc(L)}" aria-label="${full?'Lien d’invitation':'Code d’espace'} (masqué)">
   <div class="f2"><button type="button" class="btn" id="copyInv">${ic('copy',16)} Copier</button>${navigator.share?`<button type="button" class="btn ghost" id="shareInv">${ic('share',16)} Partager</button>`:'<button type="button" class="btn ghost" id="showInv">Afficher</button>'}</div></div>`;
  P.querySelectorAll('[data-inv]').forEach(b=>b.onclick=()=>showInvite(b.dataset.inv));
  on('#copyInv','click',async()=>{try{await navigator.clipboard.writeText(L)}catch{const i=$('#inviteLink');i.type='text';i.select();document.execCommand('copy');i.type='password'}$('#copyInv').textContent='Copié ✓'});
  on('#showInv','click',()=>{const i=$('#inviteLink');i.type=i.type==='password'?'text':'password'});
  on('#shareInv','click',()=>navigator.share(full?{title:'Budget Couple',text:'Rejoins notre espace Budget Couple :',url:L}:{title:'Budget Couple',text:'Code d’espace Budget Couple : '+L}).catch(()=>{}));
}
/* ---------- Affichage : thème (propre à cet appareil, jamais synchronisé) et portrait sur téléphone ---------- */
const THEME_KEY='budget-couple-theme';
const themePref=()=>{const t=localStorage.getItem(THEME_KEY);return t==='light'||t==='dark'?t:'auto'};
function applyTheme(){const t=themePref(),root=document.documentElement;if(t==='auto')delete root.dataset.theme;else root.dataset.theme=t;
  const light=t==='light'||(t==='auto'&&matchMedia('(prefers-color-scheme: light)').matches),mc=document.querySelector('meta[name=theme-color]');if(mc)mc.content=light?'#f3f5fa':'#0b0e14'}
function displayCard(){const t=themePref(),o=[['auto','Automatique'],['light','Clair'],['dark','Sombre']];
  return `<div class="card"><h2>${ic('edit',18)} Affichage</h2><fieldset class="seg seg-sm" style="border:0;padding:4px"><legend class="mut" style="padding:0 0 6px">Thème de cet appareil</legend>
   ${o.map(([v,l])=>`<label><input type="radio" name="theme" value="${v}" ${t===v?'checked':''}><span>${l}</span></label>`).join('')}</fieldset>
   <p class="mut">« Automatique » suit le réglage clair/sombre du téléphone. Sur téléphone, l’appli installée reste en portrait ; sur tablette et ordinateur, elle suit l’orientation de l’écran.</p></div>`}
document.addEventListener('change',e=>{if(e.target.name==='theme'){const v=e.target.value;if(v==='auto')localStorage.removeItem(THEME_KEY);else localStorage.setItem(THEME_KEY,v);applyTheme()}});
try{matchMedia('(prefers-color-scheme: light)').addEventListener('change',applyTheme)}catch{}
applyTheme();
/* Portrait uniquement sur téléphone (plus petit côté < 600 px), seulement là où le navigateur l'autorise (appli installée Android) */
(function lockPhonePortrait(){try{const phone=Math.min(screen.width,screen.height)<600,standalone=matchMedia('(display-mode: standalone)').matches;
  if(phone&&standalone&&screen.orientation&&screen.orientation.lock)screen.orientation.lock('portrait').catch(()=>{})}catch{}})();
