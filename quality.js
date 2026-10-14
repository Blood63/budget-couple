'use strict';
/* ---------- Indicateur de qualité : affichage (repères dans market.json, calculs dans finance.js) ---------- */
let MARKET=null;
fetch('market.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{if(j){MARKET=j;if(!document.querySelector('#sheet.open'))render()}}).catch(()=>{});
const qDate=()=>MARKET?new Date(MARKET.updated+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'';
const qBadge=(q,small)=>q&&q.grade?`<span class="qbadge q-${q.grade}${small?' sm':''}" aria-label="Note indicative ${q.grade}, ${q.score} sur 100">${q.grade}</span>`:'';
const qNotice=()=>`<p class="disclaimer">${ic('info',14)} <b>Indicatif, pas un conseil.</b> Comparaison à des repères de marché publics (mis à jour le ${qDate()}) ; vérifiez auprès de votre banque, assureur ou conseiller. Aucun produit n’est recommandé.</p>`;
const qSources=L=>L&&L.length?`<details class="qsrc"><summary>Sources des repères</summary><ul>${L.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> (${esc(s.date)}) : ${esc(s.figure)}</li>`).join('')}</ul></details>`:'';
function qualityHtml(q,title,sources){if(!q)return'';
  return `<div class="qcard"><div class="row-b"><h3 class="group">${esc(title)}</h3>${q.grade?`<span class="qhead">${qBadge(q)}<b>${q.score}/100</b></span>`:'<span class="mut">à compléter</span>'}</div>
   ${q.coverage<100?`<p class="mut">Évalué sur ${q.coverage} % des critères : complétez la fiche pour une note plus fiable.</p>`:''}
   <ul class="qcrit">${q.criteria.map(c=>`<li><div class="row-b"><span>${esc(c.label)}</span><b>${c.score==null?'—':c.score+'/100'}</b></div>
    ${c.score!=null?`<div class="bar ${c.score<50?'over':''}" role="progressbar" aria-label="${esc(c.label)}" aria-valuenow="${c.score}" aria-valuemin="0" aria-valuemax="100"><i style="width:${c.score}%"></i></div>`:''}
    <small>${esc(c.value)}${c.ref?' · repère : '+esc(c.ref):''}</small>${c.tip?`<small class="warn-t">${esc(c.tip)}</small>`:''}
    ${c.missing&&c.missing.length?`<small class="neg">Garanties importantes non trouvées : ${c.missing.map(esc).join(', ')}</small>`:''}</li>`).join('')}</ul>
   ${qNotice()}${qSources(sources)}</div>`}
/* --- assurances --- */
const insCtx=i=>{const who=i.holder||'p1';return{age:typeof ageOf==='function'?ageOf(who):null}};
const insQ=i=>MARKET?insQuality(i,MARKET,insCtx(i)):null;
function insExtraFields(i){if(!MARKET)return'';const R=MARKET.insurance[i.type];if(!R)return'';const P=Object.entries(R.profiles);
  return `${P.length>1?`<label>Profil (pour les repères)<select name="profile">${P.map(([k,p])=>`<option value="${k}" ${i.profile===k?'selected':''}>${esc(p.label)}</option>`).join('')}</select></label>`:''}
   ${R.perPerson?`<div class="f2"><label>Personnes couvertes<input name="persons" type="number" min="1" max="10" value="${i.persons||1}"></label><label>Assuré principal (âge)<select name="holder">${['p1','p2'].map(k=>`<option value="${k}" ${(i.holder||'p1')===k?'selected':''}>${esc(N(k))}${ageOf(k)!=null?' · '+ageOf(k)+' ans':''}</option>`).join('')}</select></label></div>`:''}`}
function insQualityBlock(i){if(!MARKET)return'';const R=MARKET.insurance[i.type];if(!R)return `<p class="mut">Pas de repère de marché pour ce type de contrat.</p>`;return qualityHtml(insQ(i),'Qualité indicative',R.sources)}
/* --- contrats d'épargne --- */
const CT_TYPES=['av','per','pea','cto'];
const ctFields=t=>t==='av'||t==='per'?[['name','Nom du contrat','text'],['insurer','Assureur','text'],['broker','Courtier / distributeur','text'],['entryFee','Frais sur versement (%)','pct'],['ucFee','Frais de gestion UC (%/an)','pct'],['euroFee','Frais de gestion fonds euros (%/an)','pct'],['arbFee','Frais d’arbitrage (%)','pct'],['euroYield','Rendement net du fonds euros N-1 (%)','pct'],['supports','Nombre de supports','int'],['pilotFee','Frais de gestion pilotée (%/an)','pct'],['minInit','Versement minimum (€)','int']]
 :[['name','Nom du contrat','text'],['broker','Courtier / banque','text'],['orderPct','Courtage (% par ordre)','pct'],['orderMin','Courtage minimum (€ par ordre)','pct'],['custodyPct','Droits de garde (%/an)','pct'],['custodyLine','Droits de garde par ligne (€/an)','pct'],['accountFee','Frais de tenue de compte (€/an)','pct']];
const ctQ=p=>MARKET&&p.contract?contractQuality(p.contract,p.type,MARKET):null;
const euroShareOf=p=>{if(p.type!=='av'&&p.type!=='per')return 0;const v=placValue(p);return v&&typeof euroAmount==='function'&&+p.euroValue>0?Math.min(1,euroAmount(p)/v):0.5};
function contractBlock(p){if(!MARKET||!CT_TYPES.includes(p.type))return'';const c=p.contract||{},K=MARKET.contracts.filter(x=>x.type===p.type),q=ctQ(p),S=MARKET.savings[p.type];
  const cap=placValue(p)||10000,fc=feeCost10(c,p.type,MARKET,{capital:cap,monthly:+p.monthly||0,euroShare:euroShareOf(p)});
  const val=k=>c[k]==null?'':String(c[k]).replace('.',',');
  return `<div class="sec"><h2>Fiche contrat & qualité</h2></div>
   <form id="fContract" class="valform">${K.length?`<label>Contrat connu (préremplit les frais publics)<select id="ctKnown"><option value="">— Saisie manuelle —</option>${K.map(x=>`<option value="${x.id}" ${c.known===x.id?'selected':''}>${esc(x.name)} · ${esc(x.channel)}</option>`).join('')}</select></label>
    <p class="mut">Choisissez votre propre contrat s’il figure dans la liste : les valeurs publiques (source et date indiquées) sont préremplies et restent modifiables.</p>`:''}
    <div class="f2">${ctFields(p.type).map(([k,l,t])=>`<label>${l}<input name="${k}" ${t==='text'?'':'inputmode="decimal"'} value="${t==='text'?esc(c[k]||''):val(k)}"></label>`).join('')}</div>
    ${p.type==='av'||p.type==='per'?`<label class="check"><input type="checkbox" name="etf" ${c.etf?'checked':''}> ETF disponibles</label><label class="check"><input type="checkbox" name="pilot" ${c.pilot?'checked':''}> Gestion pilotée disponible</label>`:''}
    ${c.known?`<p class="mut">Préremplissage : ${esc((K.find(x=>x.id===c.known)||{}).name||'')} — <a href="${esc((K.find(x=>x.id===c.known)||{}).source||'#')}" target="_blank" rel="noopener">source</a> (${esc((K.find(x=>x.id===c.known)||{}).date||'')}).</p>`:''}
    <button class="btn ghost">Enregistrer la fiche contrat</button></form>
   ${p.contract?qualityHtml(q,'Qualité indicative des frais',S.sources):'<p class="mut">Renseignez les frais de votre contrat (voir vos conditions générales ou votre relevé annuel) pour obtenir une note indicative.</p>'}
   ${fc&&p.contract?`<div class="qcard"><h3 class="group">Coût estimé des frais sur 10 ans</h3><p class="mut">Hypothèses : ${eur(cap)} aujourd’hui${p.monthly?` + ${eur(p.monthly)}/mois`:''}, même rendement brut de 3 %/an pour tous ; seul l’effet des frais diffère${p.type==='av'||p.type==='per'?' (frais des supports non inclus)':''}.</p>
    <ul class="bal-l"><li><span>Votre contrat</span><b>${eur(fc.own.gap)}</b></li><li><span>Repère : moyenne du marché</span><b>${eur(fc.market.gap)}</b></li><li><span>Repère : contrats en ligne à frais réduits</span><b>${eur(fc.online.gap)}</b></li><li><span>Repère : contrats bancaires classiques</span><b>${eur(fc.bank.gap)}</b></li></ul>
    <p class="mut">Manque à gagner dû aux frais après 10 ans, par rapport à un placement sans frais. ${fc.own.gap>fc.market.gap*1.15?'Vos frais semblent supérieurs à la moyenne : renseignez-vous auprès de votre établissement.':fc.own.gap<=fc.market.gap?'Vos frais semblent inférieurs ou égaux à la moyenne du marché.':''}</p></div>`:''}`}
function bindContract(id){const p=D.placements.find(x=>x.id===id);if(!p)return;
  $('#ctKnown')?.addEventListener('change',e=>{const k=MARKET.contracts.find(x=>x.id===e.target.value),F=$('#fContract');if(!k)return;
    ctFields(p.type).forEach(([f,,t])=>{const el=F.elements[f];if(el&&k[f]!=null)el.value=t==='text'?k[f]:String(k[f]).replace('.',',')});
    if(F.elements.etf)F.elements.etf.checked=!!k.etf;if(F.elements.pilot)F.elements.pilot.checked=!!k.pilot;toast('Frais publics préremplis : vérifiez-les')});
  $('#fContract').addEventListener('submit',e=>{e.preventDefault();const v=fd(e.target),c={};ctFields(p.type).forEach(([k,,t])=>{const s=String(v[k]??'').trim();if(t==='text')c[k]=s;else c[k]=s===''?null:num(s)});
    if('etf' in e.target.elements)c.etf=!!e.target.elements.etf.checked;if('pilot' in e.target.elements)c.pilot=!!e.target.elements.pilot.checked;
    const kn=$('#ctKnown')?.value;if(kn){c.known=kn;const k=MARKET.contracts.find(x=>x.id===kn);if(k&&k.euroYieldYear)c.euroYieldYear=k.euroYieldYear}
    p.contract=c;save();placSheet(id);toast('Fiche contrat enregistrée')})}
