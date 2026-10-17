'use strict';
/* Budget Couple — modèle de données, migrations et fusion (fonctions pures, testables). */
const DATA_VERSION=12;
const LISTS=['months','goals','fixed','misc','placements','incomes','settlements','positions','valuations','dismissed','accounts','insurances','interests','movements','reports','imports','catrules','debts'];
const SCAL=['names','ratio','transfer','reminderDay','births','tax','notify'];
const CAT_FIXED=[['logement','Logement'],['energie','Énergie'],['transport','Transport'],['assurance','Assurances'],['abonnement','Abonnements'],['credit','Crédit'],['sante','Santé'],['autre','Autre']];
const CAT_MISC=[['courses','Courses'],['resto','Restaurants'],['loisirs','Loisirs'],['shopping','Shopping'],['transport','Transport'],['sante','Santé'],['maison','Maison'],['cadeaux','Cadeaux'],['autre','Autre']];
const BIRTHS={p1:'2000-06-22',p2:'2002-03-10'},TAX0={mode:'separe',children:0,childOf:'p1'};
const blankData=()=>({debts:[],imports:[],catrules:[],accounts:[],insurances:[],interests:[],movements:[],reports:[],notify:{reports:false},births:{...BIRTHS},tax:{...TAX0},dismissed:[],version:DATA_VERSION,names:{p1:'Emilien',p2:'Julie'},ratio:50,months:[],goals:[],fixed:[],transfer:{from:'p2',amount:0,label:'Virement loyer'},reminderDay:1,
  budget:{},misc:[],placements:[],incomes:[],settlements:[],deleted:{},su:{},budgetU:{},history:[],updated:0});
/* Migrations : chaque étape prend les données de la version précédente.
   v1 (sans version)/v2 → v3 : charges avec split (% payé par la personne 1), revenus.
   v3 → v4 : horodatage par élément (u, c), suppressions (tombstones), catégories, payeur réel/bénéficiaire, historique. */
/* Comptes courants créés à la migration v8 : identifiants déterministes (deux appareils qui migrent chacun de leur côté obtiennent les mêmes comptes) */
const ACC_ID={joint:'acc-joint',p1:'acc-p1',p2:'acc-p2'};
const MIGRATIONS={
  /* v8 → v9 : relevés importés (imports) et catégories apprises (catrules, id déterministe kw-<marchand>) ; aucune donnée existante modifiée */
  9(d){['imports','catrules'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});return d},
  /* v7 → v8 : comptes courants (une charge = un compte de prélèvement, un revenu = un compte de réception), assurances, intérêts, mouvements de livrets, bilans mensuels */
  8(d){const t=d.updated||0,names=Object.assign({p1:'Emilien',p2:'Julie'},d.names);d.accounts=Array.isArray(d.accounts)?d.accounts:[];
    const used=new Set();(d.fixed||[]).forEach(f=>used.add(f.paidBy==='p1'||f.paidBy==='p2'?f.paidBy:'joint'));(d.incomes||[]).forEach(i=>used.add(i.person==='p2'?'p2':'p1'));
    (d.misc||[]).forEach(m=>used.add(m.paidBy==='p1'||m.paidBy==='p2'?m.paidBy:'joint'));if(d.transfer&&d.transfer.amount){used.add('p1');used.add('p2')}
    ['joint','p1','p2'].forEach((o,i)=>{if(used.has(o)&&!d.accounts.some(a=>a.id===ACC_ID[o]))d.accounts.push({id:ACC_ID[o],label:o==='joint'?'Compte joint':'Compte '+names[o],bank:'',owner:o,u:t,c:i})});
    (d.fixed||[]).forEach(f=>{if(!f.account)f.account=ACC_ID[f.paidBy==='p1'||f.paidBy==='p2'?f.paidBy:'joint']});
    (d.incomes||[]).forEach(i=>{if(!i.account)i.account=ACC_ID[i.person==='p2'?'p2':'p1']});
    ['insurances','interests','movements','reports'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});if(!d.notify||typeof d.notify!=='object')d.notify={reports:false};return d},
  7:d=>{if(!Array.isArray(d.dismissed))d.dismissed=[]; // v7 : conseils masqués (liste synchronisée), dates de naissance, situation fiscale
    if(!d.births||typeof d.births!=='object')d.births={...BIRTHS};if(!d.tax||typeof d.tax!=='object')d.tax={...TAX0};return d},
  3(d){d.fixed=(d.fixed||[]).map(f=>{if(typeof f.split!=='number')f.split=f.payer==='p1'?100:f.payer==='p2'?0:(typeof d.ratio==='number'?d.ratio:50);return f});d.incomes=d.incomes||[];return d},
  4(d){const t=d.updated||0;
    LISTS.forEach(l=>{d[l]=(d[l]||[]).map((x,i)=>Object.assign({u:t,c:i},x))});
    d.fixed.forEach(f=>{f.category=f.category||'autre';if(!f.paidBy)f.paidBy=f.split>=100?'p1':f.split<=0?'p2':'joint'});
    d.misc.forEach(m=>{m.category=m.category||'autre';if(!m.paidBy){m.paidBy=m.payer==='p1'?'p1':m.payer==='p2'?'p2':'joint';m.for=m.payer==='p1'?'p1':m.payer==='p2'?'p2':'common'}});
    d.deleted=d.deleted||{};d.su=d.su||{};d.budgetU=d.budgetU||{};d.history=d.history||[];d.settlements=d.settlements||[];return d},
  /* v4 → v5 : type de placement, banque, mode de taux ; lignes d'enveloppe (positions) */
  5(d){d.placements=(d.placements||[]).map(p=>Object.assign({type:'autre',bank:'',rateMode:'manual'},p));d.positions=d.positions||[];return d},
  /* v5 → v6 : les enveloppes (AV, PEA, CTO, PER) sont suivies par valorisation globale. Les lignes deviennent une valorisation
     (somme des lignes, aucune perte), un total versé (somme des prix de revient), un versement et un rendement agrégés ; le détail est archivé. */
  6(d){const ENV=['av','pea','cto','per'],val=x=>x.kind==='euro'?(+x.value||0):(+x.qty||0)*(+x.price||0),cost=x=>x.kind==='euro'?(+x.invested||0):(+x.qty||0)*(+x.pru||0);
    d.valuations=d.valuations||[];d.archive=d.archive||{};const t=d.updated||0;
    (d.placements||[]).forEach(p=>{const L=(d.positions||[]).filter(x=>x.pid===p.id);if(!ENV.includes(p.type)||!L.length)return;
      const v=Math.round(L.reduce((s,x)=>s+val(x),0)*100)/100,c=Math.round(L.reduce((s,x)=>s+cost(x),0)*100)/100;
      p.capital=v;p.invested=c;p.monthly=Math.round(((+p.monthly||0)+L.reduce((s,x)=>s+(+x.monthly||0),0))*100)/100;
      p.rate=v?Math.round(L.reduce((s,x)=>s+val(x)*(+x.rate||0),0)/v*100)/100:(+p.rate||0);
      const _md=new Date(t||Date.now()),date=L.map(x=>x.priceDate).filter(Boolean).sort().pop()||`${_md.getFullYear()}-${String(_md.getMonth()+1).padStart(2,'0')}-${String(_md.getDate()).padStart(2,'0')}`;
      d.valuations.push({id:'mig-'+p.id,pid:p.id,date,value:v,u:t,c:t});
      p.archivedLines=L.map(x=>{const {u,by,fu,c,...r}=x;return r})});
    if((d.positions||[]).length)d.archive.positions=(d.archive.positions||[]).concat(d.positions);
    d.positions=[];if(typeof d.reminderDay!=='number')d.reminderDay=1;return d},
  /* v10 : fiche contrat (frais) sur les enveloppes, profil/personnes sur les assurances — aucun champ existant modifié */
  10:d=>{(d.placements||[]).forEach(p=>{if(['av','pea','cto','per'].includes(p.type)&&!('contract' in p))p.contract=null});
    (d.insurances||[]).forEach(i=>{if(i.type==='sante'&&!(+i.persons>0))i.persons=1;if(i.type==='habitation'&&!i.profile)i.profile=/propri/i.test(i.label+' '+(i.object||''))?'proprietaire':'locataire'});return d},
  /* v11 : répartition de la cible par objectif commun (null = réglages) — additif */
  11:d=>{(d.goals||[]).forEach(g=>{if(!('split' in g))g.split=null});return d},
  /* v12 : dettes entre nous — nouvelle liste vide, rien d'existant n'est modifié */
  12:d=>{if(!Array.isArray(d.debts))d.debts=[];return d}
};
function migrateData(raw){
  let d=JSON.parse(JSON.stringify(raw||{}));const v=d.version||1;
  for(let t=v+1;t<=DATA_VERSION;t++)if(MIGRATIONS[t])d=MIGRATIONS[t](d);
  const b=blankData();d=Object.assign(b,d);d.names=Object.assign(blankData().names,d.names);d.version=Math.max(DATA_VERSION,v);
  LISTS.forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});['deleted','su','budgetU','budget'].forEach(k=>{if(!d[k]||typeof d[k]!=='object')d[k]={}});if(!Array.isArray(d.history))d.history=[];
  d.fixed.forEach(f=>f.payer=f.split>=100?'p1':f.split<=0?'p2':'common'); // compatibilité anciennes versions
  d.misc.forEach(m=>{if(!m.payer)m.payer=m.for==='p1'?'p1':m.for==='p2'?'p2':'common'});
  return d;
}
/* ISIN : 2 lettres pays + 9 caractères alphanumériques + 1 chiffre de contrôle (Luhn sur la conversion lettres→nombres) */
function isinValid(raw){const s=String(raw||'').toUpperCase().replace(/\s/g,'');if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s))return false;
  const digits=s.split('').map(c=>/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c).join('');let sum=0,dbl=true;
  for(let i=digits.length-2;i>=0;i--){let n=+digits[i];if(dbl){n*=2;if(n>9)n-=9}sum+=n;dbl=!dbl}
  return (10-sum%10)%10===+digits[digits.length-1]}
/* Signature d'un élément (sans métadonnées) pour détecter les modifications */
const META=new Set(['u','by','fu','c']);
const QUIET=new Set(['reports','notify','catrules']); // générés automatiquement / propres à l'appareil : pas d'historique
const sig=x=>{const {u,by,fu,...r}=x;return JSON.stringify(r)};
const itemLabel=(l,x)=>l==='dismissed'?(x.title||'Conseil'):l==='interests'?`Intérêts ${x.year}`:l==='movements'?(x.label||'Mouvement'):l==='imports'?`Relevé ${x.file||''}`.trim():x.label||x.name||(x.month?x.month:'')||(l==='settlements'?'Règlement':'')||'élément';
function snapshot(d){const s={};LISTS.forEach(l=>d[l].forEach(x=>s[l+'\u0001'+x.id]={sig:sig(x),label:itemLabel(l,x),obj:JSON.parse(JSON.stringify(x))}));SCAL.forEach(k=>s['$'+k]={sig:JSON.stringify(d[k])});
  Object.keys(d.budget).forEach(m=>s['b\u0001'+m]={sig:String(d.budget[m])});return s}
/* Compare l'état courant à l'instantané : horodate les éléments modifiés, crée les tombstones et l'historique */
function stamp(d,snap,now,me){
  const seen=new Set(),hist=[];const H=(op,kind,label)=>QUIET.has(kind)||hist.push({id:Math.random().toString(36).slice(2,10)+now.toString(36),t:now,by:me||null,op,kind,label});
  LISTS.forEach(l=>d[l].forEach((x,i)=>{const k=l+'\u0001'+x.id;seen.add(k);const p=snap[k];
    if(!p){x.u=now;x.by=me||null;if(x.c===undefined)x.c=now+i/1000;H('add',l,itemLabel(l,x))}
    else if(p.sig!==sig(x)){x.u=now;x.by=me||null;x.fu=Object.assign({},x.fu);new Set([...Object.keys(x),...Object.keys(p.obj)]).forEach(f=>{if(!META.has(f)&&JSON.stringify(x[f])!==JSON.stringify(p.obj[f]))x.fu[f]=now});H('edit',l,itemLabel(l,x))}}));
  Object.keys(snap).forEach(k=>{const [l,id]=k.split('\u0001');if(LISTS.includes(l)&&!seen.has(k)){d.deleted[id]=now;H('del',l,snap[k].label)}});
  SCAL.forEach(k=>{if(!snap['$'+k]||snap['$'+k].sig!==JSON.stringify(d[k])){if(snap['$'+k]){d.su[k]=now;H('edit',k,k)}}});
  Object.keys(d.budget).forEach(m=>{const p=snap['b\u0001'+m];if(!p||p.sig!==String(d.budget[m])){d.budgetU[m]=now;H('edit','budget',m)}});
  if(hist.length){d.history=hist.concat(d.history).slice(0,500);d.updated=now}
  return hist.length;
}
/* Fusion par élément : le plus récent gagne par id ; une suppression plus récente que l'élément le retire. Commutative. */
function mergeData(a,b){
  const r=JSON.parse(JSON.stringify(a));r.deleted={...a.deleted};
  Object.entries(b.deleted||{}).forEach(([id,t])=>{if(!(r.deleted[id]>=t))r.deleted[id]=t});
  // fusion champ par champ : pour chaque champ, la valeur modifiée le plus récemment gagne
  const ft=(x,f)=>(x.fu&&x.fu[f])||x.c===undefined&&0||0;
  const pick=(x,y)=>{if(!x)return y;if(!y)return x;const base=(y.u>x.u||(y.u===x.u&&sig(y)>sig(x)))?y:x,o=base===x?y:x,r=JSON.parse(JSON.stringify(base));
    r.fu=Object.assign({},o.fu,base.fu);
    new Set([...Object.keys(x),...Object.keys(y)]).forEach(f=>{if(META.has(f))return;const to=ft(o,f),tb=ft(base,f);
      if(to>tb){if(f in o)r[f]=JSON.parse(JSON.stringify(o[f]));else delete r[f];r.fu[f]=to}});
    r.u=Math.max(x.u||0,y.u||0);if(!Object.keys(r.fu).length)delete r.fu;return r};
  LISTS.forEach(l=>{const m=new Map();(a[l]||[]).concat(b[l]||[]).forEach(x=>m.set(x.id,pick(m.get(x.id),x)));
    r[l]=[...m.values()].filter(x=>!(r.deleted[x.id]>=x.u)).sort((x,y)=>(x.c??0)-(y.c??0)||(x.id<y.id?-1:1))});
  r.su={...a.su};SCAL.forEach(k=>{const ta=a.su?.[k]||0,tb=b.su?.[k]||0;if(tb>ta||(tb===ta&&JSON.stringify(b[k])>JSON.stringify(a[k]))){r[k]=JSON.parse(JSON.stringify(b[k]));r.su[k]=tb}});
  r.budget={...a.budget};r.budgetU={...a.budgetU};Object.keys(b.budget||{}).forEach(mo=>{const ta=a.budgetU?.[mo]||0,tb=b.budgetU?.[mo]||0;if(!(mo in a.budget)||tb>ta||(tb===ta&&b.budget[mo]>a.budget[mo])){r.budget[mo]=b.budget[mo];r.budgetU[mo]=tb}});
  const hm=new Map();(a.history||[]).concat(b.history||[]).forEach(h=>hm.set(h.id,h));r.history=[...hm.values()].sort((x,y)=>y.t-x.t||(x.id<y.id?-1:1)).slice(0,500);
  r.updated=Math.max(a.updated||0,b.updated||0);r.version=Math.max(a.version||0,b.version||0);
  return r;
}
/* Forme canonique (sans état d'interface) pour comparer deux états */
const canon=d=>{const {miscMonth,...r}=d;return JSON.stringify(r)};
/* Impôt sur le revenu : estimation pure (barème progressif, quotient familial plafonné, décote). P = rates.incomeTax */
function irBrut(R,parts,P){const q=R/parts;let t=0,lo=0;for(const b of P.brackets){const hi=b.upTo==null?Infinity:b.upTo;if(q>lo)t+=(Math.min(q,hi)-lo)*b.rate/100;lo=hi}return t*parts}
function tmiOf(R,parts,P){const q=R/parts;let lo=0;for(const b of P.brackets){const hi=b.upTo==null?Infinity:b.upTo;if(q<=hi)return b.rate;lo=hi}return 45}
const proDeduct=(sal,P)=>sal>0?Math.min(sal,Math.min(P.proDeduction.max,Math.max(P.proDeduction.min,sal*P.proDeduction.rate/100))):0;
const childParts=n=>n<=0?0:n===1?0.5:n===2?1:1+(n-2);
function irCompute(R,base,children,P){R=Math.max(0,R);const parts=base+childParts(children);let brut=irBrut(R,parts,P);
  if(parts>base){const capped=irBrut(R,base,P)-(parts-base)*2*P.qfCapPerHalfPart;if(capped>brut)brut=capped}
  const D=base===2?P.decote.couple:P.decote.single;let decote=0;if(brut<D.threshold)decote=Math.min(brut,Math.max(0,D.base-brut*P.decote.rate/100));
  let net=Math.max(0,brut-decote);if(net<P.minCollected)net=0;net=Math.round(net);
  return{R:Math.round(R),parts,brut:Math.round(brut),decote:Math.round(decote),net,tmi:tmiOf(R,parts,P),avg:R?net/R*100:0}}
/* incomes = {p1:{sal,other},p2:{...}} revenus annuels ; tax = {mode,children,childOf} */
function taxEstimate(inc,tax,P){const R=k=>Math.max(0,inc[k].sal-proDeduct(inc[k].sal,P))+inc[k].other,n=+tax.children||0,co=tax.childOf||'p1';
  const sep={p1:irCompute(R('p1'),1,co==='p1'?n:0,P),p2:irCompute(R('p2'),1,co==='p2'?n:0,P)};sep.total=sep.p1.net+sep.p2.net;
  const com=irCompute(R('p1')+R('p2'),2,n,P);return{sep,com,diff:sep.total-com.net,net:{p1:R('p1'),p2:R('p2')}}}
if(typeof module!=='undefined')module.exports={ACC_ID,irCompute,taxEstimate,proDeduct,isinValid,DATA_VERSION,LISTS,migrateData,mergeData,stamp,snapshot,canon,blankData};
