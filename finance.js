'use strict';
/* Budget Couple — calculs purs (testables sous Node) : comptes courants, intérêts des livrets, extraction d'infos d'assurance. */
const pad2=n=>String(n).padStart(2,'0');
const dim=(y,m)=>new Date(y,m,0).getDate(); // m : 1-12
const ymd=(y,m,d)=>`${y}-${pad2(m)}-${pad2(d)}`;
const R2=x=>Math.round(x*100)/100;

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
    else{const nx=new Date(cd+'T12:00');nx.setDate(nx.getDate()+1);B0=(+p.capital||0)+flows(nx.toISOString().slice(0,10),`${Y-1}-12-31`).reduce((s,f)=>s+f.amount,0)}}
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
function cancelInfo(ins,today){const t=today||new Date().toISOString().slice(0,10);if(!ins.start)return null;
  const a=new Date(ins.start+'T12:00');a.setFullYear(a.getFullYear()+1);const one=a.toISOString().slice(0,10);
  if(HAMON_TYPES.includes(ins.type))return{from:one,ok:t>=one,txt:t>=one?'Résiliable à tout moment, sans frais ni motif (loi Hamon : contrat de plus d’un an) ; effet 1 mois après réception de la demande par l’assureur.':`Résiliable à tout moment à partir du ${one.split('-').reverse().join('/')} (loi Hamon, 1 an après la date d’effet).`};
  if(ins.type==='sante')return{from:one,ok:t>=one,txt:t>=one?'Complémentaire santé : résiliable à tout moment après 1 an de contrat.':`Complémentaire santé : résiliable à tout moment à partir du ${one.split('-').reverse().join('/')}.`};
  if(ins.type==='emprunteur')return{from:ins.start,ok:true,txt:'Assurance emprunteur : résiliable à tout moment (loi Lemoine), à condition de présenter des garanties équivalentes.'};
  return{from:ins.end||'',ok:false,txt:'Résiliation en principe à l’échéance annuelle (loi Chatel : l’assureur doit vous rappeler la date limite). Vérifiez le préavis dans vos conditions générales.'}}
function nextDue(ins,today){const t=today||new Date().toISOString().slice(0,10);let e=ins.end||ins.renewal||'';if(!e&&ins.start)e='--'+ins.start.slice(5);if(!e)return'';
  if(e.startsWith('--')){const md=e.slice(2);let y=+t.slice(0,4);let d=`${y}-${md}`;if(d<t)d=`${y+1}-${md}`;return d}
  if(e<t&&(ins.tacit||ins.renewal)){let d=e;while(d<t){d=String(+d.slice(0,4)+1)+d.slice(4)}return d}return e}

if(typeof module!=='undefined')module.exports={accountEvents,accountForecast,accOfOwner,miscAccount,livretInterest,rateOn,scheduled,insuranceExtract,frDateToIso,cancelInfo,nextDue,LIVRETS_I,HAMON_TYPES};
