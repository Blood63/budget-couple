'use strict';
/* Budget Couple — calculs purs (testables sous Node) : comptes courants, intérêts des livrets, extraction d'infos d'assurance. */
const pad2=n=>String(n).padStart(2,'0');
const dim=(y,m)=>new Date(y,m,0).getDate(); // m : 1-12
const ymd=(y,m,d)=>`${y}-${pad2(m)}-${pad2(d)}`;
const R2=x=>Math.round(x*100)/100;
/* Dates locales (jamais UTC) pour les saisies et défauts : à 00h30 à Paris, on est déjà le nouveau jour/mois local. */
const localIso=(d=new Date())=>ymd(d.getFullYear(),d.getMonth()+1,d.getDate());
const localMonth=(d=new Date())=>localIso(d).slice(0,7);

/* ---------- Comptes courants ---------- */
const accOfOwner=(D,o)=>{const L=(D.accounts||[]).filter(a=>a.owner===o);return(L.find(a=>a.id==='acc-'+o)||L[0]||{}).id||null};
const miscAccount=(D,m)=>m.account||accOfOwner(D,m.paidBy==='p1'||m.paidBy==='p2'?m.paidBy:'joint');
const transferAccounts=(D)=>{const t=D.transfer||{},to=t.from==='p1'?'p2':'p1';return{from:t.fromAccount||accOfOwner(D,t.from||'p2'),to:t.toAccount||accOfOwner(D,to)}};
/* Évènements d'un mois (YYYY-MM) sur un compte : [{day,amount(+/-),label,kind}] */
function accountEvents(D,accId,month){const [y,m]=month.split('-').map(Number),last=dim(y,m),E=[],cl=d=>Math.min(last,Math.max(1,parseInt(d)||1));
  (D.incomes||[]).filter(i=>i.account===accId&&(i.recurring||i.month===month)).forEach(i=>E.push({day:cl(i.day),amount:+i.amount||0,label:i.label||'Revenu',kind:'in'}));
  (D.fixed||[]).filter(f=>f.account===accId).forEach(f=>E.push({day:cl(f.day),amount:-(+f.amount||0),label:f.label||'Charge',kind:'fixed'}));
  (D.misc||[]).filter(x=>(x.date||'').startsWith(month)&&miscAccount(D,x)===accId).forEach(x=>E.push({day:cl(+x.date.slice(8,10)),amount:-(+x.amount||0),label:x.label||'Dépense',kind:'misc'}));
  const t=D.transfer||{};if(t.amount){const ta=transferAccounts(D);if(ta.from===accId)E.push({day:cl(t.day),amount:-t.amount,label:t.label||'Virement',kind:'transfer'});if(ta.to===accId)E.push({day:cl(t.day),amount:+t.amount,label:t.label||'Virement',kind:'transfer'})}
  (D.accounts||[]).forEach(a=>{const fd=a.feed;if(!fd)return;['p1','p2'].forEach(k=>{const v=+fd[k]||0;if(!v)return;const src=accOfOwner(D,k);if(a.id===accId)E.push({day:cl(fd.day),amount:v,label:'Versement '+((D.names||{})[k]||k),kind:'feed'});
    else if(src===accId&&src!==a.id)E.push({day:cl(fd.day),amount:-v,label:'Versement vers '+(a.label||'compte'),kind:'feed'})})});
  const mo=(D.months||[]).find(x=>x.month===month);if(mo){[['p1','a'],['p2','b']].forEach(([k,f])=>{if(mo[f]>0&&accOfOwner(D,k)===accId){
    const inc=(D.incomes||[]).filter(i=>i.account===accId&&i.recurring).sort((a,b)=>b.amount-a.amount)[0];E.push({day:cl(inc?inc.day:1),amount:-mo[f],label:'Épargne du mois',kind:'saving'})}})}
  else{/* Mois sans épargne saisie (mois futurs notamment) : les versements programmés des placements sont débités du compte du titulaire
         (compte joint pour un placement commun). Si le mois est saisi, son total d'épargne fait foi : pas de double comptage. */
    (D.placements||[]).filter(p=>+p.monthly>0&&!p.noAuto).forEach(p=>{const src=p.owner==='p1'||p.owner==='p2'?accOfOwner(D,p.owner):accOfOwner(D,'joint');
      if(src===accId)E.push({day:cl(p.payDay),amount:-(+p.monthly),label:'Versement programmé '+(p.name||p.type||'placement'),kind:'saving-planned'})})}
  return E.sort((a,b)=>a.day-b.day||b.amount-a.amount)}
/* Prévision d'un compte pour le mois : solde de départ = solde saisi (à sa date) reporté jour par jour */
function accountForecast(D,acc,month,today){const [y,m]=month.split('-').map(Number),last=dim(y,m),E=accountEvents(D,acc.id,month);
  const inn=R2(E.filter(e=>e.amount>0).reduce((s,e)=>s+e.amount,0)),out=R2(-E.filter(e=>e.amount<0).reduce((s,e)=>s+e.amount,0));
  const has=typeof acc.balance==='number'&&!!acc.balanceDate;let bal=0,startDay=0;
  if(has){const bd=acc.balanceDate;if(bd.slice(0,7)>month)return{inn,out,net:R2(inn-out),hasBalance:true,future:true,events:E};
    bal=+acc.balance;let cur=bd.slice(0,7),d=+bd.slice(8,10);
    while(cur<month){const [cy,cm]=cur.split('-').map(Number);accountEvents(D,acc.id,cur).filter(e=>e.day>d).forEach(e=>bal+=e.amount);d=0;cur=cm===12?`${cy+1}-01`:`${cy}-${pad2(cm+1)}`}
    startDay=bd.slice(0,7)===month?d:0}
  let min=bal,minDay=startDay||1;const start=bal;
  for(let day=startDay+1;day<=last;day++){E.filter(e=>e.day===day).forEach(e=>bal+=e.amount);if(bal<min-1e-9){min=bal;minDay=day}}
  const tday=today&&today.slice(0,7)===month?+today.slice(8,10):0;
  return{inn,out,net:R2(inn-out),start:R2(start),startDay,end:R2(bal),min:R2(min),minDay,hasBalance:has,risk:has?min<0:min<0&&inn<out,needed:has?0:R2(Math.max(0,-min)),
    upcoming:E.filter(e=>e.day>tday&&e.amount<0).slice(0,5),events:E}}

/* ---------- Safe to spend : budget diverses restant par jour (mois courant) ----------
   remaining = budget - dépensé ; perDay = remaining / jours restants (aujourd'hui inclus) ;
   projection de fin de mois au rythme constaté (dépensé / jours écoulés x jours du mois), comme l'écran Dépenses. */
function safeToSpend(o={}){const budget=+o.budget||0,spent=+o.spent||0,daysInMonth=Math.max(1,+o.daysInMonth||30),day=Math.max(1,Math.min(daysInMonth,+o.day||1));
  const remaining=R2(budget-spent),daysLeft=Math.max(1,daysInMonth-day+1),elapsed=Math.max(1,day),projection=R2(spent/elapsed*daysInMonth);
  return{budget,spent,remaining,daysLeft,elapsed,daysInMonth,projection,perDay:remaining>0?R2(remaining/daysLeft):0,over:remaining<0?R2(-remaining):0,
    status:!budget?'no-budget':remaining<0?'over':projection>budget?'risk':'ok'}}
/* Plafonds par catégorie (v13) : caps = {categorie: montant mensuel}. Pour chaque plafond > 0 : dépensé, reste, reste/jour, projection, statut.
   statut : 'over' (dépassé), 'risk' (projection au-dessus), 'near' (≥ 80 % consommé), 'ok'. Trié du plus urgent au moins urgent. */
function categoryCaps(misc,month,caps,day,daysInMonth){const out=[];Object.entries(caps||{}).forEach(([k,cap])=>{cap=+cap||0;if(cap<=0)return;
  const spent=R2((misc||[]).filter(x=>String(x.date||'').startsWith(month)&&(x.category||'autre')===k).reduce((s,x)=>s+(+x.amount||0),0));
  const ss=safeToSpend({budget:cap,spent,day,daysInMonth}),pct=spent/cap*100;
  out.push({key:k,cap,spent,left:ss.remaining,perDay:ss.perDay,projection:ss.projection,pct,status:ss.status==='over'?'over':ss.status==='risk'?'risk':pct>=80?'near':'ok'})});
  const W={over:0,risk:1,near:2,ok:3};return out.sort((a,b)=>W[a.status]-W[b.status]||b.pct-a.pct)}
/* ---------- Intérêts des livrets (règle des quinzaines) ----------
   Dépôt : valeur le 16 si fait du 1er au 15, le 1er du mois suivant si fait du 16 à la fin du mois.
   Retrait : cesse de rapporter dès le 1er (retrait du 1er au 15) ou le 16 (retrait du 16 à la fin).
   Intérêts annuels = Σ (solde de la quinzaine × taux en vigueur ce jour-là ÷ 24). */
const REGULATED=['livretA','ldds','lep','cel'],LIVRETS_I=['livretA','ldds','lep','cel','livretJeune','pel'];
function rateOn(p,date,rates){if(REGULATED.includes(p.type)){const h=rates?.products?.[p.type]?.history||[];const r=h.find(x=>x.from<=date);return r?r.rate:0}return +p.rate||0}
function scheduled(p,from,to){const out=[];if(!(+p.monthly>0)||p.noAuto)return out;const day=Math.min(28,Math.max(1,parseInt(p.payDay)||1));
  let [y,m]=from.slice(0,7).split('-').map(Number);const [ty,tm]=to.slice(0,7).split('-').map(Number);
  while(y<ty||(y===ty&&m<=tm)){const d=ymd(y,m,day);if(d>=from&&d<=to&&(!p.start||d>=p.start))out.push({date:d,amount:+p.monthly,auto:true});m++;if(m>12){m=1;y++}}return out}
const qDeposit=d=>{const m=+d.slice(5,7),day=+d.slice(8,10);return(m-1)*2+(day<=15?1:2)}; // première quinzaine rémunérée (0..24)
const qWithdraw=d=>{const m=+d.slice(5,7),day=+d.slice(8,10);return(m-1)*2+(day<=15?0:1)}; // première quinzaine où la somme ne rapporte plus
function livretInterest(p,Y,ctx){const rates=ctx.rates,mv=(ctx.movements||[]).filter(x=>x.pid===p.id),ints=(ctx.interests||[]).filter(x=>x.pid===p.id&&x.added),y0=`${Y}-01-01`,y1=`${Y}-12-31`;
  const flows=(a,b)=>mv.filter(x=>x.date>=a&&x.date<=b).map(x=>({date:x.date,amount:+x.amount})).concat(scheduled(p,a,b));
  let B0,est=false;
  if(p.open&&typeof p.open[Y]==='number')B0=p.open[Y];
  else{est=true;const cd=p.capitalDate||ctx.today||y1;
    if(cd>=y0){B0=(+p.capital||0)-flows(y0,cd).reduce((s,f)=>s+f.amount,0)-ints.filter(i=>i.date&&i.date>y0&&i.date<=cd).reduce((s,i)=>s+(+i.amount||0),0)}
    else{const nx=new Date(cd+'T12:00');nx.setDate(nx.getDate()+1);B0=(+p.capital||0)+flows(localIso(nx),`${Y-1}-12-31`).reduce((s,f)=>s+f.amount,0)}}
  B0=Math.max(0,R2(B0));const dq=new Array(25).fill(0);flows(y0,y1).forEach(f=>{if(f.amount>=0)dq[qDeposit(f.date)]+=f.amount;else dq[qWithdraw(f.date)]+=f.amount});
  let bal=B0,tot=0;const Q=[];for(let q=0;q<24;q++){bal+=dq[q];const date=ymd(Y,(q>>1)+1,q&1?16:1),r=rateOn(p,date,rates),i=Math.max(0,bal)*r/100/24;tot+=i;Q.push({date,bal:R2(bal),rate:r,i})}
  return{amount:R2(tot),B0,estimatedB0:est,quinzaines:Q,end:R2(bal+dq[24])}}

/* ---------- Assurances : extraction d'informations par règles (texte issu de pdf.js / OCR) ---------- */
const INSURERS=['AXA','MAIF','MACIF','MAAF','Matmut','Allianz','Groupama','GMF','Generali','MMA','Pacifica','Crédit Agricole Assurances','Direct Assurance','Luko','Leocare','Lovys','April','Harmonie Mutuelle','MGEN','Swiss Life','Covéa','BPCE Assurances','Hiscox','Cardif','Alan','Malakoff Humanis','AG2R La Mondiale','La Mutuelle Générale','L’olivier Assurance','Acheel','Hedi','Wakam','Cegema','Mutuelle de Poitiers','Thélem','SwissLife','Ornikar Assurance','Macsf','Amaguiz','Eurofil','Néoliane','Santiane','Henner','Aésio','Ociane','Apivia','Uniprévoyance','Klesia','Smatis','Mutuelle Bleue','Garance','Abeille Assurances','Aviva','Sogessur','Suravenir','Predica','CNP Assurances','Ag2r'];
const TYPES=[['habitation',/habitation|multirisque|logement|locataire|propri[ée]taire non occupant|\bMRH\b/i],['auto',/automobile|\bauto\b|v[ée]hicule|immatricul/i],['moto',/\bmoto\b|deux[- ]roues|scooter/i],
  ['trottinette',/trottinette|\bEDPM\b|engin de d[ée]placement/i],['sante',/compl[ée]mentaire sant[ée]|mutuelle sant[ée]|frais de sant[ée]|optique|dentaire/i],['prevoyance',/pr[ée]voyance|incapacit[ée]|invalidit[ée]|d[ée]c[èe]s/i],
  ['emprunteur',/emprunteur|pr[êe]t immobilier/i],['animal',/chien|chat|animal|animaux/i],['affinitaire',/t[ée]l[ée]phone|smartphone|ordinateur|appareil/i]];
const AMT='(\\d{1,3}(?:[\\s\\u00a0\\u202f.]\\d{3})*(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)\\s*(?:€|EUR|euros?)';
const toNum=s=>parseFloat(String(s).replace(/[\s\u00a0\u202f]/g,'').replace(/\.(?=\d{3}\b)/g,'').replace(',','.'));
function frDateToIso(s){if(!s)return'';const M={janvier:1,'février':2,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,'août':8,aout:8,septembre:9,octobre:10,novembre:11,'décembre':12,decembre:12};
  let m=s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return ymd(y,+m[2],+m[1])}
  m=s.match(/(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/i);if(m&&M[m[2].toLowerCase()])return ymd(+m[3],M[m[2].toLowerCase()],+m[1]);
  m=s.match(/(\d{1,2})(?:er)?\s+([a-zéû]+)/i);if(m&&M[m[2].toLowerCase()])return `--${pad2(M[m[2].toLowerCase()])}-${pad2(+m[1])}`;
  m=s.match(/(\d{1,2})[\/.](\d{1,2})(?!\d|[\/.]\d)/);if(m)return `--${pad2(+m[2])}-${pad2(+m[1])}`;return''}
const DATE_RE='(\\d{1,2}[\\/.\\-]\\d{1,2}(?:[\\/.\\-]\\d{2,4})?|\\d{1,2}(?:er)?\\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)(?:\\s+\\d{4})?)';
function insuranceExtract(raw){const text=String(raw||'').replace(/\r/g,'').replace(/[ \t]+/g,' '),lines=text.split('\n').map(l=>l.trim()).filter(Boolean),low=text.toLowerCase(),o={};
  const get=re=>{const m=text.match(re);return m?m[1].trim():''};
  o.insurer=INSURERS.find(n=>new RegExp('(^|[^a-z])'+n.replace(/[’']/g,'.').replace(/\s/g,'\\s')+'($|[^a-z])','i').test(text))||get(/(?:assureur|compagnie|organisme assureur)\s*:\s*([^\n]{2,60})/i);
  o.contract=get(/(?:n[°ºo]\s*(?:de\s*)?(?:contrat|police|adh[ée]rent|soci[ée]taire|d'adh[ée]sion)|contrat\s*n[°ºo]|r[ée]f[ée]rence\s*(?:du\s*)?contrat|num[ée]ro\s*de\s*(?:contrat|police))\s*[:.]?\s*([A-Z0-9][A-Z0-9\-\/.]{3,24}(?: [A-Z0-9]{1,4}\b)?)/i);
  o.insured=get(/(?:assur[ée]e?s?(?:\s*\(s\))?\s*(?:principal(?:e)?)?|souscripteur|titulaire|adh[ée]rent(?:e)?)\s*:\s*([^\n]{3,90})/i);
  const plate=text.match(/\b([A-Z]{2}-\d{3}-[A-Z]{2})\b/),veh=get(/(?:v[ée]hicule(?: assur[ée])?|marque\s*(?:et|\/)\s*mod[èe]le|mod[èe]le)\s*:\s*([^\n]{3,80})/i),
    home=get(/(?:adresse du risque|bien assur[ée]|logement assur[ée]|lieu assur[ée]|adresse assur[ée]e)\s*:\s*([^\n]{3,120})/i),eng=get(/(?:engin|trottinette|appareil assur[ée])\s*:\s*([^\n]{3,80})/i);
  o.object=[veh||eng,plate&&!(veh||'').includes(plate[1])?plate[1]:'',home].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
  const pm=text.match(new RegExp('(cotisation|prime)[^\\n\\d€]{0,40}?'+AMT+'([^\\n]{0,30})','i'));
  if(pm){o.premium=toNum(pm[2]);const ctx=(pm[0]+' '+(pm[3]||'')).toLowerCase();o.premiumFreq=/mensu|par mois|\/\s*mois/.test(ctx)?'mois':/trimestr/.test(ctx)?'trimestre':/annu|par an|\/\s*an/.test(ctx)?'an':(/mensuel/.test(low)?'mois':'an')}
  const dt=re=>frDateToIso(get(new RegExp(re+'[^\\n\\d]{0,25}?'+DATE_RE,'i')));
  o.start=dt('(?:date d.effet|prise d.effet|effet du contrat|date de d[ée]but|d[ée]but du contrat|à effet du)');
  o.end=dt('(?:[ée]ch[ée]ance(?: principale| annuelle| du contrat)?|date de fin|fin du contrat|expire le|valable jusqu.au)');
  o.renewal=dt('(?:renouvellement|reconduction(?: tacite)?|renouvel[ée] le)');if(/tacite reconduction|reconduit tacitement|renouvel(?:é|able) automatiquement/i.test(text))o.tacit=true;
  const pick=(re,max=6)=>{const r=[];lines.forEach(l=>{if(re.test(l)&&!r.includes(l)&&l.length<220)r.push(l)});return r.slice(0,max)};
  o.franchise=pick(/franchise/i,4).join('\n');o.ceilings=pick(/plafond|dans la limite de|limit[ée]e? à|jusqu.à \d/i,6).join('\n');
  const sect=(head,stop)=>{const i=lines.findIndex(l=>head.test(l)&&l.length<60);if(i<0)return[];const r=[];for(let j=i+1;j<lines.length&&r.length<10;j++){if(stop.test(lines[j])&&lines[j].length<60)break;r.push(lines[j].replace(/^[-•*✓✔·]\s*/,''))}return r};
  const STOP=/^(garanties?|exclusions?|franchises?|plafonds?|cotisation|prime|contacts?|assistance|informations|conditions|vos coordonn|signature|r[ée]siliation)\b/i;
  let G=sect(/^(?:vos |les )?garanties(?: (?:souscrites|incluses|principales|du contrat))?\s*:?$/i,STOP);
  if(!G.length)G=pick(/^(?:[-•*✓✔]\s*)?(responsabilit[ée] civile|dommages|vol\b|incendie|bris de glace|d[ée]g[âa]ts? des eaux|catastrophes? naturelles|assistance|protection juridique|tous risques|d[ée]fense|invalidit[ée]|d[ée]c[èe]s|hospitalisation|optique|dentaire|soins courants|garantie)/i,10);
  o.guarantees=G.join('\n');let X=sect(/^(?:principales |les )?exclusions(?: principales| notables)?\s*:?$/i,STOP);if(!X.length)X=pick(/exclu|n.est pas couvert|ne sont pas garantis/i,5);o.exclusions=X.join('\n');
  const tel=[...text.matchAll(/(?:(assistance|sinistres?|urgence|d[ée]claration|service client|contact)[^\n]{0,50}?)?((?:\+33\s?\(?0?\)?\s?|0)[1-9](?:[\s.\-]?\d{2}){4})/gi)];
  const ph=tel.find(m=>m[1]&&/assist|sinistr|urgen|d[ée]clar/i.test(m[1]))||tel[0];o.phone=ph?ph[2].replace(/[\s.\-]/g,'').replace(/(\d{2})(?=\d)/g,'$1 ').trim():'';
  o.type=(TYPES.find(([,re])=>re.test(text))||['autre'])[0];
  Object.keys(o).forEach(k=>{if(o[k]===''||o[k]==null)delete o[k]});return o}

/* Résiliation : règles générales (service-public.gouv.fr). Retourne {from, txt} */
const HAMON_TYPES=['habitation','auto','moto','trottinette','affinitaire'];
function cancelInfo(ins,today){const t=today||localIso();if(!ins.start)return null;
  const a=new Date(ins.start+'T12:00');a.setFullYear(a.getFullYear()+1);const one=localIso(a);
  if(HAMON_TYPES.includes(ins.type))return{from:one,ok:t>=one,txt:t>=one?'Résiliable à tout moment, sans frais ni motif (loi Hamon : contrat de plus d’un an) ; effet 1 mois après réception de la demande par l’assureur.':`Résiliable à tout moment à partir du ${one.split('-').reverse().join('/')} (loi Hamon, 1 an après la date d’effet).`};
  if(ins.type==='sante')return{from:one,ok:t>=one,txt:t>=one?'Complémentaire santé : résiliable à tout moment après 1 an de contrat.':`Complémentaire santé : résiliable à tout moment à partir du ${one.split('-').reverse().join('/')}.`};
  if(ins.type==='emprunteur')return{from:ins.start,ok:true,txt:'Assurance emprunteur : résiliable à tout moment (loi Lemoine), à condition de présenter des garanties équivalentes.'};
  return{from:ins.end||'',ok:false,txt:'Résiliation en principe à l’échéance annuelle (loi Chatel : l’assureur doit vous rappeler la date limite). Vérifiez le préavis dans vos conditions générales.'}}
function nextDue(ins,today){const t=today||localIso();let e=ins.end||ins.renewal||'';if(!e&&ins.start)e='--'+ins.start.slice(5);if(!e)return'';
  if(e.startsWith('--')){const md=e.slice(2);let y=+t.slice(0,4);let d=`${y}-${md}`;if(d<t)d=`${y+1}-${md}`;return d}
  if(e<t&&(ins.tacit||ins.renewal)){let d=e;while(d<t){d=String(+d.slice(0,4)+1)+d.slice(4)}return d}return e}


/* ---------- Relevés de compte : lecture (CSV, OFX, QIF, lignes de PDF) et rapprochement ---------- */
const stripAcc=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function frAmount(s){if(s==null)return NaN;let t=String(s).replace(/[\s\u00a0\u202f€]|EUR/g,'').replace(/[−–]/g,'-');if(!t)return NaN;let neg=/^-|-$|^\(.*\)$/.test(t);t=t.replace(/^[+-]|[+-]$|[()]/g,'');
  if(/,\d{1,2}$/.test(t))t=t.replace(/\./g,'').replace(',','.');else if(/\.\d{1,2}$/.test(t))t=t.replace(/,/g,'');else t=t.replace(/[.,]/g,'');const v=parseFloat(t);return isNaN(v)?NaN:R2(neg?-v:v)}
function anyDate(s,year){s=String(s||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{4})(\d{2})(\d{2})/);if(m&&+m[2]>=1&&+m[2]<=12)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?/);if(!m)return'';let y=m[3]?+m[3]:year;if(!y)return'';if(y<100)y+=2000;const mo=+m[2],d=+m[1];if(mo<1||mo>12||d<1||d>31)return'';return ymd(y,mo,d)}
function splitCsvLine(l,sep){const o=[];let cur='',q=false;for(let i=0;i<l.length;i++){const c=l[i];if(q){if(c==='"'){if(l[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}else if(c==='"')q=true;else if(c===sep){o.push(cur);cur=''}else cur+=c}o.push(cur);return o.map(x=>x.trim())}
function csvRecords(text,sep){const rows=[];let row=[],cur='',q=false;const t=String(text).replace(/^\ufeff/,'');
  for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;else if(c===sep){row.push(cur.trim());cur=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cur.trim());cur='';if(row.some(x=>x!==''))rows.push(row);row=[]}else cur+=c}
  row.push(cur.trim());if(row.some(x=>x!==''))rows.push(row);return rows}
function parseCSV(text){const raw=String(text).replace(/^\ufeff/,'');if(!raw.trim())return[];
  const firstLines=raw.split(/\r?\n/).slice(0,12);const sep=[';','\t',','].map(c=>[c,firstLines.reduce((n,l)=>n+Math.max(0,splitCsvLine(l,c).length-1),0)]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=csvRecords(raw,sep);let h=-1,col={};
  for(let i=0;i<Math.min(rows.length,20)&&h<0;i++){const r=rows[i].map(c=>stripAcc(c).toLowerCase());const findAll=re=>r.map((c,j)=>re.test(c)?j:-1).filter(x=>x>=0);
    const dates=findAll(/date/),labPref=findAll(/libelle (de l.)?operation|libelle complet|description detaillee|intitule|nature de l.operation/),labAny=findAll(/libelle|label|description|detail|nature/),am=findAll(/^montant|amount|montant operation/),db=findAll(/debit/),cr=findAll(/credit/);
    const date=dates.sort((a,b)=>{const score=x=>/operation|op\b|comptable/.test(r[x])?5:/^date$/.test(r[x])?4:/valeur/.test(r[x])?1:3;return score(b)-score(a)})[0];
    const lab=labPref[0]??labAny[0];
    if(date!==undefined&&lab!==undefined&&(am.length||db.length||cr.length)){h=i;col={d:date,lab,am:am[0]??-1,db:db[0]??-1,cr:cr[0]??-1}}}
  if(h>=0){const out=[];rows.slice(h+1).forEach(r=>{const date=anyDate(r[col.d]);if(!date)return;let a=col.am>=0?frAmount(r[col.am]):NaN;
      if(isNaN(a)){const db=col.db>=0?frAmount(r[col.db]):NaN,cr=col.cr>=0?frAmount(r[col.cr]):NaN;a=!isNaN(db)&&db!==0?-Math.abs(db):!isNaN(cr)&&cr!==0?Math.abs(cr):NaN}
      if(isNaN(a)||!a)return;out.push({date,label:(r[col.lab]||'Opération').replace(/\s+/g,' ').trim(),amount:a})});return out}
  const usable=rows.filter(r=>r.length>=3);if(usable.length<2)return[];
  const stats=usable[0].map((_,j)=>{const cells=usable.map(r=>r[j]||'');return{date:cells.filter(x=>anyDate(x)).length/usable.length,num:cells.filter(x=>!isNaN(frAmount(x))&&frAmount(x)!==0).length/usable.length,len:cells.reduce((s,x)=>s+String(x).length,0)/usable.length}});
  const dc=stats.findIndex(x=>x.date>=.6),ac=stats.findIndex((x,j)=>j!==dc&&x.num>=.6);if(dc<0||ac<0)return[];
  const lc=stats.map((x,j)=>j).filter(j=>j!==dc&&j!==ac).sort((a,b)=>stats[b].len-stats[a].len)[0];
  return usable.map(r=>({date:anyDate(r[dc]),label:String(r[lc]||'Opération').replace(/\s+/g,' ').trim(),amount:frAmount(r[ac])})).filter(o=>o.date&&o.amount)}
const xmlText=s=>String(s||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&amp;/g,'&').trim();
function parseOFX(text){const out=[];const T=String(text).split(/<STMTTRN>/i).slice(1);const g=(b,k)=>{const m=b.match(new RegExp('<'+k+'>([\\s\\S]*?)(?=<[A-Z/]|$)','i'));return m?xmlText(m[1]):''};
  T.forEach(b=>{const date=anyDate(g(b,'DTPOSTED')),a=frAmount(g(b,'TRNAMT')),nm=g(b,'NAME'),me=g(b,'MEMO'),label=!me?nm:!nm?me:me.startsWith(nm)?me:nm.includes(me)?nm:nm+' '+me;
    if(date&&!isNaN(a)&&a)out.push({date,label:xmlText(label),amount:a,fitid:g(b,'FITID')})});return out}
function parseQIF(text){const out=[];let c={};String(text).split(/\r?\n/).forEach(l=>{const k=l[0],v=l.slice(1).trim();
  if(k==='D'){let s=v.replace(/'/g,'/').replace(/\s/g,'');const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);c.date=m?anyDate(s):anyDate(s)}else if(k==='T'||k==='U')c.amount=frAmount(v);else if(k==='P')c.payee=v;else if(k==='M')c.memo=v;
  else if(k==='^'){if(c.date&&c.amount)out.push({date:c.date,label:[c.payee,c.memo].filter(Boolean).join(' '),amount:c.amount});c={}}});return out}
/* Lignes d'un relevé PDF : [{y, items:[{str,x}]}] (positions pdf.js). Les colonnes Débit / Crédit sont repérées dans l'en-tête. */
const AMT_ONLY=/^\(?[+\-−]?\s?\d{1,3}(?:[ .\u00a0\u202f]\d{3})*,\d{2}\s?(?:€|EUR)?\)?$|^\(?[+\-−]?\d+[.,]\d{2}\s?(?:€|EUR)?\)?$/;
function parseStatementLines(lines){const text=lines.map(l=>l.items.map(i=>i.str).join(' ')).join('\n');
  const per=stripAcc(text).match(/du\s+(\d{1,2}[\/.]\d{1,2}[\/.](\d{2,4}))\s+au\s+(\d{1,2}[\/.]\d{1,2}[\/.](\d{2,4}))/i),anyY=text.match(/\b\d{1,2}[\/.]\d{1,2}[\/.](20\d{2})\b/)||text.match(/\b(20\d{2})\b/);
  let year=per?(+per[4]<100?2000+ +per[4]:+per[4]):anyY?+anyY[1]:new Date().getFullYear();const endMonth=per?+per[3].split(/[\/.]/)[1]:null;
  let colD=null,colC=null,colM=null;const out=[];let last=null;
  lines.forEach(l=>{const its=l.items.filter(i=>i.str.trim());if(!its.length)return;const low=stripAcc(its.map(i=>i.str).join(' ')).toLowerCase();
    if(/debit/.test(low)&&/credit/.test(low)){its.forEach(i=>{const t=stripAcc(i.str).toLowerCase();if(/debit/.test(t))colD=i.x+(i.w||0)/2;if(/credit/.test(t))colC=i.x+(i.w||0)/2});last=null;return}
    if(/^(date.*)?(libelle|operation|montant)/.test(low)&&/montant/.test(low)&&!/debit/.test(low)){const m=its.find(i=>/montant/i.test(i.str));if(m)colM=m.x;last=null;return}
    const first=its[0].str.trim(),dm=first.match(/^(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
    let amts=its.filter((i,k)=>k>0&&AMT_ONLY.test(i.str.trim()));const cx=i=>i.x+(i.w||0)/2,dateLike=i=>/^\d{1,2}[.\/](0[1-9]|1[0-2])$/.test(i.str.trim());
    if(colD!=null&&colC!=null){const near=amts.filter(i=>Math.min(Math.abs(cx(i)-colD),Math.abs(cx(i)-colC))<70);if(near.length||amts.every(dateLike))amts=near}
    else if(amts.length>1&&amts.some(i=>!dateLike(i)))amts=amts.filter(i=>!dateLike(i));
    if(dm&&amts.length){let y=dm[3]?+dm[3]:year;if(!dm[3]&&endMonth&&+dm[2]>endMonth)y=year-1;const date=anyDate(`${dm[1]}/${dm[2]}/${y}`);if(!date){last=null;return}
      const amIt=colD!=null&&colC!=null?amts[0]:colM!=null?amts.reduce((best,i)=>!best||Math.abs(cx(i)-colM)<Math.abs(cx(best)-colM)?i:best,null):amts[amts.length-1];
      // libellé : éléments textuels hors dates de valeur et montants
      const lab=its.slice(1).filter(i=>!amts.includes(i)&&!(AMT_ONLY.test(i.str.trim())&&!dateLike(i))&&!/^\d{1,2}[\/.]\d{1,2}([\/.]\d{2,4})?$/.test(i.str.trim())).map(i=>i.str.trim()).join(' ');
      let a=frAmount(amIt.str);const raw=amIt.str.trim();
      if(colD!=null&&colC!=null){const cx=amIt.x+(amIt.w||0)/2;a=Math.abs(cx-colC)<Math.abs(cx-colD)?Math.abs(a):-Math.abs(a)}
      else if(!/^[+\-−]/.test(raw)&&colM==null)a=/\b(vir(ement)?\s+(sepa\s+)?(recu|de)|salaire|remise|remboursement|avoir|interets)\b/i.test(stripAcc(lab))?Math.abs(a):-Math.abs(a);
      if(/^(solde|total|ancien solde|nouveau solde)/i.test(stripAcc(lab))){last=null;return}
      last={date,label:lab.replace(/\s+/g,' '),amount:a};out.push(last);return}
    if(last&&!dm&&!amts.length&&its.length<=8&&!/^(solde|total|page|date|releve|extrait|compte|iban|bic)/i.test(stripAcc(first))&&last.label.length<160)last.label+=' '+its.map(i=>i.str.trim()).join(' ');else last=null});
  return out}
function parseStatementText(name,text){const n=String(name||'').toLowerCase(),t=String(text);
  if(/\.ofx$|\.qfx$/.test(n)||/<OFX>|<STMTTRN>/i.test(t))return{format:'OFX',ops:parseOFX(t)};
  if(/\.qif$/.test(n)||/^!Type:/m.test(t))return{format:'QIF',ops:parseQIF(t)};return{format:'CSV',ops:parseCSV(t)}}
/* Normalisation du libellé : sans accents, sans préfixes bancaires, numéros, dates */
function normLabel(s){return stripAcc(s).toUpperCase().replace(/\b(PRLV|PRELEVEMENT|PRELEV|SEPA|CB|CARTE|PAIEMENT|PAIE|FACTURE|FAC|ACHAT|ECH|ECHEANCE|PRET|DU|LE|DE|LA|DES|ET|X\d{3,4}|\d{2}\/\d{2}(\/\d{2,4})?|EUR|EUROS)\b/g,' ').replace(/[^A-Z ]+/g,' ').replace(/\s+/g,' ').trim()}
const merchantKey=s=>normLabel(s).split(' ').filter(w=>w.length>2&&!/^(VIR|VIREMENT|INST|RECU|EMIS|VERS|POUR|REF|MOTIF|MANDAT|ICS|RUM|FR)$/.test(w)).slice(0,2).join(' ');
function labelSim(a,b){const A=new Set(normLabel(a).split(' ').filter(w=>w.length>2)),B=new Set(normLabel(b).split(' ').filter(w=>w.length>2));if(!A.size||!B.size)return 0;let n=0;A.forEach(w=>{if(B.has(w)||[...B].some(v=>v.length>3&&w.length>3&&(v.startsWith(w)||w.startsWith(v))))n++});return n/Math.min(A.size,B.size)}
const opHash=o=>`${o.date}|${Math.round(o.amount*100)}|${normLabel(o.label).slice(0,40)}`;
const CAT_RULES=[['courses',/CARREFOUR|LECLERC|AUCHAN|LIDL|INTERMARCHE|MONOPRIX|FRANPRIX|CASINO|SUPER U|HYPER U|SYSTEME U|\bU EXPRESS|ALDI|PICARD|BIOCOOP|GRAND FRAIS|NATURALIA|LEADER PRICE|NETTO|COLRUYT|SPAR|MARCHE|PRIMEUR|BOUCHERIE/],
  ['resto',/RESTAU|MC ?DO|MCDONALD|BURGER|KFC|DELIVEROO|UBER ?EATS|JUST ?EAT|BOULANG|PATISS|CAFE|BRASSERIE|PIZZ|SUSHI|KEBAB|STARBUCKS|PAUL\b|BAR\b|CREPERIE|BISTRO/],
  ['transport',/SNCF|OUIGO|TOTAL|ESSO|SHELL|\bBP\b|AVIA|STATION|CARBURANT|PEAGE|APRR|VINCI|SANEF|RATP|UBER(?! ?EATS)|BOLT|BLABLACAR|PARKING|INDIGO|TCL|T2C|TISSEO|NAVIGO|LIME|AUTOROUTE/],
  ['sante',/PHARMA|DOCTOLIB|MEDECIN|DOCTEUR|\bDR\b|DENTIST|OPTIC|OPTIQUE|LABO|KINE|HOPITAL|CLINIQUE|OSTEO/],
  ['maison',/IKEA|LEROY MERLIN|CASTORAMA|BRICO|MR BRICOLAGE|CONFORAMA|BUT\b|MAISONS DU MONDE|GIFI|ACTION\b|JARDI|TRUFFAUT|BOULANGER\b|DARTY/],
  ['shopping',/AMAZON|AMZN|ZARA|H ?M\b|DECATHLON|FNAC|ZALANDO|KIABI|CDISCOUNT|PRIMARK|SEPHORA|UNIQLO|CELIO|JULES|VINTED|SHEIN|NIKE|GO SPORT|INTERSPORT|LA REDOUTE/],
  ['loisirs',/CINEMA|PATHE|UGC|GAUMONT|MEGARAMA|CONCERT|TICKETMASTER|FNAC SPECTACLE|STEAM|PLAYSTATION|NINTENDO|MUSEE|BOWLING|PISCINE|PARC|DISNEY|AIRBNB|BOOKING|HOTEL|VOYAGE/],
  ['cadeaux',/CADEAU|INTERFLORA|SMARTBOX|WONDERBOX|FLEUR/]];
function guessCategory(label,rules){const k=merchantKey(label);const r=(rules||[]).find(x=>x.key===k);if(r)return{cat:r.category,learned:true};
  const n=' '+normLabel(label)+' ';const f=CAT_RULES.find(([,re])=>re.test(n));return{cat:f?f[0]:'autre',learned:false}}
const SAVE_RE=/LIVRET|\bLDD|\bLDDS|\bLEP\b|\bPEL\b|\bCEL\b|EPARGNE|ASSURANCE VIE|ASS VIE|\bPEA\b|\bPER\b|PLACEMENT/;
/* Classe une opération : depense | charge | virement | revenu | epargne (+ fixedId, category) */
function classifyOp(o,D,accId,opts={}){const n=normLabel(o.label),acc=(D.accounts||[]).find(a=>a.id===accId),names=['p1','p2'].map(k=>stripAcc((D.names||{})[k]||'').toUpperCase()).filter(x=>x.length>2);
  const day=+o.date.slice(8,10),isVir=/\bVIR|VIREMENT|VRT\b|VIRT/.test(stripAcc(o.label).toUpperCase());
  const otherAcc=(D.accounts||[]).filter(a=>a.id!==accId).some(a=>{const w=normLabel(a.label).split(' ').filter(x=>x.length>3&&!/COMPTE|JOINT|COURANT/.test(x));return w.some(x=>n.includes(x))||(/JOINT|COMMUN/.test(n)&&a.owner==='joint')});
  const named=names.filter(x=>n.includes(x)).length;
  const t=D.transfer||{},feeds=(D.accounts||[]).flatMap(a=>a.feed?[+a.feed.p1||0,+a.feed.p2||0]:[]).filter(Boolean);
  const internal=isVir&&(otherAcc||named>=1&&/JOINT|COMMUN|COMPTE/.test(n)||named>=2||(t.amount&&Math.abs(Math.abs(o.amount)-t.amount)<0.01)||feeds.some(v=>Math.abs(Math.abs(o.amount)-v)<0.01));
  if(o.amount>0){if(internal)return{type:'virement'};
    const inc=(D.incomes||[]).find(i=>(!i.account||!accId||i.account===accId)&&Math.abs(i.amount-o.amount)<=Math.max(20,i.amount*0.1));return{type:'revenu',incomeId:inc?inc.id:null}}
  const A=-o.amount;
  if(SAVE_RE.test(n)||(D.placements||[]).some(p=>+p.monthly>0&&Math.abs(p.monthly-A)<0.01&&isVir))return{type:'epargne'};
  if(internal)return{type:'virement'};
  let best=null;(D.fixed||[]).forEach(f=>{if(accId&&f.account&&f.account!==accId)return;const tol=Math.max(2,f.amount*0.05),da=Math.abs(f.amount-A);if(da>tol*(f.variable?4:1))return;
    const sim=labelSim(o.label,f.label),dd=Math.min(Math.abs((+f.day||1)-day),31-Math.abs((+f.day||1)-day));if(sim<0.34&&dd>3)return;
    const sc=(1-da/(tol*4))+sim*2+(dd<=3?1-dd/4:0);if(!best||sc>best.sc)best={f,sc}});
  if(best)return{type:'charge',fixedId:best.f.id};
  const g=guessCategory(o.label,opts.rules);return{type:'depense',category:g.cat,learned:g.learned}}

/* ---------- Indicateur de qualité (indicatif) : assurances et contrats d'épargne vs repères de marché ---------- */
const gradeOf=n=>n>=80?'A':n>=65?'B':n>=50?'C':n>=35?'D':'E';
const firstEuro=t=>{const m=String(t||'').match(/(\d{1,3}(?:[\s\u00a0\u202f.]\d{3})*|\d+)(?:,\d{1,2})?\s*(?:€|euros?)/i);return m?toNum(m[0].replace(/€|euros?/i,'')):null};
const firstDays=t=>{const m=String(t||'').match(/(\d{1,3})\s*jours?/i);return m?+m[1]:null};
function finish(C){const ev=C.filter(c=>c.score!=null),W=ev.reduce((s,c)=>s+c.w,0);const score=W?Math.round(ev.reduce((s,c)=>s+c.score*c.w,0)/W):null;return{score,grade:score==null?null:gradeOf(score),criteria:C,coverage:Math.round(W/C.reduce((s,c)=>s+c.w,0)*100)}}
const ratioPts=(r)=>r<=0.8?100:r<=1?80:r<=1.25?55:r<=1.6?30:10;
/* ins : fiche assurance ; ctx : {age} (âge de l'assuré pour la santé), {persons} nombre de personnes couvertes */
function insQuality(ins,M,ctx={}){const R=M&&M.insurance&&M.insurance[ins.type];if(!R)return null;const C=[],yr=(+ins.premium||0)*({mois:12,trimestre:4}[ins.premiumFreq]||1);
  let ref=null,refNote='';const prof=R.profiles[ins.profile]||R.profiles[Object.keys(R.profiles)[0]];
  if(R.ages&&ctx.age){const a=R.ages.find(x=>ctx.age>=x[0]&&ctx.age<=x[1]);if(a){ref=a[2];refNote=`moyenne ${a[0]}-${a[1]} ans : ${a[2]} €/an/personne`}}
  if(!ref&&prof){ref=prof.avg;refNote=`${prof.label} : moyenne ${prof.avg} €/an`}
  const per=R.perPerson?Math.max(1,+ins.persons||ctx.persons||1):1,cost=yr/per;
  C.push({k:'prix',label:'Cotisation',w:40,score:yr&&ref?ratioPts(cost/ref):null,value:yr?`${Math.round(cost)} €/an${per>1?' par personne':''}`:'non renseignée',ref:refNote,tip:yr&&ref&&cost>ref*1.25?'Au-dessus des repères : comparez les garanties et les devis à garanties équivalentes.':''});
  if(R.franchise){const f=R.franchise.unit==='jours'?firstDays(ins.franchise):firstEuro(ins.franchise),u=R.franchise.unit==='jours'?' jours':' €';
    C.push({k:'franchise',label:'Franchise',w:15,score:f==null?null:f<=R.franchise.good?100:f<=R.franchise.avg?65:f<=R.franchise.avg*2?35:10,value:f==null?'non renseignée':f+u,ref:`repère usuel ≤ ${R.franchise.good}${u}`})}
  const txt=[ins.guarantees,ins.ceilings,ins.notes,ins.label].join(' \n '),found=[],miss=[];R.key.forEach(([k,l,re])=>(new RegExp(re,'i').test(txt)?found:miss).push(l));
  C.push({k:'garanties',label:'Garanties clés',w:35,score:String(ins.guarantees||'').trim()?Math.round(found.length/R.key.length*100):null,value:String(ins.guarantees||'').trim()?`${found.length}/${R.key.length}`:'non renseignées',ref:'garanties habituelles pour ce type de contrat',missing:String(ins.guarantees||'').trim()?miss:[]});
  const hasCeil=/\d/.test(String(ins.ceilings||''));C.push({k:'plafonds',label:'Plafonds',w:10,score:hasCeil?100:null,value:hasCeil?'indiqués':'non renseignés',ref:'des plafonds chiffrés permettent de vérifier la couverture'});
  return{...finish(C),ref:R}}
/* Contrat d'épargne : av / per (frais en %), pea / cto (courtage, droits de garde) */
function contractQuality(c,type,M){const S=M&&M.savings&&M.savings[type];if(!S||!c)return null;const C=[],n=v=>v===''||v==null||isNaN(+v)?null:+v,mk=S.market,on=S.online,bk=S.bank;
  const sc=(v,best,avg,worst)=>v==null?null:v<=best?100:v<=avg?Math.round(100-(v-best)/((avg-best)||1)*30):v<=worst?Math.round(70-(v-avg)/((worst-avg)||1)*50):10;
  const pc=v=>v==null?'non renseigné':String(v).replace('.',',')+' %';
  if(type==='av'||type==='per'){const ef=n(c.entryFee),uf=n(c.ucFee),eu=n(c.euroFee),ar=n(c.arbFee),ey=n(c.euroYield);
    C.push({k:'entree',label:'Frais sur versement',w:20,score:sc(ef,on.entryFee,mk.entryFee,bk.entryFee),value:pc(ef),ref:`moyenne marché ${pc(mk.entryFee)} · en ligne ${pc(on.entryFee)} · bancaire jusqu’à ${pc(bk.entryFee)}`});
    C.push({k:'uc',label:'Frais de gestion UC',w:25,score:sc(uf,on.ucFee,mk.ucFee,1.2),value:pc(uf),ref:`moyenne ${pc(mk.ucFee)} · en ligne ${pc(on.ucFee)}`});
    C.push({k:'euro',label:ey!=null?'Rendement net du fonds euros':'Frais de gestion fonds euros',w:20,score:ey!=null?(ey>=mk.euroYield+0.4?100:ey>=mk.euroYield?80:ey>=mk.euroYield-0.5?55:25):sc(eu,on.euroFee,mk.euroFee,1),value:ey!=null?`${pc(ey)}${c.euroYieldYear?' ('+c.euroYieldYear+')':''}`:pc(eu),ref:ey!=null?`moyenne 2025 ${pc(mk.euroYield)} (ACPR)`:`moyenne ${pc(mk.euroFee)}`});
    C.push({k:'arb',label:'Frais d’arbitrage',w:10,score:ar==null?null:ar<=0?100:ar<=0.5?60:20,value:pc(ar),ref:'en ligne souvent 0 %'});
    C.push({k:'etf',label:'Offre de supports (dont ETF)',w:15,score:c.etf==null&&!n(c.supports)?null:(c.etf?60:20)+(n(c.supports)>=300?40:n(c.supports)>=50?25:n(c.supports)?10:20),value:`${n(c.supports)?c.supports+' supports':'nombre non renseigné'}${c.etf?' · ETF':c.etf===false?' · sans ETF':''}`,ref:'un large choix avec des ETF peu chargés réduit les frais'});
    C.push({k:'pilot',label:'Gestion pilotée',w:10,score:c.pilot==null?null:c.pilot?(n(c.pilotFee)!=null&&n(c.pilotFee)>0.5?60:100):60,value:c.pilot?`disponible${n(c.pilotFee)!=null?' (+'+pc(n(c.pilotFee))+')':''}`:c.pilot===false?'non':'non renseigné',ref:'option, non indispensable'})}
  else{const op=n(c.orderPct),om=n(c.orderMin)||0,cu=n(c.custodyPct),af=n(c.accountFee),o=S.order||500,ordCost=op==null?null:Math.max(om,o*op/100)/o*100;
    C.push({k:'courtage',label:`Courtage (ordre de ${o} €)`,w:45,score:sc(ordCost,on.orderPct,mk.orderPct,1.2),value:ordCost==null?'non renseigné':`${(Math.max(om,o*op/100)).toFixed(2).replace('.',',')} € (${ordCost.toFixed(2).replace('.',',')} %)`,ref:`en ligne ~${pc(on.orderPct)} · bancaire ${pc(bk.orderPct)}`});
    C.push({k:'garde',label:'Droits de garde',w:35,score:cu==null?null:cu<=0?100:cu<=0.2?60:cu<=0.4?30:5,value:cu==null?'non renseignés':pc(cu)+(n(c.custodyLine)?` + ${c.custodyLine} €/ligne`:''),ref:'0 % chez la plupart des courtiers en ligne ; plafond PEA 0,4 %'});
    C.push({k:'tenue',label:'Frais de tenue de compte',w:20,score:af==null?null:af<=0?100:af<=30?60:20,value:af==null?'non renseignés':af+' €/an',ref:'souvent 0 €'})}
  return finish(C)}
/* Coût des frais sur 10 ans (même rendement brut de 3 %/an, seuls les frais diffèrent) */
function feeCost10(c,type,M,{capital=10000,monthly=0,euroShare=0.5,years=10,gross=3}={}){const S=M&&M.savings&&M.savings[type];if(!S)return null;
  const run=f=>{let v=0,noFee=0,fees=0;const dep=(amt)=>{const e=amt*(f.entryFee||0)/100;fees+=e;v+=amt-e;noFee+=amt};
    if(type==='av'||type==='per'){dep(capital);const mf=(euroShare*(f.euroFee||0)+(1-euroShare)*(f.ucFee||0))/100;
      for(let m=0;m<years*12;m++){if(monthly)dep(monthly);const g=v*gross/100/12,fee=v*mf/12;v+=g-fee;fees+=fee;noFee+=noFee*gross/100/12}}
    else{const o=S.order||500;v=capital;noFee=capital;for(let m=0;m<years*12;m++){if(monthly){const oc=Math.max(f.orderMin||0,monthly*(f.orderPct||0)/100);fees+=oc;v+=monthly-oc;noFee+=monthly}
      v+=v*gross/100/12;noFee+=noFee*gross/100/12;if(m%12===11){const cu=v*(f.custodyPct||0)/100+(f.custodyLine||0)*(f.lines||1)+(f.accountFee||0);fees+=cu;v-=cu}}}
    return{fees:R2(fees),final:R2(v),gap:R2(noFee-v)}};
  const own=Object.fromEntries(Object.entries(c||{}).map(([k,x])=>[k,x===''||x==null?undefined:+x]).filter(([,x])=>x!==undefined&&!isNaN(x)));
  return{own:run({...S.market,...own}),market:run(S.market),online:run(S.online),bank:run(S.bank)}}
/* Part cible de chaque personne pour un objectif (v11). split null → réglage global (ratio = part de p1 en %). */
function goalShares(g,ratio){const T=Math.round((+g.target||0)*100)/100,r2=x=>Math.round(x*100)/100;
  if(g.owner==='p1')return{p1:T,p2:0};if(g.owner==='p2')return{p1:0,p2:T};const s=g.split;
  if(s&&s.mode==='amount'){const a=r2(Math.max(0,+s.p1||0)),b=r2(Math.max(0,+s.p2||0));if(Math.abs(a+b-T)<0.005)return{p1:a,p2:r2(T-a)};const p=a+b>0?a/(a+b):0.5;const x=r2(T*p);return{p1:x,p2:r2(T-x)}}
  const pc=s&&s.mode==='pct'?Math.min(100,Math.max(0,+s.p1)):(typeof ratio==='number'?ratio:50),x=r2(T*pc/100);return{p1:x,p2:r2(T-x)}}
const goalPct=(g,ratio)=>{const S=goalShares(g,ratio),T=S.p1+S.p2;return T>0?S.p1/T*100:(g.split&&g.split.mode==='pct'?+g.split.p1:ratio)};


/* Épargne mensuelle : moyennes récentes et scénarios (historique saisi, mois enregistrés uniquement) */
function savingsScenarios(months){const L=[...(months||[])].filter(m=>m&&(isFinite(m.a)||isFinite(m.b))).sort((a,b)=>String(a.month).localeCompare(String(b.month)));
  const avg=n=>{const S=L.slice(-n);return S.length?{value:R2(S.reduce((t,m)=>t+(+m.a||0)+(+m.b||0),0)/S.length),count:S.length}:null};
  const a3=avg(3),a6=avg(6),a12=avg(12),vals=[a3,a6,a12].filter(Boolean);
  if(!vals.length)return{months:L,avg:{m3:a3,m6:a6,m12:a12},prudent:null,realistic:null};
  const prudent=R2(Math.min(...vals.map(x=>x.value))*.9);
  const realistic=a6&&a12?R2((a6.value+a12.value)/2):a6?a6.value:a3?a3.value:a12.value;
  return{months:L,avg:{m3:a3,m6:a6,m12:a12},prudent,realistic}}
/* Projection 5 ans : placements projetés par produit + flux mensuel historique.
   Les versements permanents des placements sont inclus dans le flux ; seul l'excédent est ajouté séparément (pas de double comptage). */
function fiveYearProjection(streams,opts={}){const months=opts.months||60,base=(streams||[]).map(p=>({capital:+p.capital||0,monthly:+p.monthly||0,rate:+p.rate||0,cap:+p.cap||null,depBase:p.depBase!=null?+p.depBase:null,depositUntil:p.depositUntil||null}));
  const programmed=R2(base.reduce((s,p)=>s+p.monthly,0)),initial=R2(base.reduce((s,p)=>s+p.capital,0)),cashRate=+opts.cashRate||0,asOf=opts.asOf||localIso();
  const monthAt=m=>{const d=new Date(+asOf.slice(0,4),+asOf.slice(5,7)-1+m,15);return localMonth(d)};
  const run=flow=>{let vals=base.map(p=>p.capital),deps=base.map(p=>p.depBase!=null?p.depBase:p.capital),cash=0;const eff=Math.max(flow||0,programmed),resid=eff-programmed;const series=[{month:0,total:initial,placements:initial,cash:0,contributions:0,gains:0}];
    for(let m=1;m<=months;m++){let capped=0;
      vals=vals.map((v,i)=>{const p=base[i];let dep=p.monthly;
        if(p.depositUntil&&monthAt(m)>=String(p.depositUntil).slice(0,7))dep=0;
        if(dep>0&&p.cap&&p.depBase!=null){dep=Math.min(dep,Math.max(0,p.cap-deps[i]));deps[i]+=dep}
        capped+=p.monthly-dep;return v*(1+p.rate/100/12)+dep});
      cash=cash*(1+cashRate/100/12)+resid+capped; // excédent plafonné redirigé vers la poche libre, pas de rendement inventé par produit
      const total=vals.reduce((a,b)=>a+b,0)+cash,contrib=eff*m;
      series.push({month:m,total:R2(total),placements:R2(vals.reduce((a,b)=>a+b,0)),cash:R2(cash),contributions:R2(contrib),gains:R2(total-initial-contrib)})}
    return{flow:R2(eff),requested:R2(flow||0),series,end:series[series.length-1]}};
  const sc=savingsScenarios(opts.monthsData||[]);
  return{initial,programmed,scenarios:sc,cashRate,prudent:run(opts.prudent!=null?opts.prudent:sc.prudent),realistic:run(opts.realistic!=null?opts.realistic:sc.realistic)}}

/* Effort mensuel par personne pour atteindre chaque objectif à sa date.
   items : [{id,date:'AAAA-MM'|'',share:{p1,p2},paid:{p1,p2}}] ; cm : mois courant 'AAAA-MM'.
   mois restants = mois de l'échéance − mois courant (au moins 1 : le mois de l'échéance compte).
   mensuel = arrondi au centime SUPÉRIEUR de (part − déjà épargné) ÷ mois restants (calcul direct, sans boucle). */
function goalMonthlyNeeds(items,cm){
  const c=v=>Math.round((+v||0)*100),tot={p1:0,p2:0},late=[],nodate=[];
  const goals=(items||[]).map(g=>{const d=/^\d{4}-\d{2}/.test(g.date||'')?g.date.slice(0,7):'';
    let mo=0;if(d){const[y1,m1]=cm.split('-').map(Number),[y2,m2]=d.split('-').map(Number);mo=(y2-y1)*12+m2-m1}
    const per={};['p1','p2'].forEach(k=>{const rest=Math.max(0,c(g.share&&g.share[k])-c(g.paid&&g.paid[k]));
      let status,monthly=null;
      if(!rest)status='done',monthly=0;else if(!d)status='nodate';else if(mo<0)status='late';
      else{status='ok';monthly=Math.ceil(rest/Math.max(1,mo))/100;tot[k]+=Math.round(monthly*100)}
      per[k]={rest:rest/100,monthly,status}});
    const st=Object.values(per).map(x=>x.status);
    if(st.includes('late'))late.push(g.id);if(st.includes('nodate'))nodate.push(g.id);
    return{id:g.id,months:d?Math.max(1,mo):null,overdue:!!d&&mo<0,per}});
  return{goals,total:{p1:tot.p1/100,p2:tot.p2/100},late,nodate}}
if(typeof module!=='undefined')module.exports={goalMonthlyNeeds,localIso,localMonth,safeToSpend,categoryCaps,savingsScenarios,fiveYearProjection,goalShares,goalPct,gradeOf,insQuality,contractQuality,feeCost10,frAmount,anyDate,parseCSV,parseOFX,parseQIF,parseStatementLines,parseStatementText,normLabel,merchantKey,labelSim,opHash,guessCategory,classifyOp,accountEvents,accountForecast,accOfOwner,miscAccount,livretInterest,rateOn,scheduled,insuranceExtract,frDateToIso,cancelInfo,nextDue,LIVRETS_I,HAMON_TYPES};
